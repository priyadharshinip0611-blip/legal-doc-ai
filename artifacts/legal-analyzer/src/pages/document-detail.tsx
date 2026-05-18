import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  ArrowLeft, FileText, Calendar, Users, AlertTriangle, ChevronDown, ChevronUp,
  Scale, Loader2, Trash2, Download
} from "lucide-react";
import { useGetDocument, useDeleteDocument, getListDocumentsQueryKey, getGetDocumentStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type EntityType = "date" | "obligation" | "penalty" | "risk" | "party";

const entityColors: Record<EntityType, string> = {
  date: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  obligation: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  penalty: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  risk: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
  party: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
};

const sectionAnim = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <motion.div variants={sectionAnim} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border bg-muted/30">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        <h2 className="font-semibold text-sm text-foreground">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  );
}

function ClauseRow({ clause, idx }: { clause: { title: string; summary: string; originalText?: string | null }; idx: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-border last:border-0" data-testid={`clause-row-${idx}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-3 px-4 hover:bg-muted/30 transition-colors text-left gap-4"
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground">{clause.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{clause.summary}</p>
        </div>
        {clause.originalText && (
          expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      <AnimatePresence>
        {expanded && clause.originalText && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <div className="rounded-lg bg-muted/50 border border-border p-3">
                <p className="text-xs text-muted-foreground font-medium mb-1.5">Original clause text</p>
                <p className="text-sm text-foreground font-mono leading-relaxed whitespace-pre-wrap">{clause.originalText}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const numId = Number(id);

  const { data: doc, isLoading } = useGetDocument(numId, {
    query: { queryKey: getListDocumentsQueryKey(), enabled: !!numId },
  });

  const deleteMutation = useDeleteDocument({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDocumentStatsQueryKey() });
        toast({ title: "Document deleted" });
        setLocation("/");
      },
    },
  });

  const handleDelete = () => {
    if (confirm("Delete this document? This action cannot be undone.")) {
      deleteMutation.mutate({ id: numId });
    }
  };

  const handleDownload = () => {
    if (!doc?.analysis) return;
    const content = JSON.stringify(doc.analysis, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.name}-analysis.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="font-medium text-foreground">Document not found</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setLocation("/")}>Back to Dashboard</Button>
      </div>
    );
  }

  const analysis = doc.analysis as {
    parties: string[];
    keyDates: string[];
    clauseSummaries: { title: string; summary: string; originalText?: string | null }[];
    entities: { text: string; type: EntityType }[];
    risks: string[];
    obligations: string[];
    penalties: string[];
    summary: string;
  } | null;

  if (!analysis && doc.status !== "completed") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-3" />
        <p className="font-medium text-foreground">Analysis in progress...</p>
        <p className="text-sm text-muted-foreground mt-1">This document is being analyzed by AI</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setLocation("/")}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={{ animate: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={sectionAnim} className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="shrink-0 mt-0.5" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-serif font-bold text-foreground truncate">{doc.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {doc.type.replace(/_/g, " ")} &middot; Analyzed {new Date(doc.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {analysis && (
            <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5" data-testid="button-download">
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleDelete} className="gap-1.5 text-destructive hover:text-destructive" data-testid="button-delete">
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </motion.div>

      {/* Executive summary */}
      {analysis?.summary && (
        <motion.div variants={sectionAnim} className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Scale className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm text-primary">Executive Summary</h2>
          </div>
          <p className="text-sm text-foreground leading-relaxed" data-testid="text-summary">{analysis.summary}</p>
        </motion.div>
      )}

      {/* Entities */}
      {analysis?.entities && analysis.entities.length > 0 && (
        <motion.div variants={sectionAnim}>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Key Entities</h2>
          <div className="flex flex-wrap gap-2" data-testid="entity-badges">
            {analysis.entities.map((entity, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${entityColors[entity.type] ?? "bg-muted text-muted-foreground"}`}
                data-testid={`entity-badge-${i}`}
              >
                <span className="capitalize">{entity.type}</span>
                <span className="opacity-60">·</span>
                {entity.text}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Grid: parties + dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {analysis?.parties && analysis.parties.length > 0 && (
          <SectionCard title="Parties Involved" icon={Users}>
            <ul className="space-y-2">
              {analysis.parties.map((p, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-foreground" data-testid={`party-${i}`}>
                  <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {analysis?.keyDates && analysis.keyDates.length > 0 && (
          <SectionCard title="Key Dates" icon={Calendar}>
            <ul className="space-y-2">
              {analysis.keyDates.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground" data-testid={`date-${i}`}>
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                  {d}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>

      {/* Risks */}
      {analysis?.risks && analysis.risks.length > 0 && (
        <SectionCard title="Identified Risks" icon={AlertTriangle}>
          <ul className="space-y-3">
            {analysis.risks.map((risk, i) => (
              <li key={i} className="flex items-start gap-3" data-testid={`risk-${i}`}>
                <div className="p-1 rounded-md bg-red-100 dark:bg-red-950/40 shrink-0 mt-0.5">
                  <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400" />
                </div>
                <span className="text-sm text-foreground">{risk}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Obligations & Penalties */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {analysis?.obligations && analysis.obligations.length > 0 && (
          <SectionCard title="Obligations" icon={FileText}>
            <ul className="space-y-2">
              {analysis.obligations.map((o, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                  {o}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
        {analysis?.penalties && analysis.penalties.length > 0 && (
          <SectionCard title="Penalties" icon={AlertTriangle}>
            <ul className="space-y-2">
              {analysis.penalties.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0 mt-1.5" />
                  {p}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>

      {/* Clause analysis */}
      {analysis?.clauseSummaries && analysis.clauseSummaries.length > 0 && (
        <motion.div variants={sectionAnim} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border bg-muted/30">
            <Scale className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">Clause Analysis</h2>
            <span className="ml-auto text-xs text-muted-foreground">{analysis.clauseSummaries.length} clauses</span>
          </div>
          <div data-testid="clause-table">
            {analysis.clauseSummaries.map((clause, i) => (
              <ClauseRow key={i} clause={clause} idx={i} />
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
