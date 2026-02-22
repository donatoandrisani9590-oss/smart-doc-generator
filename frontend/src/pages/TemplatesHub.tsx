/**
 * TemplatesHub - Eigenständige Seite für Vorlagen-Verwaltung (§12)
 *
 * Separiert von SettingsHub, um Vorlagen-Erstellung von System-Einstellungen zu trennen.
 *
 * 5 horizontale Tabs:
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
                <TextReveal as="h1" className="text-[28px] font-extrabold tracking-[-0.03em] text-[var(--text-primary)]" stagger={0.04} duration={0.6}>Vorlagen</TextReveal>
                <p className="text-[14px] text-[var(--text-secondary)] mt-1">
                    Dokumentvorlagen, Textbausteine und Formularfelder verwalten
                </p>
            </div>

            {/* Horizontal Tab Bar (§12 spec: tab-based nav) */}
            <div className="border-b border-[var(--border)] mb-6">
                <nav className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px" aria-label="Vorlagen-Tabs">
                    {TEMPLATE_TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                role="tab"
                                aria-selected={isActive}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-3 text-[13.5px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
                                    isActive
                                        ? "border-[var(--nw-blue)] text-[var(--text-primary)] font-semibold"
                                        : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border)]"
                                )}
                            >
                                <tab.icon className={cn(
                                    "w-4 h-4 shrink-0",
                                    isActive ? "text-[var(--nw-blue)]" : "text-[var(--text-muted)]"
                                )} />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {ActiveComponent ? (
                    <Suspense fallback={<TabSkeleton />}>
                        <ActiveComponent />
                    </Suspense>
                ) : (
                    <TabSkeleton />
                )}
            </div>
        </div>
    );
}
