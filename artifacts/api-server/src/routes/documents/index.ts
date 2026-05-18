import { Router } from "express";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import {
  ListDocumentsQueryParams,
  CreateDocumentBody,
  GetDocumentParams,
  DeleteDocumentParams,
  AnalyzeDocumentParams,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();
const upload = multer({ dest: "/tmp/uploads/" });

// GET /api/documents/stats — must be before /:id
router.get("/documents/stats", async (req, res) => {
  try {
    const all = await db.select().from(documentsTable).orderBy(desc(documentsTable.createdAt));

    const total = all.length;
    const completed = all.filter((d) => d.status === "completed").length;
    const analyzing = all.filter((d) => d.status === "analyzing").length;
    const pending = all.filter((d) => d.status === "pending").length;

    const byType: Record<string, number> = {};
    for (const doc of all) {
      byType[doc.type] = (byType[doc.type] ?? 0) + 1;
    }

    const recentDocuments = all.slice(0, 5).map(serializeDocument);

    res.json({ total, completed, analyzing, pending, byType, recentDocuments });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// GET /api/documents
router.get("/documents", async (req, res) => {
  try {
    const parsed = ListDocumentsQueryParams.safeParse(req.query);
    const params = parsed.success ? parsed.data : {};

    let query = db.select().from(documentsTable).$dynamic();

    if (params.type) {
      query = query.where(eq(documentsTable.type, params.type));
    }
    if (params.status) {
      query = query.where(eq(documentsTable.status, params.status));
    }

    const docs = await query.orderBy(desc(documentsTable.createdAt));
    res.json(docs.map(serializeDocument));
  } catch (err) {
    req.log.error({ err }, "Failed to list documents");
    res.status(500).json({ error: "Failed to list documents" });
  }
});

// POST /api/documents
router.post("/documents", async (req, res) => {
  try {
    const body = CreateDocumentBody.parse(req.body);
    const [doc] = await db
      .insert(documentsTable)
      .values({
        name: body.name,
        type: body.type,
        fileUrl: body.fileUrl ?? null,
        fileType: body.fileType ?? null,
        extractedText: body.extractedText ?? null,
        status: "pending",
      })
      .returning();
    res.status(201).json(serializeDocument(doc));
  } catch (err) {
    req.log.error({ err }, "Failed to create document");
    res.status(400).json({ error: "Invalid request" });
  }
});

// GET /api/documents/:id
router.get("/documents/:id", async (req, res) => {
  try {
    const { id } = GetDocumentParams.parse({ id: Number(req.params.id) });
    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.id, id));
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(serializeDocument(doc));
  } catch (err) {
    req.log.error({ err }, "Failed to get document");
    res.status(500).json({ error: "Failed to get document" });
  }
});

// DELETE /api/documents/:id
router.delete("/documents/:id", async (req, res) => {
  try {
    const { id } = DeleteDocumentParams.parse({ id: Number(req.params.id) });
    await db.delete(documentsTable).where(eq(documentsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete document");
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// POST /api/documents/:id/analyze
router.post("/documents/:id/analyze", async (req, res) => {
  try {
    const { id } = AnalyzeDocumentParams.parse({ id: Number(req.params.id) });
    const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.id, id));
    if (!doc) return res.status(404).json({ error: "Not found" });

    // Mark as analyzing
    await db
      .update(documentsTable)
      .set({ status: "analyzing", updatedAt: new Date() })
      .where(eq(documentsTable.id, id));

    const textToAnalyze = doc.extractedText ?? doc.name;

    const systemPrompt = `You are a legal AI assistant. Analyze this legal document and provide a structured summary.

Extract:
1. All parties involved
2. Key dates
3. Clause summaries
4. Obligations
5. Penalties
6. Risks
7. Important legal entities
8. Overall executive summary

Use simple language but preserve legal meaning.

Return ONLY valid JSON in this exact structure:
{
  "parties": ["string"],
  "keyDates": ["string"],
  "clauseSummaries": [{"title": "string", "summary": "string", "originalText": "string or null"}],
  "entities": [{"text": "string", "type": "date|obligation|penalty|risk|party"}],
  "risks": ["string"],
  "obligations": ["string"],
  "penalties": ["string"],
  "summary": "string"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Document name: ${doc.name}\nDocument type: ${doc.type}\n\nContent:\n${textToAnalyze}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const rawContent = completion.choices[0]?.message?.content ?? "{}";
    let analysis: unknown;
    try {
      analysis = JSON.parse(rawContent);
    } catch {
      analysis = {
        parties: [],
        keyDates: [],
        clauseSummaries: [],
        entities: [],
        risks: ["Unable to parse document"],
        obligations: [],
        penalties: [],
        summary: "Analysis could not be completed.",
      };
    }

    const [updated] = await db
      .update(documentsTable)
      .set({ status: "completed", analysis, updatedAt: new Date() })
      .where(eq(documentsTable.id, id))
      .returning();

    res.json(serializeDocument(updated));
  } catch (err) {
    req.log.error({ err }, "Analysis failed");
    await db
      .update(documentsTable)
      .set({ status: "error", updatedAt: new Date() })
      .where(eq(documentsTable.id, Number(req.params.id)));
    res.status(500).json({ error: "Analysis failed" });
  }
});

// POST /api/documents/upload — file upload (not in codegen)
router.post("/documents/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname;
  const mimeType = req.file.mimetype;
  let extractedText: string | null = null;

  try {
    if (mimeType === "application/pdf") {
      try {
        const pdfParse = await import("pdf-parse");
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse.default(buffer);
        extractedText = data.text.slice(0, 50000);
      } catch (pdfErr) {
        req.log.warn({ pdfErr }, "PDF parse failed, proceeding without text");
      }
    }

    // Store file as base64 data URL for simplicity (no object storage needed)
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString("base64");
    const fileUrl = `data:${mimeType};base64,${base64.slice(0, 100)}...`;

    fs.unlinkSync(filePath);

    res.json({
      fileUrl: `/api/uploads/${req.file.filename}`,
      fileType: mimeType,
      extractedText,
    });
  } catch (err) {
    req.log.error({ err }, "Upload failed");
    try { fs.unlinkSync(filePath); } catch {}
    res.status(500).json({ error: "Upload failed" });
  }
});

function serializeDocument(doc: typeof documentsTable.$inferSelect) {
  return {
    ...doc,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export default router;
