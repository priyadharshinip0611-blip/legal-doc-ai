# LexAI — AI-Powered Legal Document Analyzer

An AI-powered legal document analysis platform that uses OpenAI to extract key insights from contracts, NDAs, leases, and other legal documents.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/legal-analyzer run dev` — run the frontend (port varies)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` — auto-provisioned by Replit AI Integrations

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, framer-motion, shadcn/ui, wouter, TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: OpenAI GPT-5-mini via Replit AI Integrations (no API key required)
- File upload: multer + pdf-parse
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/documents.ts` — documents table schema
- `artifacts/api-server/src/routes/documents/index.ts` — all document CRUD + AI analysis routes
- `artifacts/legal-analyzer/src/pages/` — Dashboard, Analyze, DocumentDetail pages
- `artifacts/legal-analyzer/src/components/layout.tsx` — sidebar navigation layout

## Architecture decisions

- OpenAI accessed via Replit AI Integrations proxy — no user API key required, billed to Replit credits
- File upload handled via multer directly (not in the OpenAPI spec / codegen) since multipart binary uploads don't work cleanly with Orval
- Analysis is triggered as a separate POST `/documents/:id/analyze` step so the frontend can poll for completion
- PDF text extraction via `pdf-parse` on the server; images are uploaded but analyzed by document name/type only (no OCR)
- Document analysis stored as JSONB in PostgreSQL for flexible schema

## Product

- **Dashboard**: Stats overview (total, completed, analyzing, pending), filterable document list by type
- **Analyze**: Drag-and-drop upload with animated progress, triggers AI extraction of parties, dates, clauses, risks, obligations, and penalties
- **Document Detail**: Executive summary, color-coded entity badges, expandable clause analysis table, export to JSON, delete

## User preferences

- Premium legal-tech design: dark navy sidebar, gold accents, serif headings
- No emojis in the UI

## Gotchas

- File upload route (`POST /api/documents/upload`) is NOT in the OpenAPI spec — use raw fetch from the frontend
- Always run `pnpm --filter @workspace/db run push` after schema changes
- Always run `pnpm --filter @workspace/api-spec run codegen` after spec changes

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `ai-integrations-openai` skill for OpenAI integration details
