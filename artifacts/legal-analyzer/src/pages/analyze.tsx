import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, X, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { useCreateDocument, useAnalyzeDocument, getListDocumentsQueryKey, getGetDocumentStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

const DOC_TYPES = [
  { value: "contract", label: "Contract" },
  { value: "agreement", label: "Agreement" },
  { value: "nda", label: "NDA" },
  { value: "lease", label: "Lease" },
  { value: "employment_agreement", label: "Employment Agreement" },
  { value: "partnership_agreement", label: "Partnership Agreement" },
  { value: "other", label: "Other" },
];

type Step = "upload" | "uploading" | "analyzing" | "done" | "error";

export default function Analyze() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("");
  const [step, setStep] = useState<Step>("upload");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [createdDocId, setCreatedDocId] = useState<number | null>(null);

  const createDoc = useCreateDocument();
  const analyzeDoc = useAnalyzeDocument();

  const onFileSelect = (f: File) => {
    setFile(f);
    if (!docName) setDocName(f.name.replace(/\.[^.]+$/, ""));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFileSelect(f);
  }, [docName]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim() || !docType) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }

    setStep("uploading");
    setProgress(10);

    let fileUrl: string | null = null;
    let fileType: string | null = null;
    let extractedText: string | null = null;

    try {
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        setProgress(30);
        const resp = await fetch("/api/documents/upload", { method: "POST", body: formData });
        if (resp.ok) {
          const data = await resp.json();
          fileUrl = data.fileUrl;
          fileType = data.fileType;
          extractedText = data.extractedText;
        }
      }

      setProgress(50);

      const doc = await new Promise<{ id: number }>((resolve, reject) => {
        createDoc.mutate(
          { data: { name: docName.trim(), type: docType as "contract", fileUrl, fileType, extractedText } },
          { onSuccess: resolve, onError: reject }
        );
      });

      setCreatedDocId(doc.id);
      setProgress(65);
      setStep("analyzing");

      // Simulate progress during analysis
      const interval = setInterval(() => {
        setProgress((p) => Math.min(p + 3, 92));
      }, 800);

      await new Promise<void>((resolve, reject) => {
        analyzeDoc.mutate({ id: doc.id }, {
          onSuccess: () => { clearInterval(interval); resolve(); },
          onError: (err) => { clearInterval(interval); reject(err); },
        });
      });

      setProgress(100);
      setStep("done");

      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDocumentStatsQueryKey() });

      setTimeout(() => setLocation(`/documents/${doc.id}`), 1200);
    } catch (err) {
      setStep("error");
      setErrorMsg("Analysis failed. Please try again.");
    }
  };

  const resetForm = () => {
    setFile(null);
    setDocName("");
    setDocType("");
    setStep("upload");
    setProgress(0);
    setErrorMsg("");
  };

  const isProcessing = step === "uploading" || step === "analyzing";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.35 } }}
      className="max-w-2xl mx-auto space-y-8"
    >
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Analyze Document</h1>
        <p className="mt-1 text-sm text-muted-foreground">Upload a legal document and let AI extract key insights</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !file && !isProcessing && fileInputRef.current?.click()}
          className={`
            relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
            ${isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border bg-card hover:border-primary/50 hover:bg-muted/30"}
            ${file ? "cursor-default" : ""}
            ${isProcessing ? "pointer-events-none opacity-70" : ""}
          `}
          data-testid="file-upload-zone"
        >
          <AnimatePresence mode="wait">
            {!file ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16 px-6 text-center"
              >
                <div className="p-4 rounded-full bg-primary/10 mb-4">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <p className="font-medium text-foreground">Drop your document here</p>
                <p className="text-sm text-muted-foreground mt-1">PDF, PNG, JPG or JPEG &middot; up to 50MB</p>
                <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => fileInputRef.current?.click()}>
                  Browse files
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="file"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-4 p-5"
              >
                <div className="p-3 rounded-lg bg-primary/10 shrink-0">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB &middot; {file.type || "document"}</p>
                </div>
                {!isProcessing && (
                  <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setFile(null); }} data-testid="button-remove-file">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }}
          data-testid="input-file"
        />

        {/* Document name */}
        <div className="space-y-2">
          <Label htmlFor="doc-name">Document Name</Label>
          <Input
            id="doc-name"
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
            placeholder="e.g. Service Agreement – Acme Corp"
            disabled={isProcessing}
            data-testid="input-doc-name"
          />
        </div>

        {/* Document type */}
        <div className="space-y-2">
          <Label htmlFor="doc-type">Document Type</Label>
          <Select value={docType} onValueChange={setDocType} disabled={isProcessing}>
            <SelectTrigger id="doc-type" data-testid="select-doc-type">
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Progress */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 overflow-hidden"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>{step === "uploading" ? "Uploading and processing document..." : "AI is analyzing your document..."}</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">{progress}% complete</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Done state */}
        <AnimatePresence>
          {step === "done" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
            >
              <CheckCircle className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">Analysis complete. Redirecting to results...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error state */}
        <AnimatePresence>
          {step === "error" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"
            >
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span className="text-sm">{errorMsg}</span>
              <Button type="button" variant="ghost" size="sm" onClick={resetForm} className="ml-auto text-red-700 dark:text-red-400">
                Try again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        {step === "upload" && (
          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 text-sm font-semibold"
            disabled={!docName.trim() || !docType}
            data-testid="button-analyze"
          >
            Analyze Document
          </Button>
        )}
      </form>
    </motion.div>
  );
}
