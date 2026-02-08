/**
 * SettingsHub - Zentrale Einstellungsseite mit Sidebar-Navigation
 *
 * Sidebar-Layout (wie GitHub/Notion Settings):
 * - Links: Kategorisierte Navigation (6 Gruppen, 16 Eintraege)
 * - Rechts: Content-Area mit lazy-loaded Komponenten
 * - Mobile: Horizontale Scroll-Leiste statt Sidebar
 */

import { useState, useEffect, lazy, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    Building2,
    Palette,
    FileText,
    BookOpen,
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
    Search,
    Bot,
} from "lucide-react";
import { SettingsCommandPalette } from "@/components/settings/SettingsCommandPalette";

// Lazy load sub-pages
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
const CopilotStudioSettings = lazy(() => import("@/components/settings/CopilotStudioSettings").then(m => ({ default: m.CopilotStudioSettings })));

// ═══════════════════════════════════════════════════════════════════════════
// Navigation Structure - 6 Groups, 16 Items
// ═══════════════════════════════════════════════════════════════════════════

interface SettingsNavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    component: React.LazyExoticComponent<React.ComponentType>;
}

interface SettingsNavGroup {
    id: string;
    label: string;
    items: SettingsNavItem[];
}

const SETTINGS_NAV: SettingsNavGroup[] = [
    {
        id: "allgemein",
        label: "Allgemein",
        items: [
            { id: "general", label: "Firmendaten", icon: Building2, component: CompanySettingsPage },
            { id: "features", label: "Funktionen", icon: ToggleRight, component: FeatureSettingsPanel },
        ],
    },
    {
        id: "dokumente",
        label: "Dokumente",
        items: [
            { id: "templates", label: "Vorlagen", icon: FileText, component: DocumentTypesManager },
            { id: "clauses", label: "Textbausteine", icon: BookOpen, component: ClausesPage },
            { id: "form-fields", label: "Formularfelder", icon: FormInput, component: FormFieldsManager },
            { id: "attachments", label: "Anlagen", icon: Paperclip, component: AttachmentsPage },
        ],
    },
    {
        id: "design-layout",
        label: "Design & Layout",
        items: [
            { id: "design", label: "Branding", icon: Palette, component: DesignManager },
            { id: "designer", label: "Layout-Editor", icon: Layout, component: DocumentDesigner },
            { id: "preview", label: "Vorschau", icon: Eye, component: TemplatePreviewPage },
        ],
    },
    {
        id: "verwaltung",
        label: "Verwaltung",
        items: [
            { id: "users", label: "Benutzer", icon: Users, component: UsersPage },
            { id: "approvals", label: "Freigaben", icon: CheckSquare, component: ClauseApprovalQueue },
            { id: "works-council", label: "Betriebsrat", icon: UserCheck, component: WorksCouncilTemplatesPage },
        ],
    },
    {
        id: "compliance",
        label: "Compliance",
        items: [
            { id: "retention", label: "Aufbewahrung", icon: Archive, component: RetentionPoliciesPage },
            { id: "audit", label: "Protokoll", icon: Shield, component: AuditLogPage },
        ],
    },
    {
        id: "integrationen",
        label: "Integrationen",
        items: [
            { id: "integrations", label: "Copilot Studio", icon: Bot, component: CopilotStudioSettings },
        ],
    },
];

// Flat lookup for quick access
const ALL_ITEMS = SETTINGS_NAV.flatMap(g => g.items);

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

// ═══════════════════════════════════════════════════════════════════════════
// Legacy Route Map
// ═══════════════════════════════════════════════════════════════════════════

