/**
 * Breadcrumb Component
 *
 * Navigation-Pfad für bessere Orientierung in der App.
 * Zeigt den aktuellen Standort und ermöglicht Navigation zu übergeordneten Seiten.
 */

import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
    /** Label das angezeigt wird */
    label: string;
    /** URL zum Navigieren (optional für letztes Element) */
    href?: string;
    /** Icon (optional) */
    icon?: React.ComponentType<{ className?: string }>;
}

export interface BreadcrumbProps {
    /** Liste der Breadcrumb-Items */
    items?: BreadcrumbItem[];
    /** Home-Link anzeigen */
    showHome?: boolean;
    /** Separator zwischen Items */
    separator?: React.ReactNode;
    /** Zusätzliche CSS-Klassen */
    className?: string;
}

/**
 * Route-zu-Label Mapping für automatische Breadcrumbs
 */
const routeLabels: Record<string, string> = {
    "/": "Übersicht",
    "/generate": "Neues Dokument",
    "/bulk": "Massen-Import",
    "/documents": "Dokumentarchiv",
    "/search": "Suche",
    "/teams": "Teams",
    "/deadlines": "Fristen",
    "/composer": "Dokument-Designer",
    "/notifications": "Benachrichtigungen",
    "/admin": "Einstellungen",
    "/admin/company-settings": "Firmendaten",
    "/admin/settings": "Design",
    "/admin/clauses": "Textbausteine",
    "/admin/attachments": "Anlagen",
    "/admin/types": "Dokumentvorlagen",
    "/admin/template-preview": "Vorschau testen",
    "/admin/form-fields": "Formularfelder",
    "/admin/document-designer": "Layout-Editor",
    "/admin/works-council": "Betriebsrat",
    "/admin/retention": "Aufbewahrung",
    "/admin/users": "Benutzer",
    "/admin/clause-approvals": "Freigaben",
    "/admin/audit": "Protokoll",
};

/**
 * Generiert automatisch Breadcrumb-Items basierend auf dem aktuellen Pfad
 */
export const useAutoBreadcrumbs = (): BreadcrumbItem[] => {
    const location = useLocation();
    const pathSegments = location.pathname.split("/").filter(Boolean);

    const items: BreadcrumbItem[] = [];
    let currentPath = "";

    for (const segment of pathSegments) {
        currentPath += `/${segment}`;
        const label = routeLabels[currentPath] || decodeURIComponent(segment);

        items.push({
            label,
            href: currentPath,
        });
    }

    // Letztes Item ohne Link (aktuelle Seite)
    if (items.length > 0) {
        items[items.length - 1].href = undefined;
    }

    return items;
};

/**
 * Einzelnes Breadcrumb-Item
 */
const BreadcrumbItemComponent = ({
    item,
    isLast,
}: {
    item: BreadcrumbItem;
    isLast: boolean;
}) => {
    const Icon = item.icon;

    const content = (
        <span className="flex items-center gap-1.5">
            {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
            <span>{item.label}</span>
        </span>
    );

    if (isLast || !item.href) {
        return (
            <span
                className="text-sm font-medium text-foreground"
                aria-current="page"
            >
                {content}
            </span>
        );
    }

    return (
        <Link
            to={item.href}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
            {content}
        </Link>
    );
};

/**
 * Breadcrumb-Komponente
 */
export const Breadcrumb = ({
    items,
    showHome = true,
    separator,
    className,
}: BreadcrumbProps) => {
    const autoItems = useAutoBreadcrumbs();
    const displayItems = items || autoItems;

    // Keine Breadcrumbs auf der Startseite anzeigen
    if (displayItems.length === 0) {
        return null;
    }

    const separatorElement = separator || (
        <ChevronRight className="w-4 h-4 text-muted-foreground/50" aria-hidden="true" />
    );

    return (
        <nav
            className={cn("flex items-center gap-2", className)}
            aria-label="Breadcrumb"
        >
            {showHome && (
                <>
                    <Link
                        to="/"
                        className="text-muted-foreground hover:text-primary transition-colors"
                        aria-label="Zur Startseite"
                    >
                        <Home className="w-4 h-4" aria-hidden="true" />
                    </Link>
                    {displayItems.length > 0 && separatorElement}
                </>
            )}

            {displayItems.map((item, index) => (
                <React.Fragment key={index}>
                    <BreadcrumbItemComponent
                        item={item}
                        isLast={index === displayItems.length - 1}
                    />
                    {index < displayItems.length - 1 && separatorElement}
                </React.Fragment>
            ))}
        </nav>
    );
};

/**
 * PageHeader mit integrierter Breadcrumb
 * Kombiniert Breadcrumb mit Seitentitel für konsistente Header
 */
export interface PageHeaderProps {
    /** Seitentitel */
    title: string;
    /** Beschreibung unter dem Titel */
    description?: string;
    /** Breadcrumb anzeigen */
    showBreadcrumb?: boolean;
    /** Benutzerdefinierte Breadcrumb-Items */
    breadcrumbItems?: BreadcrumbItem[];
    /** Aktions-Buttons rechts */
    actions?: React.ReactNode;
    /** Zusätzliche CSS-Klassen */
    className?: string;
}

export const PageHeader = ({
    title,
    description,
    showBreadcrumb = true,
    breadcrumbItems,
    actions,
    className,
}: PageHeaderProps) => {
    return (
        <div className={cn("space-y-4", className)}>
            {showBreadcrumb && (
                <Breadcrumb items={breadcrumbItems} className="mb-2" />
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        {title}
                    </h1>
                    {description && (
                        <p className="text-muted-foreground mt-1">{description}</p>
                    )}
                </div>

                {actions && <div className="flex items-center gap-3">{actions}</div>}
            </div>
        </div>
    );
};

export default Breadcrumb;
