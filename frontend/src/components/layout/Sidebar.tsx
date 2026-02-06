import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
    Keyboard,
    FolderOpen,
    Settings2,
    Globe,
    ChevronDown,
    PlusCircle,
    LayoutTemplate
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FavoritesList } from "./FavoritesList";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { UserDropdown } from "./UserDropdown";

interface SidebarItemProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    href: string;
    active: boolean;
    badge?: string;
}

const SidebarItem = ({ icon: Icon, label, href, active, badge }: SidebarItemProps) => (
    <Link
        to={href}
        className={cn(
            "group flex items-center justify-between px-3 py-2.5 text-sm transition-all rounded-lg mx-1",
            active
                ? "bg-primary/5 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
        aria-current={active ? "page" : undefined}
    >
        <div className="flex items-center gap-3">
            <Icon className={cn(
                "w-[18px] h-[18px] shrink-0 transition-colors",
                active ? "text-primary bg-primary/10 rounded-md p-0.5 w-5 h-5" : "text-muted-foreground group-hover:text-foreground"
            )} aria-hidden="true" />
            <span>{label}</span>
        </div>
        {badge && (
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
}

const SidebarSection = ({ title, children, defaultOpen = true }: SidebarSectionProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="space-y-1 pt-4 first:pt-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full px-4 py-1.5 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest hover:text-primary transition-colors"
            >
                {title}
                <ChevronDown className={cn(
                    "w-3 h-3 text-muted-foreground/50 transition-transform",
                    isOpen && "rotate-180"
                )} />
            </button>
            {isOpen && (
                <div className="space-y-0.5">
                    {children}
                </div>
            )}
        </div>
    );
};

export const Sidebar = () => {
    const location = useLocation();
    const pathname = location.pathname;
    const [showShortcuts, setShowShortcuts] = useState(false);

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
            <div className="w-[260px] h-screen flex flex-col font-sans glass-sidebar">
                {/* Logo Section - Clean & Modern */}
                <div className="h-16 flex items-center px-6">
                    <div className="flex flex-col">
                        <span className="text-lg font-bold tracking-tight text-primary flex items-center gap-2">
                            Docs<span className="font-light text-foreground">Gen</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground tracking-widest uppercase">
                            Niederwieser
                        </span>
                    </div>
                </div>

                {/* Primary Action Button */}
                <div className="px-4 mb-2">
                    <Link
                        to="/generate"
                        className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-soft-md hover:shadow-soft-lg py-2.5 rounded-lg text-sm font-medium active:scale-95"
                    >
                        <PlusCircle className="w-4 h-4" />
                        <span>Neues Dokument</span>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-2 space-y-6 overflow-y-auto scrollbar-hide py-4">
                    {/* Main Navigation */}
                    <SidebarSection title="Workspace">
                        <SidebarItem
                            icon={Globe}
                            label="Übersicht"
                            href="/"
                            active={pathname === "/" || pathname === "/deadlines" || pathname === "/teams"}
                        />
                        <SidebarItem
                            icon={FolderOpen}
                            label="Dokumente"
                            href="/documents"
                            active={pathname.startsWith("/documents") || pathname.startsWith("/search")}
                        />
                    </SidebarSection>

                    <SidebarSection title="Tools">
                        <SidebarItem
                            icon={LayoutTemplate}
                            label="Vorlagen"
                            href="/settings?tab=templates"
                            active={pathname === "/settings" && location.search.includes("tab=templates")}
                        />
                    </SidebarSection>

                    {/* Settings Section */}
                    <SidebarSection title="System">
                        <SidebarItem
                            icon={Settings2}
                            label="Einstellungen"
                            href="/settings"
                            active={pathname.startsWith("/settings") || pathname.startsWith("/admin")}
                        />
                    </SidebarSection>

                    {/* Favorites */}
                    <div className="pt-2 px-2">
                        <FavoritesList />
                    </div>
                </nav>

                {/* Bottom Section */}
                <div className="mt-auto">
                    {/* Keyboard Shortcuts Hint */}
                    <div className="px-4 py-2 border-t border-border/50">
                        <button
                            onClick={() => setShowShortcuts(true)}
                            className="w-full flex items-center justify-between py-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Keyboard className="w-3.5 h-3.5" />
                                <span>Shortcuts</span>
                            </div>
                            <kbd className="px-1.5 py-0.5 bg-muted rounded-[4px] text-[10px] font-mono border border-border">?</kbd>
                        </button>
                    </div>

                    {/* User Dropdown */}
                    <div className="p-3 border-t border-border/50 bg-muted/20">
                        <UserDropdown />
                    </div>
                </div>
            </div>
        </>
    );
};
