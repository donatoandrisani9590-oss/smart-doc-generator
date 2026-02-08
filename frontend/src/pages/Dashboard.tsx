/**
 * Dashboard - Warm & Friendly Design
 *
 * - Hero Banner with Niederwieser gradient
 * - 3-column layout (main + sidebar)
 * - Integrated stats in hero + sidebar
 * - Activity feed as right sidebar timeline
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
    PlusCircle,
    FileCheck,
    Clock,
    FileText,
    Sparkles,
    AlertTriangle,
    Search,
    ChevronRight,
    Upload,
    TrendingUp,
    Layers,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useDashboardStats, useMyActivity } from "@/hooks/useApi";
import { formatDistanceToNow } from "@/lib/dateUtils";
import { DocumentWizardDialog } from "@/components/dashboard/DocumentWizardDialog";
import { QuickTemplates } from "@/components/dashboard/QuickTemplates";
import { SmartChatInput } from "@/components/chat/SmartChatInput";
import { DeadlinesWidget } from "@/components/dashboard/DeadlinesWidget";
import { ApprovalRequestsWidget } from "@/components/dashboard/ApprovalRequestsWidget";
import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";
import { ActivityFeedWidget } from "@/components/dashboard/ActivityFeedWidget";
import { useFeatureEnabled } from "@/hooks/useFeatureSettings";

// Greeting based on time
const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Guten Morgen";
    if (hour < 18) return "Guten Tag";
    return "Guten Abend";
};

export const Dashboard = () => {
    const { data: stats, isLoading: statsLoading } = useDashboardStats();
    const { data: activity, isLoading: activityLoading } = useMyActivity(5);
    const [searchQuery, setSearchQuery] = useState("");
    const [wizardOpen, setWizardOpen] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const navigate = useNavigate();
    const isUploadEnabled = useFeatureEnabled("enable_document_upload");

    const isLoading = statsLoading || activityLoading;
    const hasOpenDrafts = (stats?.open_drafts ?? 0) > 0;
    const hasPendingTasks = hasOpenDrafts;

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    return (
        <div className="space-y-6 animate-enter">
            {/* ── Hero Banner ── */}
            <div className="bg-hero-gradient rounded-2xl p-8 text-white relative overflow-hidden shadow-hero">
                {/* Decorative overlay */}
                <div
                    className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{
                        backgroundImage:
                            "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(110,189,132,0.3) 0%, transparent 50%)",
                    }}
                />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            {getGreeting()}
                        </h1>
                        <p className="text-white/80 mt-2 text-lg font-light">
                            {hasPendingTasks
                                ? "Sie haben offene Aufgaben"
                                : "Bereit für neue Dokumente"}
                        </p>
                        {/* Quick inline stats */}
                        <div className="flex gap-8 mt-5">
                            <div>
                                <p className="text-2xl font-bold">
                                    {isLoading ? "-" : stats?.documents_this_month ?? 0}
                                </p>
                                <p className="text-[11px] text-white/60 uppercase tracking-wider">
                                    Diesen Monat
                                </p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">
                                    {isLoading ? "-" : stats?.open_drafts ?? 0}
                                </p>
                                <p className="text-[11px] text-white/60 uppercase tracking-wider">
                                    Offen
                                </p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">
                                    {isLoading ? "-" : stats?.documents_total ?? 0}
                                </p>
                                <p className="text-[11px] text-white/60 uppercase tracking-wider">
                                    Gesamt
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {isUploadEnabled && (
                            <Button
                                variant="outline"
                                className="h-10 px-4 bg-white/10 border-white/30 text-white hover:bg-white/20"
                                onClick={() => setUploadOpen(true)}
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                Hochladen
                            </Button>
                        )}
                        <Button
                            className="h-10 px-5 gap-2 bg-white text-primary hover:bg-white/90 shadow-lg font-medium"
                            onClick={() => setWizardOpen(true)}
                        >
                            <PlusCircle className="w-4 h-4" />
                            Neues Dokument
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── 3-Column Layout ── */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* LEFT: Main content (2 columns) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Search Bar */}
                    <form onSubmit={handleSearch}>
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                type="text"
                                placeholder="Dokumente, Vorlagen oder Personen suchen..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-11 h-12 bg-white dark:bg-card border-transparent shadow-soft-sm focus:shadow-soft-lg transition-all rounded-xl text-base"
                                data-global-search
                            />
                        </div>
                    </form>

                    {/* Quick Templates */}
                    <QuickTemplates />

                    {/* AI Document Creation */}
                    <div className="glass-card p-6 border-none relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                            <Sparkles className="w-32 h-32" />
                        </div>
                        <div className="flex items-center gap-4 mb-6 relative z-10">
                            <div className="p-3 bg-primary/10 rounded-xl">
                                <Sparkles className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">Mit KI erstellen</h2>
                                <p className="text-muted-foreground">
                                    Beschreiben Sie einfach, was Sie benötigen.
                                </p>
                            </div>
                        </div>
                        <div className="relative z-10">
                            <SmartChatInput
                                placeholder="z.B. 'Arbeitsvertrag für Max Müller, 5000€ Gehalt'"
                                showSuggestions={true}
                                onCreateDocument={(docType, initialData) => {
                                    const params = new URLSearchParams();
                                    params.set("type", docType);
                                    if (Object.keys(initialData).length > 0) {
                                        params.set("data", JSON.stringify(initialData));
                                    }
                                    navigate(`/generate?${params.toString()}`);
                                }}
                            />
                        </div>
                    </div>

                    {/* Widgets Row */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        <DeadlinesWidget limit={4} showStats={true} />
                        <ApprovalRequestsWidget limit={3} />
                    </div>

                    {/* Drafts + Recent Documents */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Open Drafts */}
                        <div className="card-soft p-0 overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-4 border-b info-card-header">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-amber-500" />
                                    <h3 className="font-medium text-foreground">Offene Entwürfe</h3>
                                </div>
                                {hasOpenDrafts && (
                                    <span className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 px-2.5 py-0.5 rounded-full font-medium border border-amber-100">
                                        {stats?.open_drafts}
                                    </span>
                                )}
                            </div>
                            <div className="p-2">
                                {isLoading ? (
                                    <div className="space-y-3 p-4">
                                        <Skeleton className="h-16 w-full rounded-lg" />
                                        <Skeleton className="h-16 w-full rounded-lg" />
                                    </div>
                                ) : activity?.recent_drafts && activity.recent_drafts.length > 0 ? (
                                    <div className="space-y-1">
                                        {activity.recent_drafts.slice(0, 4).map((draft: any) => {
                                            const daysRemaining = draft.days_remaining ?? 30;
                                            const isExpiringSoon = daysRemaining <= 7;

                                            return (
                                                <Link
                                                    key={draft.id}
                                                    to={`/generate?draft=${draft.id}`}
                                                    className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-warm-50 hover:shadow-sm transition-all group mx-2 bg-white dark:bg-card border border-transparent hover:border-warm-200"
                                                >
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md text-amber-600 dark:text-amber-400 group-hover:bg-amber-100 transition-colors">
                                                            <FileText className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                                                                {draft.document_type_name || draft.name || "Entwurf"}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                {draft.updated_at && (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {formatDistanceToNow(draft.updated_at)}
                                                                    </span>
                                                                )}
                                                                {isExpiringSoon && (
                                                                    <span className="text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 px-1.5 py-0 rounded flex items-center gap-1">
                                                                        <AlertTriangle className="w-3 h-3" />
                                                                        {daysRemaining === 0 ? "Heute" : `${daysRemaining}d`}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-warm-400 group-hover:text-primary transition-colors" />
                                                </Link>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-full w-fit mx-auto mb-3">
                                            <FileCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
                                        </div>
                                        <p className="text-sm font-medium text-foreground">Keine offenen Entwürfe</p>
                                        <p className="text-xs text-muted-foreground mt-1">Sie sind auf dem Laufenden</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recent Documents */}
                        <div className="card-soft p-0 overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-4 border-b info-card-header">
                                <div className="flex items-center gap-2">
                                    <FileCheck className="w-4 h-4 text-green-500" />
                                    <h3 className="font-medium text-foreground">Zuletzt erstellt</h3>
                                </div>
                                <Link to="/documents" className="text-xs font-medium text-primary hover:underline">
                                    Alle anzeigen
                                </Link>
                            </div>
                            <div className="p-2">
                                {activityLoading ? (
                                    <div className="space-y-3 p-4">
                                        <Skeleton className="h-16 w-full rounded-lg" />
                                        <Skeleton className="h-16 w-full rounded-lg" />
                                    </div>
                                ) : activity?.recent_documents && activity.recent_documents.length > 0 ? (
                                    <div className="space-y-1">
                                        {activity.recent_documents.slice(0, 4).map((doc) => (
                                            <Link
                                                key={doc.id}
                                                to={`/documents/${doc.id}`}
                                                className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-warm-50 hover:shadow-sm transition-all group mx-2 bg-white dark:bg-card border border-transparent hover:border-warm-200"
                                            >
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded-md text-green-600 dark:text-green-400 group-hover:bg-green-100 transition-colors">
                                                        <FileCheck className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                                                            {doc.document_type_name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                            {doc.employee_name || (doc.created_at && formatDistanceToNow(doc.created_at))}
                                                        </p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-warm-400 group-hover:text-primary transition-colors" />
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <div className="p-3 bg-warm-100 rounded-full w-fit mx-auto mb-3">
                                            <FileText className="w-6 h-6 text-warm-500" />
                                        </div>
                                        <p className="text-sm font-medium text-foreground">Noch keine Dokumente</p>
                                        <p className="text-xs text-muted-foreground mt-1">Starten Sie mit einem neuen Dokument</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Sidebar */}
                <div className="space-y-6">
                    {/* Compact Stats - Vertical Stack */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">
                            Statistiken
                        </h3>
                        {[
                            { label: "Diesen Monat", value: stats?.documents_this_month ?? 0, icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
                            { label: "Gesamt", value: stats?.documents_total ?? 0, icon: Layers, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" },
                            { label: "Offene Entwürfe", value: stats?.open_drafts ?? 0, icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" },
                            { label: "Massen-Jobs", value: stats?.bulk_jobs_this_month ?? 0, icon: FileCheck, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30" },
                        ].map((stat) => (
                            <div
                                key={stat.label}
                                className="bg-white dark:bg-card rounded-xl p-4 shadow-soft-sm border border-warm-200/50 hover:shadow-soft-md transition-shadow"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 ${stat.bg} rounded-lg`}>
                                        <stat.icon className={`w-4 h-4 ${stat.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-foreground leading-none">
                                            {isLoading ? "-" : stat.value}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">
                                            {stat.label}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Activity Feed - Timeline Sidebar */}
                    <ActivityFeedWidget limit={8} compact />
                </div>
            </div>

            <DocumentWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />
            <DocumentUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
        </div>
    );
};
