/**
 * SettingsHub - Zentrale Einstellungsseite
 *
 * UX-Refactoring: Sammelt alle Admin-Features in einer zentralen Seite mit Tabs.
 * Ersetzt die 12+ einzelnen Admin-Menüpunkte in der Sidebar.
 *
 * Struktur:
 * - Allgemein: Firmendaten, Logo
 * - Design: Farben, Schriften, Layout
 * - Vorlagen: Dokumenttypen verwalten
 * - Textbausteine: Klauseln bearbeiten
 * - Erweitert: Power-User Features
 */

import { useState, useEffect, lazy, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Building2,
    Palette,
    FileText,
    BookOpen,
    Settings2,
    Users,
    Shield,
    Archive,
    Paperclip,
    FormInput,
    UserCheck,
    CheckSquare,
    Layout,
    Eye,
    ToggleRight,
} from "lucide-react";

// Lazy load sub-pages (mit Named Export Handling für Module ohne Default-Export)
const CompanySettingsPage = lazy(() => import("./admin/CompanySettingsPage"));
const DesignManager = lazy(() => import("./admin/DesignManager").then(m => ({ default: m.DesignManager })));
const DocumentTypesManager = lazy(() => import("./admin/DocumentTypesManager").then(m => ({ default: m.DocumentTypesManager })));
const ClausesPage = lazy(() => import("./admin/ClausesPage").then(m => ({ default: m.ClausesPage })));
const AttachmentsPage = lazy(() => import("./admin/AttachmentsPage").then(m => ({ default: m.AttachmentsPage })));
const UsersPage = lazy(() => import("./admin/UsersPage").then(m => ({ default: m.UsersPage })));
const AuditLogPage = lazy(() => import("./admin/AuditLogPage").then(m => ({ default: m.AuditLogPage })));
const RetentionPoliciesPage = lazy(() => import("./admin/RetentionPoliciesPage"));
const FormFieldsManager = lazy(() => import("./admin/FormFieldsManager").then(m => ({ default: m.FormFieldsManager })));
const WorksCouncilTemplatesPage = lazy(() => import("./admin/WorksCouncilTemplatesPage"));
const ClauseApprovalQueue = lazy(() => import("./admin/ClauseApprovalQueue").then(m => ({ default: m.ClauseApprovalQueue })));
const DocumentDesigner = lazy(() => import("./admin/DocumentDesigner").then(m => ({ default: m.DocumentDesigner })));
const TemplatePreviewPage = lazy(() => import("./admin/TemplatePreviewPage").then(m => ({ default: m.TemplatePreviewPage })));
const FeatureSettingsPanel = lazy(() => import("@/components/settings/FeatureSettingsPanel").then(m => ({ default: m.FeatureSettingsPanel })));

// Tab definitions with icons and descriptions
const TABS = [
    {
        id: "general",
        label: "Allgemein",
        icon: Building2,
        description: "Firmendaten & Logo",
    },
    {
        id: "features",
        label: "Funktionen",
        icon: ToggleRight,
        description: "Feature-Toggles",
    },
    {
        id: "design",
        label: "Design",
        icon: Palette,
        description: "Farben, Schriften",
    },
    {
        id: "templates",
        label: "Vorlagen",
        icon: FileText,
        description: "Dokumenttypen",
    },
    {
        id: "clauses",
        label: "Textbausteine",
        icon: BookOpen,
        description: "Klauseln",
    },
    {
        id: "advanced",
        label: "Erweitert",
        icon: Settings2,
        description: "Power-User",
    },
];

// Loading placeholder
const TabSkeleton = () => (
    <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-4 mt-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
        </div>
    </div>
);

// Sub-navigation for Advanced tab
const ADVANCED_SECTIONS = [
    { id: "users", label: "Benutzer", icon: Users, component: UsersPage },
    { id: "approvals", label: "Freigaben", icon: CheckSquare, component: ClauseApprovalQueue },
    { id: "attachments", label: "Anlagen", icon: Paperclip, component: AttachmentsPage },
    { id: "form-fields", label: "Formularfelder", icon: FormInput, component: FormFieldsManager },
    { id: "designer", label: "Layout-Editor", icon: Layout, component: DocumentDesigner },
    { id: "preview", label: "Vorschau", icon: Eye, component: TemplatePreviewPage },
    { id: "works-council", label: "Betriebsrat", icon: UserCheck, component: WorksCouncilTemplatesPage },
    { id: "retention", label: "Aufbewahrung", icon: Archive, component: RetentionPoliciesPage },
    { id: "audit", label: "Protokoll", icon: Shield, component: AuditLogPage },
];

