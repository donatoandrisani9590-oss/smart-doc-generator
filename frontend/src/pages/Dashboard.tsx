/**
 * Dashboard - Clean & Focused Design
 *
 * - Hero Banner with greeting, stats, search & primary actions
 * - Single-column layout for clarity
 * - Widgets only shown when they have data
 */

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Sparkles,
    Search,
    ChevronRight,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useDashboardStats, useClauses, useDocumentTypes } from "@/hooks/useApi";
import { DocumentWizardDialog } from "@/components/dashboard/DocumentWizardDialog";
import { QuickTemplates } from "@/components/dashboard/QuickTemplates";
import { DocumentWizardChat } from "@/components/chat/DocumentWizardChat";
import { DeadlinesWidget } from "@/components/dashboard/DeadlinesWidget";
import { ApprovalRequestsWidget } from "@/components/dashboard/ApprovalRequestsWidget";
import { EmailDraftsWidget } from "@/components/dashboard/EmailDraftsWidget";
import { ActionSummaryCards } from "@/components/documents/ActionSummaryCards";

import { OnboardingBanner } from "@/components/dashboard/OnboardingBanner";


import { useAuth } from "@/contexts/AuthContext";
import { useFeatureEnabled } from "@/hooks/useFeatureSettings";
import { api } from "@/lib/api-client";

// Greeting based on time of day
const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Guten Morgen";
    if (hour < 18) return "Guten Tag";
    return "Guten Abend";
};

