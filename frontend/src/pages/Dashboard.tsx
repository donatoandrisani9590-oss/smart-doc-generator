/**
 * Dashboard - Clean & Focused Design
 *
 * - Hero Banner with greeting, stats, search & primary actions
 * - Single-column layout for clarity
 * - Widgets only shown when they have data
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useDashboardStats, useMyActivity, useClauses, useDocumentTypes } from "@/hooks/useApi";
import { formatDistanceToNow } from "@/lib/dateUtils";
import { DocumentWizardDialog } from "@/components/dashboard/DocumentWizardDialog";
import { QuickTemplates } from "@/components/dashboard/QuickTemplates";
import { SmartChatInput } from "@/components/chat/SmartChatInput";
import { DeadlinesWidget } from "@/components/dashboard/DeadlinesWidget";
import { ApprovalRequestsWidget } from "@/components/dashboard/ApprovalRequestsWidget";
import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";
import { OnboardingBanner } from "@/components/dashboard/OnboardingBanner";
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
    const { data: clauses } = useClauses();
    const { data: documentTypes } = useDocumentTypes();
    const [searchQuery, setSearchQuery] = useState("");
    const [wizardOpen, setWizardOpen] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [onboardingDismissed, setOnboardingDismissed] = useState(() =>
        localStorage.getItem("onboarding-dismissed") === "true"
    );
    const navigate = useNavigate();
    const isUploadEnabled = useFeatureEnabled("enable_document_upload");

    const isLoading = statsLoading || activityLoading;
    const hasOpenDrafts = (stats?.open_drafts ?? 0) > 0;
    const hasPendingTasks = hasOpenDrafts;
    const hasNoDocumentTypes = !isLoading && (documentTypes?.length ?? 0) === 0;

    // Onboarding: Prüfe ob Ersteinrichtung abgeschlossen
    const showOnboarding = !onboardingDismissed && !isLoading;
    const handleDismissOnboarding = () => {
        setOnboardingDismissed(true);
        localStorage.setItem("onboarding-dismissed", "true");
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    // Determine which document list to show
    const hasDrafts = activity?.recent_drafts && activity.recent_drafts.length > 0;
    const hasRecentDocs = activity?.recent_documents && activity.recent_documents.length > 0;
    const showDocumentSection = !isLoading && (hasDrafts || hasRecentDocs);

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
                <div className="relative z-10">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-white">
                                {getGreeting()}
                            </h1>
                            <p className="text-white/80 mt-2 text-lg font-light">
                                {hasNoDocumentTypes
                                    ? "Richten Sie Ihre erste Dokumentvorlage ein"
                                    : hasPendingTasks
                                    ? "Sie haben offene Aufgaben"
                                    : "Bereit für neue Dokumente"}
                            </p>
                            {/* Quick inline stats */}
                            <div className="flex gap-8 mt-5">
                                <div>
                                    {isLoading ? (
                                        <Skeleton className="h-8 w-10 bg-white/20 rounded" />
                                    ) : (
                                        <p className="text-2xl font-bold">
                                            {stats?.documents_this_month ?? 0}
                                        </p>
                                    )}
                                    <p className="text-[11px] text-white/60 uppercase tracking-wider mt-1">
                                        Diesen Monat
                                    </p>
                                </div>
                                <div>
                                    {isLoading ? (
                                        <Skeleton className="h-8 w-10 bg-white/20 rounded" />
                                    ) : (
                                        <p className="text-2xl font-bold">
                                            {stats?.open_drafts ?? 0}
                                        </p>
                                    )}
                                    <p className="text-[11px] text-white/60 uppercase tracking-wider mt-1">
                                        Offen
                                    </p>
                                </div>
                                <div>
                                    {isLoading ? (
                                        <Skeleton className="h-8 w-10 bg-white/20 rounded" />
                                    ) : (
                                        <p className="text-2xl font-bold">
                                            {stats?.documents_total ?? 0}
                                        </p>
                                    )}
                                    <p className="text-[11px] text-white/60 uppercase tracking-wider mt-1">
                                        Gesamt
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 lg:mt-1">
                            {isUploadEnabled && (
                                <Button
                                    variant="outline"
                                    className="h-10 px-5 border-2 border-white/40 bg-transparent text-white hover:bg-white/15 hover:border-white/60 hover:shadow-[0_4px_14px_rgba(255,255,255,0.2)] transition-all duration-300 ease-out rounded-full"
                                    onClick={() => setUploadOpen(true)}
                                >
                                    <Upload className="w-4 h-4 mr-2" />
                                    Hochladen
                                </Button>
                            )}
                            <Button
                                className="h-10 px-5 gap-2 bg-white text-[#243186] hover:bg-white/90 hover:shadow-[0_4px_14px_rgba(255,255,255,0.3)] transition-all duration-300 ease-out font-medium rounded-full border-2 border-white"
                                onClick={() => hasNoDocumentTypes ? navigate("/settings?tab=templates") : setWizardOpen(true)}
                            >
                                <PlusCircle className="w-4 h-4" />
                                {hasNoDocumentTypes ? "Einrichtung starten" : "Neues Dokument"}
                            </Button>
                        </div>
                    </div>

                    {/* Search Bar inside Hero */}
                    <form onSubmit={handleSearch} className="mt-6">
                        <div className="relative group max-w-2xl">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 group-focus-within:text-white/80 transition-colors" />
                            <Input
                                type="text"
                                placeholder="Dokumente, Vorlagen oder Personen suchen..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-11 h-11 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:bg-white/15 focus:border-white/40 transition-all rounded-xl text-sm"
                                data-global-search
                            />
                            {searchQuery.trim() && (
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/50 bg-white/10 px-2 py-0.5 rounded">
                                    Enter ↵
                                </span>
                            )}
                        </div>
                    </form>
                </div>
            </div>

            {/* ── Onboarding Banner ── */}
            {showOnboarding && (
                <OnboardingBanner
                    clauseCount={clauses?.length ?? 0}
                    documentTypeCount={documentTypes?.length ?? 0}
                    hasCompanyData={(stats?.documents_total ?? 0) > 0 || (documentTypes?.length ?? 0) > 0}
                    hasLogo={false}
                    onDismiss={handleDismissOnboarding}
                />
            )}

            {/* ── Main Content (single column) ── */}
            <div className="space-y-6">
                {/* Quick Templates - nur anzeigen wenn Dokumenttypen vorhanden */}
                {!hasNoDocumentTypes && <QuickTemplates />}

                {/* AI Document Creation - nur anzeigen wenn Dokumenttypen vorhanden */}
                {!hasNoDocumentTypes && (
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
                )}

                {/* Widgets Row - only renders when widgets have data */}
                <div className="grid gap-6 md:grid-cols-2">
                    <DeadlinesWidget limit={4} showStats={true} />
                    <ApprovalRequestsWidget limit={3} />
                </div>

                {/* Combined Document Section */}
                {showDocumentSection && (
                    <div className="card-soft p-0 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b info-card-header">
                            <div className="flex items-center gap-2">
                                {hasDrafts ? (
                                    <>
                                        <Clock className="w-4 h-4 text-amber-500" />
                                        <h3 className="font-medium text-foreground">Offene Entwürfe</h3>
                                        <span className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 px-2.5 py-0.5 rounded-full font-medium border border-amber-100">
                                            {stats?.open_drafts}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <FileCheck className="w-4 h-4 text-green-500" />
                                        <h3 className="font-medium text-foreground">Zuletzt erstellt</h3>
                                    </>
                                )}
                            </div>
                            <Link to="/documents" className="text-xs font-medium text-primary hover:underline">
                                Alle anzeigen
                            </Link>
                        </div>
                        <div className="p-2">
                            {hasDrafts ? (
                                <div className="space-y-1">
                                    {activity!.recent_drafts.slice(0, 3).map((draft: any) => {
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
                            ) : hasRecentDocs ? (
                                <div className="space-y-1">
                                    {activity!.recent_documents.slice(0, 3).map((doc) => (
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
                            ) : null}
                        </div>
                    </div>
                )}
            </div>

            <DocumentWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />
            <DocumentUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
        </div>
    );
};