const LEGACY_ROUTE_MAP: Record<string, string> = {
    "company-settings": "general",
    "settings": "design",
    "types": "templates",
    "clauses": "clauses",
    "users": "users",
    "clause-approvals": "approvals",
    "attachments": "attachments",
    "form-fields": "form-fields",
    "document-designer": "designer",
    "template-preview": "preview",
    "works-council": "works-council",
    "retention": "retention",
    "audit": "audit",
};

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function SettingsHub() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

    // Determine initial tab (with backward compatibility for ?tab=advanced&section=xxx)
    const getInitialTab = (): string => {
        const tab = searchParams.get("tab") || "general";
        const section = searchParams.get("section");

        // Legacy: ?tab=advanced&section=users -> users
        if (tab === "advanced" && section) {
            return ALL_ITEMS.some(i => i.id === section) ? section : "general";
        }

        // Validate tab exists
        if (ALL_ITEMS.some(i => i.id === tab)) {
            return tab;
        }

        return "general";
    };

    const [activeTab, setActiveTab] = useState(getInitialTab);

    // Sync URL with active tab
    useEffect(() => {
        const params = new URLSearchParams();
        params.set("tab", activeTab);
        setSearchParams(params, { replace: true });
    }, [activeTab, setSearchParams]);

    // Handle legacy /admin/* routes
    useEffect(() => {
        const path = window.location.pathname;
        if (path.startsWith("/admin/")) {
            const segment = path.replace("/admin/", "").split("/")[0];
            const mapping = LEGACY_ROUTE_MAP[segment];
            if (mapping) {
                setActiveTab(mapping);
                navigate(`/settings?tab=${mapping}`, { replace: true });
            }
        }
    }, [navigate]);

    // Render active content
    const activeItem = ALL_ITEMS.find(i => i.id === activeTab);
    const ActiveComponent = activeItem?.component;

    return (
        <div className="max-w-6xl mx-auto">
            {/* Command Palette */}
            <SettingsCommandPalette
                open={commandPaletteOpen}
                onOpenChange={setCommandPaletteOpen}
            />

            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-foreground">Einstellungen</h1>
                    <p className="text-muted-foreground mt-1">
                        Firmendaten, Design, Vorlagen und Verwaltung
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCommandPaletteOpen(true)}
                    className="gap-2 h-9"
                >
                    <Search className="h-4 w-4" />
                    <span className="hidden sm:inline">Suchen</span>
                    <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-warm-100 px-1.5 font-mono text-[10px] font-medium text-muted-foreground ml-2">
                        {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+K
                    </kbd>
                </Button>
            </div>

            {/* Main Layout: Sidebar + Content */}
            <div className="flex flex-col md:flex-row border border-warm-200 dark:border-warm-200 rounded-lg bg-white dark:bg-card overflow-hidden min-h-[600px]">

                {/* Mobile: Horizontal Scroll Nav */}
                <div className="md:hidden overflow-x-auto border-b border-warm-200 dark:border-warm-200 bg-warm-50/50 dark:bg-muted/30 px-2 py-2">
                    <div className="flex gap-1 min-w-max">
                        {ALL_ITEMS.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors",
                                    activeTab === item.id
                                        ? "bg-primary/15 text-primary font-medium dark:bg-primary/20"
                                        : "text-muted-foreground hover:bg-warm-100 dark:hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <item.icon className="w-3.5 h-3.5" />
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Desktop: Sidebar Navigation */}
                <nav className="hidden md:block w-[240px] shrink-0 border-r border-warm-200 dark:border-warm-200 overflow-y-auto scrollbar-hide py-4 bg-warm-50/30 dark:bg-warm-50/50">
                    {SETTINGS_NAV.map((group) => (
                        <div key={group.id} className="mb-4">
                            <h3 className="settings-nav-header px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest">
                                {group.label}
                            </h3>
                            <div className="space-y-0.5 mt-1">
                                {group.items.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveTab(item.id)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg mx-1 transition-all",
                                            activeTab === item.id
                                                ? "settings-nav-item-active bg-warm-100 dark:bg-primary/20 font-medium border-l-2 border-primary"
                                                : "settings-nav-item hover:bg-warm-50 dark:hover:bg-muted/50"
                                        )}
                                    >
                                        <item.icon className={cn(
                                            "w-4 h-4 shrink-0 transition-colors",
                                            activeTab === item.id
                                                ? "settings-nav-icon-active"
                                                : "settings-nav-icon"
                                        )} />
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Content Area */}
                <div className="flex-1 min-w-0 p-6 overflow-y-auto">
                    {ActiveComponent ? (
                        <Suspense fallback={<TabSkeleton />}>
                            <ActiveComponent />
                        </Suspense>
                    ) : (
                        <TabSkeleton />
                    )}
                </div>
            </div>
        </div>
    );
}
