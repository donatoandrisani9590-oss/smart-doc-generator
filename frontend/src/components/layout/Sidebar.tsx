/**
 * Sidebar - Design System v2.1 Navigation
 *
 * Left sidebar navigation (260px fixed) replacing the top HeaderNav.
 * - Logo + "Docs" label
 * - "Neues Dokument" CTA
 * - Navigation items: Übersicht, Dokumente, Vorlagen, Einstellungen
 * - Favorites section
 * - Keyboard shortcuts hint + User dropdown at bottom
 * - Collapsed state (72px) supported
 * - Mobile: overlay with backdrop
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
    Keyboard,
    FolderOpen,
    Settings2,
    Globe,
    ChevronDown,
    LayoutTemplate,
    Sparkles,
    PlusCircle,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FavoritesList } from "./FavoritesList";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { UserDropdown } from "./UserDropdown";
import { useFeatureEnabled } from "@/hooks/useFeatureSettings";
import { useMagneticHover } from "@/hooks/useMagneticHover";

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
        data-sidebar="nav-item"
        className={cn(
            "group flex items-center transition-all duration-150 rounded-[var(--radius-md-ds)] mx-1",
            collapsed
                ? "justify-center px-0 py-2.5"
                : "justify-between px-3 py-2.5",
            active
                ? "bg-[var(--nw-blue-50)] text-[var(--nw-blue-700)] font-semibold dark:bg-[rgba(36,49,134,0.15)] dark:text-[var(--nw-blue-300)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        )}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? label : undefined}
    >
        <div className={cn("flex items-center", collapsed ? "gap-0" : "gap-3")}>
            <Icon className={cn(
                "shrink-0 transition-colors w-5 h-5",
                active ? "opacity-100" : "opacity-70 group-hover:opacity-100"
            )} aria-hidden="true" />
            {!collapsed && <span className="text-sm">{label}</span>}
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
        <div className={cn("space-y-1", collapsed ? "pt-2 first:pt-0" : "pt-5 first:pt-0")}>
            {!collapsed && (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-between w-full px-4 py-1.5 text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.08em] hover:text-[var(--text-secondary)] transition-colors"
                >
                    {title}
                    <ChevronDown className={cn(
                        "w-3 h-3 transition-transform",
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
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}

export const Sidebar = ({ collapsed = false, mobileOpen = false, onMobileClose }: SidebarProps) => {
    const location = useLocation();
    const navigate = useNavigate();
    const pathname = location.pathname;
    const [showShortcuts, setShowShortcuts] = useState(false);
    const isDocumentsEnabled = useFeatureEnabled("show_documents_overview");
    const sidebarRef = useRef<HTMLDivElement>(null);
    const magnetRef = useMagneticHover<HTMLButtonElement>({ strength: 0.2 });

    // Staggered entrance animation for nav items
    useGSAP(() => {
        const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (prefersReduced) return;

        // Logo fade-in
        gsap.from("[data-sidebar='logo']", {
            opacity: 0,
            y: -8,
            duration: 0.4,
            ease: "power2.out",
        });

        // CTA button scale-in
        gsap.from("[data-sidebar='cta']", {
            opacity: 0,
            scale: 0.9,
            duration: 0.4,
            delay: 0.15,
            ease: "back.out(2)",
        });

        // Nav items stagger cascade
        gsap.from("[data-sidebar='nav-item']", {
            opacity: 0,
            x: -12,
            duration: 0.35,
            stagger: 0.06,
            delay: 0.25,
            ease: "power2.out",
        });

        // Bottom section fade-in
        gsap.from("[data-sidebar='bottom']", {
            opacity: 0,
            y: 10,
            duration: 0.4,
            delay: 0.55,
            ease: "power2.out",
        });
    }, { scope: sidebarRef });

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

    // Close mobile sidebar on route change
    useEffect(() => {
        if (mobileOpen && onMobileClose) {
            onMobileClose();
        }
    }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

    const sidebarContent = (
        <div ref={sidebarRef} className={cn(
            "h-screen flex flex-col font-sans transition-all duration-200",
            "bg-[var(--bg-sidebar)] border-r border-[rgba(0,0,0,0.04)]",
            "dark:border-[rgba(255,255,255,0.06)]",
            collapsed ? "w-[var(--sidebar-collapsed)]" : "w-[var(--sidebar-width)]"
        )}>
            {/* Logo Section */}
            <div data-sidebar="logo" className={cn(
                "flex items-center shrink-0",
                collapsed ? "h-16 px-3 justify-center" : "h-16 px-5 justify-between"
            )}>
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
                            <span className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.15em]">
                                Docs
                            </span>
                        </>
                    )}
                </Link>
                {mobileOpen && onMobileClose && (
                    <button
                        onClick={onMobileClose}
                        className="lg:hidden p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        aria-label="Sidebar schließen"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* "Neues Dokument" CTA */}
            {!collapsed ? (
                <div data-sidebar="cta" className="px-3 pt-4 pb-2">
                    <Button
                        ref={magnetRef}
                        size="sm"
                        className="w-full gap-2 rounded-[var(--radius-md-ds)] h-9"
                        onClick={() => navigate("/generate")}
                        disabled={pathname === "/generate"}
                    >
                        <PlusCircle className="w-4 h-4" />
                        Neues Dokument
                    </Button>
                </div>
            ) : (
                <div className="px-2 pt-3 pb-1">
                    <Button
                        size="icon"
                        className="w-full h-9 rounded-[var(--radius-md-ds)]"
                        onClick={() => navigate("/generate")}
                        disabled={pathname === "/generate"}
                        title="Neues Dokument"
                    >
                        <PlusCircle className="w-4 h-4" />
                    </Button>
                </div>
            )}

            {/* Navigation */}
            <nav className={cn(
                "flex-1 overflow-y-auto scrollbar-hide py-2",
                collapsed ? "px-1 space-y-2" : "px-2 space-y-1"
            )} aria-label="Hauptnavigation">
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
                        icon={LayoutTemplate}
                        label="Vorlagen"
                        href="/templates"
                        active={pathname.startsWith("/templates")}
                        collapsed={collapsed}
                    />
                    <SidebarItem
                        icon={Sparkles}
                        label="KI-Assistent"
                        href="/agent"
                        active={pathname === "/agent"}
                        collapsed={collapsed}
                    />
                </SidebarSection>

                <SidebarSection title="System" collapsed={collapsed}>
                    <SidebarItem
                        icon={Settings2}
                        label="Einstellungen"
                        href="/settings"
                        active={pathname.startsWith("/settings") || pathname.startsWith("/admin")}
                        collapsed={collapsed}
                    />
                </SidebarSection>

                {!collapsed && (
                    <div className="pt-2 px-2">
                        <FavoritesList />
                    </div>
                )}
            </nav>

            {/* Bottom Section */}
            <div data-sidebar="bottom" className="mt-auto shrink-0">
                <div className={cn("", collapsed ? "px-2 py-2" : "px-4 py-2")}>
                    <button
                        onClick={() => setShowShortcuts(true)}
                        title={collapsed ? "Tastenkürzel (?)" : undefined}
                        className={cn(
                            "w-full flex items-center py-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors",
                            collapsed ? "justify-center" : "justify-between"
                        )}
                    >
                        <div className={cn("flex items-center", collapsed ? "gap-0" : "gap-2")}>
                            <Keyboard className="w-3.5 h-3.5" />
                            {!collapsed && <span>Tastenkürzel</span>}
                        </div>
                        {!collapsed && (
                            <kbd className="px-1.5 py-0.5 bg-muted rounded-[4px] text-[10px] font-mono border border-border">?</kbd>
                        )}
                    </button>
                </div>

                <div className={cn(
                    "border-t border-[rgba(0,0,0,0.04)] dark:border-[rgba(255,255,255,0.06)]",
                    collapsed ? "p-2" : "p-3"
                )}>
                    <UserDropdown collapsed={collapsed} />
                </div>
            </div>
        </div>
    );

    return (
        <>
            <KeyboardShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />

            {/* Desktop: Fixed sidebar */}
            <aside className="hidden lg:block fixed left-0 top-0 z-40 h-screen" aria-label="Sidebar Navigation">
                {sidebarContent}
            </aside>

            {/* Mobile: Overlay sidebar */}
            {mobileOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                    <div
                        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                        onClick={onMobileClose}
                        aria-hidden="true"
                    />
                    <aside className="relative z-10 h-screen" aria-label="Mobile Navigation">
                        {sidebarContent}
                    </aside>
                </div>
            )}
        </>
    );
};
