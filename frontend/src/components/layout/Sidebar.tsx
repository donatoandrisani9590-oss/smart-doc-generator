import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
    Keyboard,
    FolderOpen,
    Settings2,
    Globe,
    ChevronDown,
    LayoutTemplate,
    Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FavoritesList } from "./FavoritesList";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { UserDropdown } from "./UserDropdown";
import { useFeatureEnabled } from "@/hooks/useFeatureSettings";

interface SidebarItemProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    href: string;
    active: boolean;
    badge?: string;
    collapsed?: boolean;
}

const SidebarItem = ({ icon: Icon, label, href, active, badge, collapsed }: SidebarItemProps) => (
    <Link
        to={href}
        title={collapsed ? label : undefined}
        className={cn(
            "group flex items-center transition-all rounded-lg mx-1",
            collapsed
                ? "justify-center px-0 py-2.5"
                : "justify-between px-3 py-2.5 text-sm",
            active
                ? "bg-muted/40 text-foreground font-semibold"
                : "text-foreground/50 hover:bg-muted/30 hover:text-foreground"
        )}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? label : undefined}
    >
        <div className={cn("flex items-center", collapsed ? "gap-0" : "gap-3")}>
            <Icon className={cn(
                "shrink-0 transition-colors",
                collapsed ? "w-5 h-5" : "w-[18px] h-[18px]",
                active ? "text-foreground" : "text-foreground/40 group-hover:text-foreground/70"
            )} aria-hidden="true" />
            {!collapsed && <span>{label}</span>}
        </div>
        {!collapsed && badge && (
            <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                {badge}
            </span>
        )}
    </Link>
);

interface SidebarSectionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    collapsed?: boolean;
}

const SidebarSection = ({ title, children, defaultOpen = true, collapsed }: SidebarSectionProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={cn("space-y-1", collapsed ? "pt-2 first:pt-0" : "pt-4 first:pt-0")}>
            {!collapsed && (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-between w-full px-4 py-1.5 text-[10px] font-medium text-muted-foreground/30 uppercase tracking-widest hover:text-muted-foreground/50 transition-colors"
                >
                    {title}
                    <ChevronDown className={cn(
                        "w-3 h-3 text-muted-foreground/50 transition-transform",
                        isOpen && "rotate-180"
                    )} />
                </button>
            )}
            {(collapsed || isOpen) && (
                <div className="space-y-0.5">
                    {children}
                </div>
            )}
        </div>
    );
};

interface SidebarProps {
    collapsed?: boolean;
}

export const Sidebar = ({ collapsed = false }: SidebarProps) => {
    const location = useLocation();
    const pathname = location.pathname;
    const [showShortcuts, setShowShortcuts] = useState(false);
    const isDocumentsEnabled = useFeatureEnabled("show_documents_overview");

    // Global keyboard shortcut to open dialog (? key)
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        const target = event.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
            return;
        }
        if (event.key === "?") {
            event.preventDefault();
            setShowShortcuts(true);
        }
    }, []);

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    return (
        <>
            <KeyboardShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
            <div className={cn(
                "h-screen flex flex-col font-sans glass-sidebar transition-all duration-200",
                collapsed ? "w-16" : "w-[260px]"
            )}>
                {/* Logo Section - Niederwieser Corporate */}
                <div className={cn("h-16 flex items-center", collapsed ? "px-3 justify-center" : "px-5")}>
                    <Link to="/" className="flex items-center gap-3 group" title={collapsed ? "Niederwieser Docs" : undefined}>
                        <img
                            src="/niederwieser-logo-blue.svg"
                            alt="Niederwieser"
                            className={cn("w-auto dark:hidden", collapsed ? "h-5" : "h-7")}
                        />
                        <img
                            src="/niederwieser-logo.svg"
                            alt="Niederwieser"
                            className={cn("w-auto hidden dark:block", collapsed ? "h-5" : "h-7")}
                        />
                        {!collapsed && (
                            <>
                                <div className="h-5 w-px bg-foreground/10" />
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">
                                    Docs
                                </span>
                            </>
                        )}
                    </Link>
                </div>

                {/* Navigation */}
                <nav className={cn(
                    "flex-1 space-y-6 overflow-y-auto scrollbar-hide py-4",
                    collapsed ? "px-1 space-y-2" : "px-2"
                )}>
                    {/* Main Navigation */}
                    <SidebarSection title="Workspace" collapsed={collapsed}>
                        <SidebarItem
                            icon={Globe}
                            label="Übersicht"
                            href="/"
                            active={pathname === "/" || pathname === "/deadlines" || pathname === "/teams"}
                            collapsed={collapsed}
                        />
                        {isDocumentsEnabled && (
                        <SidebarItem
                            icon={FolderOpen}
                            label="Dokumente"
                            href="/documents"
                            active={pathname.startsWith("/documents") || pathname.startsWith("/search")}
                            collapsed={collapsed}
                        />
                        )}
                    </SidebarSection>

                    <SidebarSection title="Tools" collapsed={collapsed}>
                        <SidebarItem
                            icon={Sparkles}
                            label="KI-Assistent"
                            href="/agent"
                            active={pathname === "/agent"}
                            collapsed={collapsed}
                        />
                        <SidebarItem
                            icon={LayoutTemplate}
                            label="Vorlagen verwalten"
                            href="/settings?tab=templates"
                            active={pathname === "/settings" && location.search.includes("tab=templates")}
                            collapsed={collapsed}
                        />
                    </SidebarSection>

                    {/* Settings Section */}
                    <SidebarSection title="System" collapsed={collapsed}>
                        <SidebarItem
                            icon={Settings2}
                            label="Einstellungen"
                            href="/settings?tab=general"
                            active={
                                (pathname.startsWith("/settings") && !location.search.includes("tab=templates"))
                                || pathname.startsWith("/admin")
                            }
                            collapsed={collapsed}
                        />
                    </SidebarSection>

                    {/* Favorites - hidden when collapsed */}
                    {!collapsed && (
                        <div className="pt-2 px-2">
                            <FavoritesList />
                        </div>
                    )}
                </nav>

                {/* Bottom Section */}
                <div className="mt-auto">
                    {/* Keyboard Shortcuts Hint */}
                    <div className={cn("", collapsed ? "px-2 py-2" : "px-4 py-2")}>
                        <button
                            onClick={() => setShowShortcuts(true)}
                            title={collapsed ? "Tastenkürzel (?)" : undefined}
                            className={cn(
                                "w-full flex items-center py-2 text-xs text-muted-foreground hover:text-primary transition-colors",
                                collapsed ? "justify-center" : "justify-between"
                            )}
                        >
                            <div className={cn("flex items-center", collapsed ? "gap-0" : "gap-2")}>
                                <Keyboard className="w-3.5 h-3.5" />
                                {!collapsed && <span>Shortcuts</span>}
                            </div>
                            {!collapsed && (
                                <kbd className="px-1.5 py-0.5 bg-muted rounded-[4px] text-[10px] font-mono border border-border">?</kbd>
                            )}
                        </button>
                    </div>

                    {/* User Dropdown */}
                    <div className={cn(
                        "bg-muted/20",
                        collapsed ? "p-2" : "p-3"
                    )}>
                        <UserDropdown collapsed={collapsed} />
                    </div>
                </div>
            </div>
        </>
    );
};
