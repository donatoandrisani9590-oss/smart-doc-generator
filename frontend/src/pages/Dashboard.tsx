/**
 * Dashboard - Soft & Simple Design
 *
 * - Borderless cards
 * - Soft shadows
 * - Airy whitespace
 * - Clean typography
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
    Calendar,
    Sparkles,
    AlertTriangle,
    Search,
    ChevronRight,
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
        <div className="space-y-8 animate-enter">
            {/* Header Section - Clean and minimal */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">
                        {getGreeting()}
                    </h1>
                    <p className="text-muted-foreground mt-2 text-lg font-light">
                        {hasPendingTasks
                            ? "Sie haben offene Aufgaben"
                            : "Bereit für neue Dokumente"}
                    </p>
                </div>

                {/* Action Buttons with Soft Shadows */}
                <div className="flex items-center gap-3">
                    {isUploadEnabled && (
                        <Button
                            variant="outline"
                            className="h-10 px-4 bg-white border-transparent shadow-soft-sm hover:shadow-soft-md hover:bg-white text-gray-700"
                            onClick={() => setUploadOpen(true)}
                        >
                            Hochladen
                        </Button>
                    )}
                    <Button
                        className="h-10 px-5 gap-2 btn-primary-soft"
                        onClick={() => setWizardOpen(true)}
                    >
                        <PlusCircle className="w-4 h-4" />
                        Neues Dokument
                    </Button>
                </div>
            </div>

            {/* Search Bar - Floating Style */}
            <form onSubmit={handleSearch} className="max-w-2xl">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                    <Input
                        type="text"
                        placeholder="Dokumente, Vorlagen oder Personen suchen..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-11 h-12 bg-white border-transparent shadow-soft-sm focus:shadow-soft-lg transition-all rounded-xl text-base"
                        data-global-search
                    />
                </div>
            </form>

            {/* Quick Templates */}
            <QuickTemplates />

            {/* AI Document Creation - Glass Effect Card */}
            <div className="glass-card p-6 border-none relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                    <Sparkles className="w-32 h-32" />
                </div>

                <div className="flex items-center gap-4 mb-6 relative z-10">
                    <div className="p-3 bg-indigo-50 rounded-xl">
                        <Sparkles className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Mit KI erstellen</h2>
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

            {/* Main Content - Two Columns */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Drafts Column - Floating Card */}
                <div className="card-soft p-0 overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-500" />
                            <h3 className="font-medium text-gray-900">Offene Entwürfe</h3>
                        </div>
                        {hasOpenDrafts && (
                            <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full font-medium border border-amber-100">
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
                                            className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-50 hover:shadow-sm transition-all group mx-2 bg-white border border-transparent hover:border-gray-100"
                                        >
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div className="p-2 bg-amber-50 rounded-md text-amber-600 group-hover:bg-amber-100 transition-colors">
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
                                                        {draft.document_type_name || draft.name || "Entwurf"}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {draft.updated_at && (
                                                            <span className="text-xs text-muted-foreground">
                                                                {formatDistanceToNow(draft.updated_at)}
                                                            </span>
                                                        )}
                                                        {isExpiringSoon && (
                                                            <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0 rounded flex items-center gap-1">
                                                                <AlertTriangle className="w-3 h-3" />
                                                                {daysRemaining === 0 ? "Heute" : `${daysRemaining}d`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors" />
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <div className="p-3 bg-green-50 rounded-full w-fit mx-auto mb-3">
                                    <FileCheck className="w-6 h-6 text-green-600" />
                                </div>
                                <p className="text-sm font-medium text-gray-900">Keine offenen Entwürfe</p>
                                <p className="text-xs text-muted-foreground mt-1">Sie sind auf dem Laufenden</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Documents Column - Floating Card */}
                <div className="card-soft p-0 overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                        <div className="flex items-center gap-2">
                            <FileCheck className="w-4 h-4 text-green-500" />
                            <h3 className="font-medium text-gray-900">Zuletzt erstellt</h3>
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
                                        className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-50 hover:shadow-sm transition-all group mx-2 bg-white border border-transparent hover:border-gray-100"
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="p-2 bg-green-50 rounded-md text-green-600 group-hover:bg-green-100 transition-colors">
                                                <FileCheck className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
                                                    {doc.document_type_name}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                    {doc.employee_name || (doc.created_at && formatDistanceToNow(doc.created_at))}
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors" />
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <div className="p-3 bg-gray-50 rounded-full w-fit mx-auto mb-3">
                                    <FileText className="w-6 h-6 text-gray-400" />
                                </div>
                                <p className="text-sm font-medium text-gray-900">Noch keine Dokumente</p>
                                <p className="text-xs text-muted-foreground mt-1">Starten Sie mit einem neuen Dokument</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Activity Feed */}
            <ActivityFeedWidget limit={5} />

            {/* Stats Row - Glass Panels */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <div className="bg-white/60 p-4 rounded-xl border border-white/40 shadow-sm backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <FileText className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-gray-900 leading-none">
                                {isLoading ? "-" : stats?.documents_this_month ?? 0}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Diesen Monat</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white/60 p-4 rounded-xl border border-white/40 shadow-sm backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-gray-900 leading-none">
                                {isLoading ? "-" : stats?.documents_total ?? 0}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Gesamt</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white/60 p-4 rounded-xl border border-white/40 shadow-sm backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                            <Clock className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-gray-900 leading-none">
                                {isLoading ? "-" : stats?.open_drafts ?? 0}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Offen</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white/60 p-4 rounded-xl border border-white/40 shadow-sm backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-50 rounded-lg text-green-600">
                            <FileCheck className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-gray-900 leading-none">
                                {isLoading ? "-" : stats?.bulk_jobs_this_month ?? 0}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Massen-Jobs</p>
                        </div>
                    </div>
                </div>
            </div>

            <DocumentWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />
            <DocumentUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
        </div>
    );
};
