import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutDashboard, FileText, Keyboard, FolderOpen, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FavoritesList } from "./FavoritesList";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { UserDropdown } from "./UserDropdown";

/**
 * Motion variants for sidebar navigation items
 * - Subtle scale and x-translation on hover
 * - Press feedback on tap
 */
const sidebarItemVariants = {
    initial: { scale: 1, x: 0 },
    hover: { scale: 1.02, x: 4 },
    tap: { scale: 0.98, x: 0 },
};

const sidebarTransition = {
    type: "spring",
    stiffness: 400,
    damping: 20,
};

interface SidebarItemProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    href: string;
    active: boolean;
    /** Optional description shown as tooltip and below label on hover */
    description?: string;
}

const SidebarItem = ({ icon: Icon, label, href, active, description }: SidebarItemProps) => (
    <motion.div
        variants={sidebarItemVariants}
        initial="initial"
        whileHover="hover"
        whileTap="tap"
        transition={sidebarTransition}
    >
        <Link
            to={href}
            className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-lg group",
                active
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-foreground hover:bg-primary/10 hover:text-primary"
            )}
            aria-current={active ? "page" : undefined}
            title={description}
        >
            <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
            <div className="flex flex-col min-w-0">
                <span>{label}</span>
                {description && (
                    <span className={cn(
                        "text-[10px] font-normal truncate transition-opacity",
                        active ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                        {description}
                    </span>
                )}
            </div>
        </Link>
    </motion.div>
);

/**
 * Animation for the entire sidebar
 * - Staggered children animation on mount
 */
const sidebarContainerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.03,
        },
    },
};

const sidebarChildVariants = {
    hidden: { opacity: 0, x: -10 },
    show: { opacity: 1, x: 0 },
};

export const Sidebar = () => {
    const location = useLocation();
    const pathname = location.pathname;
    const [showShortcuts, setShowShortcuts] = useState(false);

    // Global keyboard shortcut to open dialog (? key)
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // Don't trigger if user is typing in an input/textarea
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
        <div className="w-64 h-screen flex flex-col glass-sidebar">
            {/* Niederwieser Logo */}
            <motion.div
                className="p-4 border-b border-border/30"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <div className="flex flex-col">
                    {/* Niederwieser text logo - Markenfarben */}
                    <h1
                        className="text-xl font-bold tracking-tight"
                        style={{
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            color: '#1a2b6b' /* Niederwieser Dunkelblau */
                        }}
                    >
                        nıederwıeser
                    </h1>
                    <p
                        className="text-[10px] font-medium tracking-widest uppercase"
                        style={{ color: '#3eb489' /* Niederwieser Grün */ }}
                    >
                        Flexible Food Packaging
                    </p>
                </div>
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/20">HR-Dokumentensystem</p>
            </motion.div>

            <motion.nav
                className="flex-1 p-4 space-y-1 overflow-y-auto"
                variants={sidebarContainerVariants}
                initial="hidden"
                animate="show"
            >
                {/* NEUE VEREINFACHTE NAVIGATION - nur 4 Hauptpunkte */}
                <motion.div variants={sidebarChildVariants}>
                    <SidebarItem
                        icon={LayoutDashboard}
                        label="Dashboard"
                        href="/"
                        active={pathname === "/" || pathname === "/deadlines" || pathname === "/teams"}
                        description="Übersicht & Fristen"
                    />
                </motion.div>
                <motion.div variants={sidebarChildVariants}>
                    <SidebarItem
                        icon={FileText}
                        label="Neues Dokument"
                        href="/generate"
                        active={pathname === "/generate" || pathname.startsWith("/composer")}
                        description="Vertrag erstellen"
                    />
                </motion.div>
                <motion.div variants={sidebarChildVariants}>
                    <SidebarItem
                        icon={FolderOpen}
                        label="Meine Dokumente"
                        href="/documents"
                        active={pathname.startsWith("/documents") || pathname.startsWith("/search")}
                        description="Archiv & Suche"
                    />
                </motion.div>
                <motion.div variants={sidebarChildVariants}>
                    <SidebarItem
                        icon={Settings2}
                        label="Einstellungen"
                        href="/settings"
                        active={pathname.startsWith("/settings") || pathname.startsWith("/admin")}
                        description="Vorlagen & Design"
                    />
                </motion.div>

                {/* Favorites Section - bleibt erhalten */}
                <motion.div variants={sidebarChildVariants} className="pt-4 mt-4 border-t border-border/30">
                    <FavoritesList />
                </motion.div>
            </motion.nav>

            {/* Keyboard shortcuts hint - clickable button */}
            <motion.div
                className="px-4 py-2 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
            >
                <button
                    onClick={() => setShowShortcuts(true)}
                    className="text-xs text-muted-foreground flex items-center justify-center gap-1 w-full py-1 rounded-md hover:bg-primary/5 hover:text-primary transition-colors"
                    aria-label="Tastaturkürzel anzeigen"
                >
                    <Keyboard className="w-3 h-3" aria-hidden="true" />
                    <span>Tastaturkürzel:</span>
                    <kbd className="px-1.5 py-0.5 bg-white/50 rounded text-[10px] font-mono border border-border/50">?</kbd>
                </button>
            </motion.div>

            {/* User section with dropdown */}
            <motion.div
                className="p-4 border-t border-border/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
            >
                <UserDropdown />
            </motion.div>
        </div>
        </>
    );
};