// Extract first name from email (e.g. "donato.andrisani@..." → "Donato")
const getFirstName = (email: string): string | null => {
    const name = email.split("@")[0];
    const parts = name.split(/[._-]/);
    if (parts.length > 0 && parts[0].length > 1) {
        return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    return null;
};

export const Dashboard = () => {
    const { user } = useAuth();
    const { data: stats, isLoading: statsLoading } = useDashboardStats();
    const { data: clauses } = useClauses();
    const { data: documentTypes } = useDocumentTypes();
    const [searchQuery, setSearchQuery] = useState("");
    const [wizardOpen, setWizardOpen] = useState(false);
    const [pendingApprovals, setPendingApprovals] = useState(0);
    const [overdueDeadlines, setOverdueDeadlines] = useState(0);

    const emailIngestEnabled = useFeatureEnabled("enable_email_ingest");

    const [onboardingDismissed, setOnboardingDismissed] = useState(() =>
        localStorage.getItem("onboarding-dismissed") === "true"
    );
    const navigate = useNavigate();

    const firstName = user ? getFirstName(user.email) : null;

    // Fetch lightweight counts for greeting subtitle
    useEffect(() => {
        api.get<{ clauses: unknown[]; total: number }>("/api/v1/clause-approval/pending")
            .then(({ data }) => setPendingApprovals(data.total))
            .catch(() => {});
        api.get<{ overdue_count: number }>("/api/v1/deadlines/summary")
            .then(({ data }) => setOverdueDeadlines(data.overdue_count))
            .catch(() => {});
    }, []);

    const isLoading = statsLoading;
    const openDrafts = stats?.open_drafts ?? 0;
    const totalOpenTasks = openDrafts + pendingApprovals + overdueDeadlines;
    const hasPendingTasks = totalOpenTasks > 0;
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

    return (
        <div className="space-y-8 animate-enter">
            {/* ── Hero Banner ── */}
            <div className="bg-hero-gradient rounded-2xl px-8 py-6 text-white relative overflow-hidden shadow-hero">
                {/* Decorative overlay */}
                <div
                    className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{
                        backgroundImage:
                            "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(110,189,132,0.3) 0%, transparent 50%)",
                    }}
                />
                <div className="relative z-10">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight text-white">
                            {getGreeting()}{firstName ? `, ${firstName}` : ""}
                        </h1>
                        <p className="text-white/70 mt-2 text-lg font-light">
                            {hasNoDocumentTypes
                                ? "Richte deine erste Dokumentvorlage ein"
                                : hasPendingTasks
                                ? `Du hast ${totalOpenTasks} offene ${totalOpenTasks === 1 ? "Aufgabe" : "Aufgaben"}`
                                : "Alles erledigt \u2014 Zeit für neue Projekte!"}
                        </p>
                        {/* Quick inline stats */}
                        <div className="flex gap-8 mt-5">
                            <div>
                                {isLoading ? (
                                    <Skeleton className="h-8 w-10 bg-white/20 rounded" />
                                ) : (
                                    <p className="text-3xl font-light tracking-tight">
                                        {stats?.documents_this_month ?? 0}
                                    </p>
                                )}
                                <p className="text-[11px] text-white/50 uppercase tracking-wider mt-1">
                                    Diesen Monat
                                </p>
                            </div>
                            <div>
                                {isLoading ? (
                                    <Skeleton className="h-8 w-10 bg-white/20 rounded" />
                                ) : (
                                    <p className="text-3xl font-light tracking-tight">
                                        {stats?.open_drafts ?? 0}
                                    </p>
                                )}
                                <p className="text-[11px] text-white/50 uppercase tracking-wider mt-1">
                                    Offen
                                </p>
                            </div>
                            <div>
                                {isLoading ? (
                                    <Skeleton className="h-8 w-10 bg-white/20 rounded" />
                                ) : (
                                    <p className="text-3xl font-light tracking-tight">
                                        {stats?.documents_total ?? 0}
                                    </p>
                                )}
                                <p className="text-[11px] text-white/50 uppercase tracking-wider mt-1">
                                    Gesamt
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Search Bar inside Hero */}
                    <form onSubmit={handleSearch} className="mt-6">
                        <div className="relative group max-w-2xl">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70 group-focus-within:text-white/90 transition-colors" />
                            <Input
                                type="text"
                                placeholder="Dokumente, Vorlagen oder Personen suchen..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-11 h-11 bg-white/10 text-white placeholder:text-white/40 focus-visible:!shadow-[inset_0_-2px_0_0_rgba(255,255,255,0.5)] shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.2)] transition-all rounded-xl text-sm"
                                data-global-search
                            />
                            {searchQuery.trim() && (
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/70 bg-white/10 px-2 py-0.5 rounded">
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
            <div className="space-y-8">
                {/* Quick Templates - nur anzeigen wenn Dokumenttypen vorhanden */}
                {!hasNoDocumentTypes && <QuickTemplates />}

                {/* AI Document Creation - nur anzeigen wenn Dokumenttypen vorhanden */}
                {!hasNoDocumentTypes && (
                <div className="ive-card p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                        <Sparkles className="w-32 h-32" />
                    </div>
                    <div className="flex items-center gap-4 mb-4 relative z-10">
                        <div className="p-3 bg-primary/10 rounded-xl">
                            <Sparkles className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-semibold tracking-tight text-foreground">KI-Dokumentassistent</h2>
                            <p className="text-sm text-muted-foreground">
                                Beschreibe, welches Dokument du benötigst — die KI führt dich durch den Prozess.
                            </p>
                        </div>
                        <Link
                            to="/agent"
                            className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                        >
                            Vollansicht
                            <ChevronRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="relative z-10">
                        <DocumentWizardChat
                            compact
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

                {/* Action Summary — Handlungsbedarf auf einen Blick */}
                {!hasNoDocumentTypes && (
                    <ActionSummaryCards
                        onFilterChange={(filter) => {
                            if (filter) {
                                navigate(`/documents?action=${filter}`);
                            } else {
                                navigate("/documents");
                            }
                        }}
                    />
                )}

                {/* Widgets Row - only renders when widgets have data */}
                <div className="grid gap-6 md:grid-cols-2">
                    <DeadlinesWidget limit={4} showStats={true} />
                    <ApprovalRequestsWidget limit={3} />
                </div>

                {/* Email-to-Draft Widget - only when feature is enabled */}
                {emailIngestEnabled && <EmailDraftsWidget />}

            </div>

            <DocumentWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />

        </div>
    );
};
