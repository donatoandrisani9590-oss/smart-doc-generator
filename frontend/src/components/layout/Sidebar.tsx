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
import { motion } from "framer-motion";
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
    /** Stagger index for entrance animation */
    animIndex?: number;
}

const SidebarItem = ({ icon: Icon, label, href, active, badge, collapsed, animIndex = 0 }: SidebarItemProps) => (
    <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{
            duration: 0.35,
            delay: 0.25 + animIndex * 0.06,
            ease: [0.33, 1, 0.68, 1],
        }}
    >
        <Link
            to={href}
            title={collapsed ? label : undefined}
            data-sidebar="nav-item"
            className={cn(
                "group flex items-center transition-all duration-[120ms] rounded-[var(--radius-sm-ds)] w-full text-left",
                collapsed
                    ? "justify-center px-0 py-2.5"
                    : "gap-[11px] px-[10px] py-[9px]",
                active
                    ? "bg-[var(--nw-blue-50)] text-[var(--nw-blue)] font-semibold dark:bg-[rgba(43,57,144,0.18)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            )}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? label : undefined}
        >
            <Icon className={cn(
                "shrink-0 w-[18px] h-[18px]",
                active ? "stroke-[1.8]" : "stroke-[1.8]"
            )} aria-hidden="true" />
            {!collapsed && <span className="text-[13.5px] font-medium">{label}</span>}
            {!collapsed && badge && (
                <span className="ml-auto text-[9px] font-bold px-[7px] py-[2px] rounded-full bg-[var(--nw-blue)] text-white uppercase tracking-[0.04em]">
                    {badge}
                </span>
            )}
        </Link>
    </motion.div>
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
        <div className={cn(collapsed ? "pt-2 first:pt-0" : "mb-1.5")}>
            {!collapsed && (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-between w-full px-[10px] py-[6px] pt-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.08em] hover:text-[var(--text-secondary)] transition-colors"
                >
                    {title}
                    <ChevronDown className={cn(
                        "w-3 h-3 transition-transform",
                        isOpen && "rotate-180"
                    )} />
                </button>
            )}
            {(collapsed || isOpen) && (
                <div className="space-y-px">
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

    // Track nav item index for staggered animation
    let navIndex = 0;

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
            "bg-[var(--bg-surface)] border-r border-[var(--border)]",
            collapsed ? "w-[var(--sidebar-collapsed)]" : "w-[var(--sidebar-width)]"
        )} style={{ padding: collapsed ? '24px 8px 16px' : '24px 14px 16px' }}>
            {/* Brand Section (Prototype sidebar-brand) */}
            <motion.div
                data-sidebar="logo"
                className={cn(
                    "flex items-center shrink-0 mb-6",
                    collapsed ? "justify-center" : "gap-[10px] px-2"
                )}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.33, 1, 0.68, 1] }}
            >
                <Link to="/" className="flex items-center gap-[10px] group" title={collapsed ? "Niederwieser Docs" : undefined}>
                    <div className={cn(
                        "flex items-center justify-center bg-[var(--nw-blue)] text-white font-extrabold rounded-[10px] shadow-[0_2px_8px_rgba(43,57,144,0.3)]",
                        collapsed ? "w-8 h-8 text-[13px]" : "w-9 h-9 text-[15px]"
                    )}>
                        N
                    </div>
                    {!collapsed && (
                        <div className="leading-tight">
                            <div className="text-sm font-bold text-[var(--text-primary)]">Niederwieser Docs</div>
                            <span className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.07em]">Smart Document Generator</span>
                        </div>
                    )}
                </Link>
                {mobileOpen && onMobileClose && (
                    <button
                        onClick={onMobileClose}
                        className="lg:hidden ml-auto p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        aria-label="Sidebar schließen"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </motion.div>

            {/* "Neues Dokument" CTA (Prototype sidebar-cta) */}
            {!collapsed ? (
                <motion.div
                    data-sidebar="cta"
                    className="mb-7"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                        duration: 0.4,
                        delay: 0.15,
                        ease: [0.34, 1.56, 0.64, 1], // back.out(2) equivalent
                    }}
                >
                    <button
                        ref={magnetRef}
                        className={cn(
                            "w-full flex items-center justify-center gap-2 py-3 px-4",
                            "bg-[var(--nw-blue)] text-white rounded-[var(--radius-md)]",
                            "text-[13.5px] font-semibold",
                            "shadow-[0_2px_10px_rgba(43,57,144,0.25)]",
                            "transition-all duration-150",
                            "hover:bg-[var(--nw-blue-light)] hover:-translate-y-px",
                            pathname === "/generate" && "opacity-50 pointer-events-none"
                        )}
                        onClick={() => navigate("/generate")}
                        disabled={pathname === "/generate"}
                    >
                        <PlusCircle className="w-[17px] h-[17px]" />
                        Neues Dokument
                    </button>
                </motion.div>
            ) : (
                <div className="mb-5">
                    <Button
                        size="icon"
                        className="w-full h-9 rounded-[var(--radius-sm-ds)]"
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
                        animIndex={navIndex++}
                    />
                    {isDocumentsEnabled && (
                        <SidebarItem
                            icon={FolderOpen}
                            label="Dokumente"
                            href="/documents"
                            active={pathname.startsWith("/documents") || pathname.startsWith("/search")}
                            collapsed={collapsed}
                            animIndex={navIndex++}
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
                        animIndex={navIndex++}
                    />
                    <SidebarItem
                        icon={Sparkles}
                        label="KI-Assistent"
                        href="/agent"
                        active={pathname === "/agent"}
                        collapsed={collapsed}
                        animIndex={navIndex++}
                    />
                </SidebarSection>

                <SidebarSection title="System" collapsed={collapsed}>
                    <SidebarItem
                        icon={Settings2}
                        label="Einstellungen"
                        href="/settings"
                        active={pathname.startsWith("/settings") || pathname.startsWith("/admin")}
                        collapsed={collapsed}
                        animIndex={navIndex++}
                    />
                </SidebarSection>

                {!collapsed && (
                    <div className="pt-2 px-2">
                        <FavoritesList />
                    </div>
                )}
            </nav>

            {/* Bottom Section (Prototype sidebar-footer) */}
            <motion.div
                data-sidebar="bottom"
                className="mt-auto shrink-0 pt-3.5 border-t border-[var(--border-light)]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                    duration: 0.4,
                    delay: 0.55,
                    ease: [0.33, 1, 0.68, 1],
                }}
            >
                <div className={cn("", collapsed ? "px-1 py-1" : "")}>
                    <button
                        onClick={() => setShowShortcuts(true)}
                        title={collapsed ? "Tastenkürzel (?)" : undefined}
                        className={cn(
                            "w-full flex items-center py-2 px-[10px] text-[13px] text-[var(--text-secondary)] rounded-[var(--radius-sm-ds)] transition-all duration-[120ms]",
                            "hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
                            collapsed ? "justify-center" : "gap-2 mb-1.5"
                        )}
                    >
                        <Keyboard className="w-4 h-4" />
                        {!collapsed && <span>Tastenkürzel</span>}
                    </button>
                </div>

                <div className={cn(collapsed ? "p-1" : "")}>
                    <UserDropdown collapsed={collapsed} />
                </div>
            </motion.div>
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
