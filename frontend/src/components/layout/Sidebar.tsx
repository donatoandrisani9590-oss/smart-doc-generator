import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
    FileText,
    Keyboard,
    FolderOpen,
    Settings2,
    Globe,
    ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FavoritesList } from "./FavoritesList";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { UserDropdown } from "./UserDropdown";

/**
 * SimpleDocs-inspired Sidebar
 * - Clean, minimal design
 * - Category headers in accent color
 * - Simple hover states without animations
 * - Clear visual hierarchy
 */

interface SidebarItemProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    href: string;
    active: boolean;
}

const SidebarItem = ({ icon: Icon, label, href, active }: SidebarItemProps) => (
    <Link
        to={href}
        className={cn(
            "flex items-center gap-3 px-3 py-2 text-sm transition-colors rounded-md",
            active
                ? "bg-primary/10 text-primary font-medium"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        )}
        aria-current={active ? "page" : undefined}
    >
        <Icon className={cn(
            "w-4 h-4 shrink-0",
            active ? "text-primary" : "text-gray-400"
        )} aria-hidden="true" />
        <span>{label}</span>
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
        <div className="space-y-1">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold text-primary uppercase tracking-wider hover:bg-gray-50 rounded transition-colors"
            >
                {title}
                <ChevronDown className={cn(
                    "w-3 h-3 text-gray-400 transition-transform",
                    isOpen && "rotate-180"
                )} />
            </button>
            {isOpen && (
                <div className="space-y-0.5 pl-1">
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
            <div className="w-60 h-screen flex flex-col bg-white border-r border-gray-200">
                {/* Logo Section */}
                <div className="p-5 border-b border-gray-100">
                    <div className="flex flex-col">
                        <h1
                            className="text-lg font-bold tracking-tight"
                            style={{
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                color: '#1a2b6b'
                            }}
                        >
                            nıederwıeser
                        </h1>
                        <p
                            className="text-[9px] font-medium tracking-widest uppercase mt-0.5"
                            style={{ color: '#3eb489' }}
                        >
                            Flexible Food Packaging
                        </p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
                    {/* Main Navigation */}
                    <SidebarSection title="Navigation">
                        <SidebarItem
                            icon={Globe}
                            label="Dashboard"
                            href="/"
                            active={pathname === "/" || pathname === "/deadlines" || pathname === "/teams"}
                        />
                        <SidebarItem
                            icon={FileText}
                            label="Neues Dokument"
                            href="/generate"
                            active={pathname === "/generate" || pathname.startsWith("/composer")}
                        />
                        <SidebarItem
                            icon={FolderOpen}
                            label="Dokumente"
                            href="/documents"
                            active={pathname.startsWith("/documents") || pathname.startsWith("/search")}
                        />
                    </SidebarSection>

                    {/* Settings Section */}
                    <SidebarSection title="Verwaltung">
                        <SidebarItem
                            icon={Settings2}
                            label="Einstellungen"
                            href="/settings"
                            active={pathname.startsWith("/settings") || pathname.startsWith("/admin")}
                        />
                    </SidebarSection>

                    {/* Favorites */}
                    <div className="pt-2">
                        <FavoritesList />
                    </div>
                </nav>

                {/* Bottom Section */}
                <div className="border-t border-gray-100">
                    {/* Keyboard Shortcuts Hint */}
                    <div className="px-4 py-2">
                        <button
                            onClick={() => setShowShortcuts(true)}
                            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-500 hover:text-primary hover:bg-gray-50 rounded-md transition-colors"
                            aria-label="Tastaturkürzel anzeigen"
                        >
                            <Keyboard className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Tastaturkürzel</span>
                            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono text-gray-500">?</kbd>
                        </button>
                    </div>

                    {/* User Dropdown */}
                    <div className="p-3 border-t border-gray-100">
                        <UserDropdown />
                    </div>
                </div>
            </div>
        </>
    );
};
