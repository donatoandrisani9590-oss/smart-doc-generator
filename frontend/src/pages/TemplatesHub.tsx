/**
 * TemplatesHub - Eigenständige Seite für Vorlagen-Verwaltung
 *
 * Separiert von SettingsHub, um Vorlagen-Erstellung von System-Einstellungen zu trennen.
 * Test-User haben sich in der 17-Tab SettingsHub verirrt beim Anlegen von Vorlagen.
 *
 * 5 Tabs:
 * - Dokumentvorlagen (DocumentTypesManager)
 * - Textbausteine (ClausesPage)
 * - Formularfelder (FormFieldsManager)
 * - Anlagen (AttachmentsPage)
 * - Eigene Vorlagen (UserTemplatesPage)
 */

import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
    FileText,
    BookOpen,
    FormInput,
    Paperclip,
    LayoutTemplate,
} from "lucide-react";
import { TextReveal } from "@/components/ui/text-reveal";

// Lazy load sub-pages
const DocumentTypesManager = lazy(() => import("./admin/DocumentTypesManager").then(m => ({ default: m.DocumentTypesManager })));
const ClausesPage = lazy(() => import("./admin/ClausesPage").then(m => ({ default: m.ClausesPage })));
const FormFieldsManager = lazy(() => import("./admin/FormFieldsManager").then(m => ({ default: m.FormFieldsManager })));
const AttachmentsPage = lazy(() => import("./admin/AttachmentsPage").then(m => ({ default: m.AttachmentsPage })));
const UserTemplatesPage = lazy(() => import("./admin/UserTemplatesPage").then(m => ({ default: m.UserTemplatesPage })));

interface TemplateTab {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    component: React.LazyExoticComponent<React.ComponentType>;
}

const TEMPLATE_TABS: TemplateTab[] = [
    { id: "types", label: "Dokumentvorlagen", icon: FileText, component: DocumentTypesManager },
    { id: "clauses", label: "Textbausteine", icon: BookOpen, component: ClausesPage },
    { id: "form-fields", label: "Formularfelder", icon: FormInput, component: FormFieldsManager },
    { id: "attachments", label: "Anlagen", icon: Paperclip, component: AttachmentsPage },
    { id: "user-templates", label: "Eigene Vorlagen", icon: LayoutTemplate, component: UserTemplatesPage },
];

// Legacy tab aliases for backward compatibility
const TAB_ALIASES: Record<string, string> = {
    templates: "types",
};

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

export default function TemplatesHub() {
    const [searchParams, setSearchParams] = useSearchParams();

    const resolveTab = (tab: string): string => TAB_ALIASES[tab] || tab;

    const getInitialTab = (): string => {
        const rawTab = searchParams.get("tab") || "types";
        const tab = resolveTab(rawTab);
        return TEMPLATE_TABS.some(t => t.id === tab) ? tab : "types";
    };

    const [activeTab, setActiveTab] = useState(getInitialTab);

    // Sync URL → state
    useEffect(() => {
        const rawTab = searchParams.get("tab");
        if (rawTab) {
            const tab = resolveTab(rawTab);
            if (tab !== activeTab && TEMPLATE_TABS.some(t => t.id === tab)) {
                setActiveTab(tab);
            }
        }
    }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync state → URL
    useEffect(() => {
        const params = new URLSearchParams();
        params.set("tab", activeTab);
        setSearchParams(params, { replace: true });
    }, [activeTab, setSearchParams]);

    const activeItem = useMemo(
        () => TEMPLATE_TABS.find(t => t.id === activeTab),
        [activeTab]
    );
    const ActiveComponent = activeItem?.component;

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <TextReveal as="h1" className="text-2xl font-semibold tracking-tight text-foreground" stagger={0.04} duration={0.6}>Vorlagen</TextReveal>
                <p className="text-sm text-muted-foreground/60 mt-1">
                    Dokumentvorlagen, Textbausteine und Formularfelder verwalten
                </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-col md:flex-row ive-card overflow-hidden min-h-[600px] md:h-[calc(100vh-10rem)]">
                {/* Mobile: Horizontal Scroll Nav */}
                <div className="md:hidden overflow-x-auto px-2 py-2">
                    <div className="flex gap-1 min-w-max">
                        {TEMPLATE_TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors",
                                    activeTab === tab.id
                                        ? "bg-muted/50 text-foreground font-medium"
                                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                                )}
                            >
                                <tab.icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Desktop: Sidebar Navigation */}
                <nav className="hidden md:block w-[220px] shrink-0 overflow-y-auto scrollbar-hide py-4">
                    <div className="space-y-0.5 px-1.5">
                        {TEMPLATE_TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "w-full flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-lg transition-all",
                                    activeTab === tab.id
                                        ? "bg-muted/50 text-foreground font-medium"
                                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                                )}
                            >
                                <tab.icon className={cn(
                                    "w-4 h-4 shrink-0 transition-colors",
                                    activeTab === tab.id
                                        ? "text-primary/70"
                                        : "text-muted-foreground/50"
                                )} />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </nav>

                {/* Content Area */}
                <div className="flex-1 min-w-0 p-6 lg:p-8 overflow-y-auto bg-muted/30 border-l border-warm-100">
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
