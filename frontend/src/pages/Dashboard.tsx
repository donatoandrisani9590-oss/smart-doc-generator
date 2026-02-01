/**
 * Dashboard - Moderne, aufgeräumte Übersicht
 *
 * UX-Refactoring: Fokus auf das Wesentliche
 * - Persönliche Begrüßung
 * - Offene Aufgaben im Vordergrund
 * - Schneller Zugriff auf häufige Aktionen
 * - Keine technischen Details
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
    PlusCircle,
    FileCheck,
    Clock,
    FileText,
    ArrowRight,
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
    const navigate = useNavigate();

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
        <div className="space-y-8 max-w-5xl mx-auto">
            {/* Persönliche Begrüßung */}
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">
                    {getGreeting()}! 👋
                </h1>
                <p className="text-muted-foreground text-lg">
                    {hasPendingTasks
                        ? "Sie haben offene Aufgaben. Hier ist Ihre Übersicht."
                        : "Alles erledigt. Bereit für neue Dokumente?"}
                </p>
            </div>

            {/* Globale Suche */}
            <form onSubmit={handleSearch}>
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Suchen Sie nach etwas?"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 h-12 text-base"
                        data-global-search
                    />
                </div>
            </form>

            {/* Quick Templates - Top 3 Dokumenttypen */}
            <QuickTemplates />

            {/* Smart Document Creation - AI-Powered Hero */}
            <div className="rounded-3xl p-8 bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-200">
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
                                <Sparkles className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold mb-1">Neues Dokument erstellen</h2>
                                <p className="text-indigo-100 text-lg">
                                    Beschreiben Sie einfach, was Sie brauchen
                                </p>
                            </div>
                        </div>
                        <Button
                            size="lg"
                            variant="secondary"
                            className="gap-2 bg-white/20 text-white hover:bg-white/30 border-0 h-14 px-6 text-base font-semibold backdrop-blur-sm"
                            onClick={() => setWizardOpen(true)}
                        >
                            <PlusCircle className="w-5 h-5" />
                            Wizard starten
                        </Button>
                    </div>

                    {/* Smart Chat Input - Main Entry Point */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                        <SmartChatInput
                            placeholder="z.B. 'Erstelle einen Arbeitsvertrag für Max Müller, 5000€ Gehalt'"
                            showSuggestions={true}
                            onCreateDocument={(docType, initialData) => {
                                // Navigate to generator with pre-filled data
                                const params = new URLSearchParams();
                                params.set("type", docType);
                                if (Object.keys(initialData).length > 0) {
                                    params.set("data", JSON.stringify(initialData));
                                }
                                navigate(`/generate?${params.toString()}`);
                            }}
                            className="[&_input]:bg-white [&_input]:text-gray-900 [&_input]:placeholder:text-gray-500"
                        />
                    </div>
                </div>
            </div>

            {/* Hauptbereich: 2 Spalten */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Linke Spalte: Offene Entwürfe */}
                <div className="card-floating rounded-2xl p-6">
                    <div className="flex flex-row items-center justify-between pb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-50 rounded-xl">
                                <Clock className="w-5 h-5 text-amber-500" />
                            </div>
                            <h3 className="font-semibold text-lg">Weitermachen</h3>
                        </div>
                        {hasOpenDrafts && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold">
                                {stats?.open_drafts} offen
                            </span>
                        )}
                    </div>
                    <div className="space-y-3">
                        {isLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-20 w-full rounded-xl" />
                                <Skeleton className="h-20 w-full rounded-xl" />
                            </div>
                        ) : activity?.recent_drafts && activity.recent_drafts.length > 0 ? (
                            <div className="space-y-3">
                                {activity.recent_drafts.slice(0, 4).map((draft: any) => {
                                    const daysRemaining = draft.days_remaining ?? 30;
                                    const isExpiringSoon = daysRemaining <= 7;

                                    return (
                                        <Link
                                            key={draft.id}
                                            to={`/generate?draft=${draft.id}`}
                                            className={`flex items-center justify-between p-4 rounded-xl border transition-all group ${isExpiringSoon
                                                ? "border-amber-200 bg-amber-50/50 hover:bg-amber-50"
                                                : "border-gray-100 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/5 bg-white"
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-xl transition-colors ${isExpiringSoon
                                                    ? "bg-amber-100 group-hover:bg-amber-200"
                                                    : "bg-gray-50 group-hover:bg-indigo-50 text-gray-500 group-hover:text-indigo-600"
                                                    }`}>
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900">
                                                        {draft.document_type_name || draft.name || "Entwurf"}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {draft.name && draft.document_type_name && (
                                                            <p className="text-xs text-muted-foreground">
                                                                {draft.name}
                                                            </p>
                                                        )}
                                                        {/* TTL-Warnung */}
                                                        {isExpiringSoon && (
                                                            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                                                                <AlertTriangle className="w-3 h-3" />
                                                                {daysRemaining === 0
                                                                    ? "Läuft heute ab!"
                                                                    : `Noch ${daysRemaining} Tage`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground font-medium bg-gray-50 px-2 py-1 rounded-md">
                                                    {draft.updated_at && formatDistanceToNow(draft.updated_at)}
                                                </span>
                                                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white shadow-sm flex items-center justify-center">
                                    <FileCheck className="w-8 h-8 text-green-500" />
                                </div>
                                <p className="font-semibold text-gray-900">Alles erledigt!</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Keine offenen Entwürfe vorhanden
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Rechte Spalte: Letzte Dokumente */}
                <div className="card-floating rounded-2xl p-6">
                    <div className="flex flex-row items-center justify-between pb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-50 rounded-xl">
                                <FileCheck className="w-5 h-5 text-green-500" />
                            </div>
                            <h3 className="font-semibold text-lg">Zuletzt erstellt</h3>
                        </div>
                        <Link to="/documents">
                            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-indigo-600">
                                Alle anzeigen
                                <ArrowRight className="w-3 h-3" />
                            </Button>
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {activityLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-20 w-full rounded-xl" />
                                <Skeleton className="h-20 w-full rounded-xl" />
                            </div>
                        ) : activity?.recent_documents && activity.recent_documents.length > 0 ? (
                            <div className="space-y-3">
                                {activity.recent_documents.slice(0, 4).map((doc) => (
                                    <Link
                                        key={doc.id}
                                        to={`/documents/${doc.id}`}
                                        className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/5 bg-white transition-all group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-green-50 rounded-xl group-hover:bg-green-100 transition-colors">
                                                <FileCheck className="w-5 h-5 text-green-600" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900">
                                                    {doc.document_type_name}
                                                </p>
                                                {doc.employee_name && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {doc.employee_name}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-gray-400 font-medium bg-gray-50 px-2 py-1 rounded-md">
                                                {doc.created_at && formatDistanceToNow(doc.created_at)}
                                            </span>
                                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white shadow-sm flex items-center justify-center">
                                    <FileText className="w-8 h-8 text-gray-300" />
                                </div>
                                <p className="font-semibold text-gray-900">Noch keine Dokumente</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Erstellen Sie Ihr erstes Dokument
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Kompakte Statistik-Zeile */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Card className="bg-muted/30">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <FileText className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">
                                    {isLoading ? "-" : stats?.documents_this_month ?? 0}
                                </p>
                                <p className="text-xs text-muted-foreground">Diesen Monat</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-muted/30">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-50 rounded-lg">
                                <Calendar className="w-4 h-4 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">
                                    {isLoading ? "-" : stats?.documents_total ?? 0}
                                </p>
                                <p className="text-xs text-muted-foreground">Insgesamt</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-muted/30">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-50 rounded-lg">
                                <Clock className="w-4 h-4 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">
                                    {isLoading ? "-" : stats?.open_drafts ?? 0}
                                </p>
                                <p className="text-xs text-muted-foreground">Entwürfe</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-muted/30">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-50 rounded-lg">
                                <FileCheck className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">
                                    {isLoading ? "-" : stats?.bulk_jobs_this_month ?? 0}
                                </p>
                                <p className="text-xs text-muted-foreground">Massen-Jobs</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <DocumentWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />
        </div >
    );
};