export default function SettingsHub() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "general");
    const [advancedSection, setAdvancedSection] = useState(searchParams.get("section") || "users");

    // Sync URL with active tab
    useEffect(() => {
        const params = new URLSearchParams();
        params.set("tab", activeTab);
        if (activeTab === "advanced") {
            params.set("section", advancedSection);
        }
        setSearchParams(params, { replace: true });
    }, [activeTab, advancedSection, setSearchParams]);

    // Handle legacy /admin/* routes
    useEffect(() => {
        const path = window.location.pathname;
        if (path.startsWith("/admin/")) {
            const segment = path.replace("/admin/", "").split("/")[0];
            // Map old routes to new tabs
            const routeMap: Record<string, { tab: string; section?: string }> = {
                "company-settings": { tab: "general" },
                "settings": { tab: "design" },
                "types": { tab: "templates" },
                "clauses": { tab: "clauses" },
                "users": { tab: "advanced", section: "users" },
                "clause-approvals": { tab: "advanced", section: "approvals" },
                "attachments": { tab: "advanced", section: "attachments" },
                "form-fields": { tab: "advanced", section: "form-fields" },
                "document-designer": { tab: "advanced", section: "designer" },
                "template-preview": { tab: "advanced", section: "preview" },
                "works-council": { tab: "advanced", section: "works-council" },
                "retention": { tab: "advanced", section: "retention" },
                "audit": { tab: "advanced", section: "audit" },
            };
            const mapping = routeMap[segment];
            if (mapping) {
                setActiveTab(mapping.tab);
                if (mapping.section) {
                    setAdvancedSection(mapping.section);
                }
                // Redirect to clean URL
                navigate(`/settings?tab=${mapping.tab}${mapping.section ? `&section=${mapping.section}` : ""}`, { replace: true });
            }
        }
    }, [navigate]);

    const renderAdvancedContent = () => {
        const section = ADVANCED_SECTIONS.find((s) => s.id === advancedSection);
        if (!section) return null;

        const Component = section.component;
        return (
            <Suspense fallback={<TabSkeleton />}>
                <Component />
            </Suspense>
        );
    };

    return (
        <div className="container mx-auto py-6 max-w-7xl">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Einstellungen</h1>
                <p className="text-muted-foreground">
                    Verwalten Sie Firmendaten, Design, Vorlagen und Textbausteine.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
                    {TABS.map((tab) => (
                        <TabsTrigger
                            key={tab.id}
                            value={tab.id}
                            className="flex items-center gap-2"
                        >
                            <tab.icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* Allgemein - Firmendaten */}
                <TabsContent value="general" className="space-y-4">
                    <Suspense fallback={<TabSkeleton />}>
                        <CompanySettingsPage />
                    </Suspense>
                </TabsContent>

                {/* Funktionen - Feature Toggles */}
                <TabsContent value="features" className="space-y-4">
                    <Suspense fallback={<TabSkeleton />}>
                        <FeatureSettingsPanel />
                    </Suspense>
                </TabsContent>

                {/* Design - Farben, Schriften */}
                <TabsContent value="design" className="space-y-4">
                    <Suspense fallback={<TabSkeleton />}>
                        <DesignManager />
                    </Suspense>
                </TabsContent>

                {/* Vorlagen - Dokumenttypen */}
                <TabsContent value="templates" className="space-y-4">
                    <Suspense fallback={<TabSkeleton />}>
                        <DocumentTypesManager />
                    </Suspense>
                </TabsContent>

                {/* Textbausteine - Klauseln */}
                <TabsContent value="clauses" className="space-y-4">
                    <Suspense fallback={<TabSkeleton />}>
                        <ClausesPage />
                    </Suspense>
                </TabsContent>

                {/* Erweitert - Sub-Navigation */}
                <TabsContent value="advanced" className="space-y-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex flex-wrap gap-2 mb-6">
                                {ADVANCED_SECTIONS.map((section) => (
                                    <button
                                        key={section.id}
                                        onClick={() => setAdvancedSection(section.id)}
                                        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                                            advancedSection === section.id
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                        }`}
                                    >
                                        <section.icon className="w-4 h-4" />
                                        {section.label}
                                    </button>
                                ))}
                            </div>
                            {renderAdvancedContent()}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
