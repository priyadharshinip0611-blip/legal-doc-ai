import { motion } from "framer-motion";
import { Link } from "wouter";
import { FileText, CheckCircle, Loader2, Clock, ChevronRight, AlertTriangle, Filter } from "lucide-react";
import { useState } from "react";
import { useListDocuments, useGetDocumentStats, useDeleteDocument, getListDocumentsQueryKey, getGetDocumentStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const DOC_TYPES = [
  { value: "all", label: "All Types" },
  { value: "contract", label: "Contract" },
  { value: "agreement", label: "Agreement" },
  { value: "nda", label: "NDA" },
  { value: "lease", label: "Lease" },
  { value: "employment_agreement", label: "Employment Agreement" },
  { value: "partnership_agreement", label: "Partnership Agreement" },
  { value: "other", label: "Other" },
];

function statusConfig(status: string) {
  switch (status) {
    case "completed": return { label: "Completed", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40", icon: CheckCircle };
    case "analyzing": return { label: "Analyzing", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40", icon: Loader2 };
    case "error": return { label: "Error", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40", icon: AlertTriangle };
    default: return { label: "Pending", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", icon: Clock };
  }
}

function typeLabel(type: string) {
  return DOC_TYPES.find((t) => t.value === type)?.label ?? type;
}

const stagger = { animate: { transition: { staggerChildren: 0.07 } } };
const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function Dashboard() {
  const [typeFilter, setTypeFilter] = useState("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const listParams = typeFilter !== "all" ? { type: typeFilter } : undefined;
  const { data: docs, isLoading: docsLoading } = useListDocuments(listParams, {
    query: { queryKey: getListDocumentsQueryKey(listParams) },
  });
  const { data: stats, isLoading: statsLoading } = useGetDocumentStats({
    query: { queryKey: getGetDocumentStatsQueryKey() },
  });
  const deleteMutation = useDeleteDocument({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDocumentStatsQueryKey() });
        toast({ title: "Document deleted" });
      },
    },
  });

  const statCards = [
    { label: "Total Documents", value: stats?.total ?? 0, icon: FileText, color: "text-primary", bg: "bg-primary/10" },
    { label: "Completed", value: stats?.completed ?? 0, icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
    { label: "Analyzing", value: stats?.analyzing ?? 0, icon: Loader2, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
    { label: "Pending", value: stats?.pending ?? 0, icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
  ];

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-8">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-muted-foreground text-sm">Overview of your legal document analyses</p>
        </div>
        <Link href="/analyze">
          <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-new-analysis">
            <FileText className="h-4 w-4" />
            New Analysis
          </Button>
        </Link>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow" data-testid={`stat-card-${card.label.toLowerCase().replace(/\s/g, "-")}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</p>
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <Icon className={`h-4 w-4 ${card.color} ${card.label === "Analyzing" && card.value > 0 ? "animate-spin" : ""}`} />
                </div>
              </div>
              {statsLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-3xl font-bold text-foreground">{card.value}</p>
              )}
            </div>
          );
        })}
      </motion.div>

      {/* Document list */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-serif font-semibold text-foreground">Documents</h2>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44 h-8 text-sm" data-testid="select-doc-type-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          {docsLoading ? (
            <div className="divide-y divide-border">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : !docs || docs.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No documents found</p>
              <Link href="/analyze">
                <Button variant="outline" size="sm" className="mt-4">Upload your first document</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {docs.map((doc, idx) => {
                const status = statusConfig(doc.status);
                const StatusIcon = status.icon;
                return (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.04 } }}
                    className="group p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors"
                    data-testid={`document-row-${doc.id}`}
                  >
                    <div className="p-2.5 rounded-lg bg-primary/10 shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate text-sm">{doc.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {typeLabel(doc.type)} &middot; {new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                      <StatusIcon className={`h-3.5 w-3.5 ${doc.status === "analyzing" ? "animate-spin" : ""}`} />
                      {status.label}
                    </div>
                    {doc.status === "completed" ? (
                      <Link href={`/documents/${doc.id}`}>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8" data-testid={`button-view-${doc.id}`}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    ) : (
                      <div className="w-8" />
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
