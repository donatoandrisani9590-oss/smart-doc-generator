/**
 * Dashboard - SimpleDocs-inspired Design
 *
 * Clean, minimal layout:
 * - Simple greeting
 * - Card-based sections
 * - Subtle hover states
 * - Clear visual hierarchy
 */

import { useState } from "react";
// Card components - unused after SimpleDocs redesign but kept for potential future use
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

// Tageszeit-basierte Begrüßung
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
        <div className="space-y-6">
            {/* Header Section - Clean and minimal */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">
                        {getGreeting()}
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {hasPendingTasks
                            ? "Sie haben offene Aufgaben"
                            : "Bereit für neue Dokumente"}
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    {isUploadEnabled && (
                        <Button
                            variant="outline"
                            className="h-9"
                            onClick={() => setUploadOpen(true)}
                        >
                            Hochladen
                        </Button>
                    )}
                    <Button
                        className="h-9 gap-2"
                        onClick={() => setWizardOpen(true)}
                    >
                        <PlusCircle className="w-4 h-4" />
                        Neues Dokument
                    </Button>
                </div>
            </div>

            {/* Search Bar - Simple */}
            <form onSubmit={handleSearch}>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        type="text"
                        placeholder="Dokumente suchen..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-10 bg-white border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10"
                        data-global-search
                    />
                </div>
            </form>

            {/* Quick Templates */}
            <QuickTemplates />

            {/* AI Document Creation - Simplified Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-2.5 bg-primary/10 rounded-lg">
                        <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-gray-900">Mit KI erstellen</h2>
                        <p className="text-sm text-gray-500">
                            Beschreiben Sie, was Sie brauchen
                        </p>
                    </div>
                </div>
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

            {/* Widgets Row */}
            <div className="grid gap-4 lg:grid-cols-2">
                <DeadlinesWidget limit={4} showStats={true} />
                <ApprovalRequestsWidget limit={3} />
            </div>

            {/* Main Content - Two Columns */}
            <div className="grid gap-4 lg:grid-cols-2">
                {/* Drafts Column */}
                <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-500" />
                            <h3 className="font-medium text-gray-900">Entwürfe</h3>
                        </div>
                        {hasOpenDrafts && (
                            <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded font-medium">
                                {stats?.open_drafts}
                            </span>
                        )}
                    </div>
                    <div className="p-2">
                        {isLoading ? (
                            <div className="space-y-2 p-2">
                                <Skeleton className="h-14 w-full rounded" />
                                <Skeleton className="h-14 w-full rounded" />
                            </div>
                        ) : activity?.recent_drafts && activity.recent_drafts.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                                {activity.recent_drafts.slice(0, 4).map((draft: any) => {
                                    const daysRemaining = draft.days_remaining ?? 30;
                                    const isExpiringSoon = daysRemaining <= 7;

                                    return (
                                        <Link
                                            key={draft.id}
                                            to={`/generate?draft=${draft.id}`}
                                            className="flex items-center justify-between px-3 py-2.5 rounded hover:bg-gray-50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">
                                                        {draft.document_type_name || draft.name || "Entwurf"}
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        {draft.updated_at && (
                                                            <span className="text-xs text-gray-500">
                                                                {formatDistanceToNow(draft.updated_at)}
                                                            </span>
                                                        )}
                                                        {isExpiringSoon && (
                                                            <span className="text-xs text-amber-600 flex items-center gap-0.5">
                                                                <AlertTriangle className="w-3 h-3" />
                                                                {daysRemaining === 0 ? "Heute" : `${daysRemaining}d`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0" />
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <FileCheck className="w-8 h-8 mx-auto mb-2 text-green-500" />
                                <p className="text-sm font-medium text-gray-900">Keine Entwürfe</p>
                                <p className="text-xs text-gray-500">Alles erledigt</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Documents Column */}
                <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <FileCheck className="w-4 h-4 text-green-500" />
                            <h3 className="font-medium text-gray-900">Zuletzt erstellt</h3>
                        </div>
                        <Link to="/documents" className="text-xs text-primary hover:underline">
                            Alle
                        </Link>
                    </div>
                    <div className="p-2">
                        {activityLoading ? (
                            <div className="space-y-2 p-2">
                                <Skeleton className="h-14 w-full rounded" />
                                <Skeleton className="h-14 w-full rounded" />
                            </div>
                        ) : activity?.recent_documents && activity.recent_documents.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                                {activity.recent_documents.slice(0, 4).map((doc) => (
                                    <Link
                                        key={doc.id}
                                        to={`/documents/${doc.id}`}
                                        className="flex items-center justify-between px-3 py-2.5 rounded hover:bg-gray-50 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <FileCheck className="w-4 h-4 text-green-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {doc.document_type_name}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {doc.employee_name || (doc.created_at && formatDistanceToNow(doc.created_at))}
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0" />
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                <p className="text-sm font-medium text-gray-900">Noch keine Dokumente</p>
                                <p className="text-xs text-gray-500">Erstellen Sie Ihr erstes</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Activity Feed */}
            <ActivityFeedWidget limit={5} />

            {/* Stats Row - Compact */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-primary" />
                        <div>
                            <p className="text-lg font-semibold text-gray-900">
                                {isLoading ? "-" : stats?.documents_this_month ?? 0}
                            </p>
                            <p className="text-xs text-gray-500">Diesen Monat</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-primary" />
                        <div>
                            <p className="text-lg font-semibold text-gray-900">
                                {isLoading ? "-" : stats?.documents_total ?? 0}
                            </p>
                            <p className="text-xs text-gray-500">Insgesamt</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <div>
                            <p className="text-lg font-semibold text-gray-900">
                                {isLoading ? "-" : stats?.open_drafts ?? 0}
                            </p>
                            <p className="text-xs text-gray-500">Entwürfe</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                        <FileCheck className="w-4 h-4 text-green-500" />
                        <div>
                            <p className="text-lg font-semibold text-gray-900">
                                {isLoading ? "-" : stats?.bulk_jobs_this_month ?? 0}
                            </p>
                            <p className="text-xs text-gray-500">Massen-Jobs</p>
                        </div>
                    </div>
                </div>
            </div>

            <DocumentWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />
            <DocumentUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
        </div>
    );
};
