/**
 * NavigationSidebar - Left navigation panel with Collapse/Expand
 *
 * Features:
 * - Company logo
 * - Collapse/Expand toggle with localStorage persistence
 * - Inbox with badge
 * - Create section (expandable)
 * - Library with expandable categories
 * - Chat & Workflows links
 * - Settings
 * - User dropdown at bottom
 * - Tooltips when collapsed
 */

import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Inbox,
    PenSquare,
    Library,
    ChevronRight,
    ChevronLeft,
    MessageCircle,
    Workflow,
    FileText,
    FolderOpen,
    Clock,
    CheckCircle,
    Archive,
    Trash2,
    HelpCircle,
    Settings,
    Wand2,
    Zap,
    Copy,
    Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserDropdown } from "./UserDropdown";
import { useDashboardStats } from "@/hooks/useApi";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================
// TYPES & INTERFACES
// ============================================

interface LibraryCategory {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    href: string;
    count?: number;
}

interface NavItemProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    href?: string;
    badge?: number;
    active?: boolean;
    onClick?: () => void;
    hasChevron?: boolean;
    isExpanded?: boolean;
    isCollapsed?: boolean;
}

interface SidebarSectionProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    isCollapsed: boolean;
    sectionId: string;
    active?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const LIBRARY_CATEGORIES: LibraryCategory[] = [
    { id: "all", label: "Alle", icon: FolderOpen, href: "/documents" },
    { id: "draft", label: "Entwürfe", icon: Clock, href: "/documents?status=draft" },
    { id: "returned", label: "Zurückgegeben", icon: FileText, href: "/documents?status=returned" },
    { id: "review", label: "Zur Prüfung", icon: HelpCircle, href: "/documents?status=review" },
    { id: "published", label: "Veröffentlicht", icon: CheckCircle, href: "/documents?status=published" },
    { id: "archived", label: "Archiviert", icon: Archive, href: "/documents?status=archived" },
    { id: "uncategorized", label: "Ohne Kategorie", icon: FileText, href: "/documents?status=uncategorized" },
    { id: "trash", label: "Papierkorb", icon: Trash2, href: "/documents?status=trash" },
];

const CREATE_OPTIONS = [
    { id: "wizard", label: "Mit Assistent", icon: Wand2, href: "/generate?mode=wizard" },
    { id: "quick", label: "Schnellerstellung", icon: Zap, href: "/generate?mode=quick" },
    { id: "template", label: "Aus Vorlage", icon: Copy, href: "/generate?mode=template" },
];

// ============================================
// LOCALSTORAGE HELPERS
// ============================================

const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";
const SIDEBAR_SECTIONS_KEY = "sidebar_sections";

const getSidebarCollapsed = (): boolean => {
    try {
        const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
        return saved ? JSON.parse(saved) : false;
    } catch {
        return false;
    }
};

const setSidebarCollapsed = (collapsed: boolean): void => {
    try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(collapsed));
    } catch {
        // Ignore localStorage errors
    }
};

const getSectionState = (sectionId: string, defaultOpen: boolean): boolean => {
    try {
        const saved = localStorage.getItem(SIDEBAR_SECTIONS_KEY);
        if (saved) {
            const sections = JSON.parse(saved);
            return sections[sectionId] ?? defaultOpen;
        }
        return defaultOpen;
    } catch {
        return defaultOpen;
    }
};

const setSectionState = (sectionId: string, isOpen: boolean): void => {
    try {
        const saved = localStorage.getItem(SIDEBAR_SECTIONS_KEY);
        const sections = saved ? JSON.parse(saved) : {};
        sections[sectionId] = isOpen;
        localStorage.setItem(SIDEBAR_SECTIONS_KEY, JSON.stringify(sections));
    } catch {
        // Ignore localStorage errors
    }
};

// ============================================
// NAV ITEM COMPONENT
// ============================================

const NavItem = ({
    icon: Icon,
    label,
    href,
    badge,
    active,
    onClick,
    hasChevron,
    isExpanded,
    isCollapsed = false,
}: NavItemProps) => {
    const content = (
        <div
            className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer group",
                active
                    ? "bg-green-50 text-green-800 border-l-3 border-green-500"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                isCollapsed && "justify-center px-2"
            )}
            onClick={onClick}
        >
            <div className={cn("flex items-center gap-3", isCollapsed && "gap-0")}>
                <Icon
                    className={cn(
                        "w-5 h-5 transition-colors flex-shrink-0",
                        active ? "text-green-600" : "text-gray-400 group-hover:text-gray-600"
                    )}
                />
                {!isCollapsed && <span className="truncate">{label}</span>}
            </div>
            {!isCollapsed && (
                <div className="flex items-center gap-2">
                    {badge !== undefined && badge > 0 && (
                        <span className="bg-gray-200 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full min-w-[24px] text-center">
                            {badge}
                        </span>
                    )}
                    {hasChevron && (
                        <motion.div
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                        </motion.div>
                    )}
                </div>
            )}
            {isCollapsed && badge !== undefined && badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {badge > 9 ? "9+" : badge}
                </span>
            )}
        </div>
    );

    // Wrap in tooltip when collapsed
    if (isCollapsed) {
        return (
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    {href && !onClick ? (
                        <Link to={href} className="relative block">
                            {content}
                        </Link>
                    ) : (
                        <div className="relative">{content}</div>
                    )}
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                    <p>{label}</p>
                    {badge !== undefined && badge > 0 && (
                        <span className="ml-2 text-gray-400">({badge})</span>
                    )}
                </TooltipContent>
            </Tooltip>
        );
    }

    if (href && !onClick) {
        return <Link to={href}>{content}</Link>;
    }

    return content;
};

// ============================================
// SIDEBAR SECTION COMPONENT (Expandable)
// ============================================

const SidebarSection = ({
    icon: Icon,
    label,
    children,
    defaultOpen = false,
    isCollapsed,
    sectionId,
    active,
}: SidebarSectionProps) => {
    const [isOpen, setIsOpen] = useState(() => getSectionState(sectionId, defaultOpen));

    // Update localStorage when state changes
    useEffect(() => {
        setSectionState(sectionId, isOpen);
    }, [sectionId, isOpen]);

    const handleToggle = () => {
        setIsOpen(!isOpen);
    };

    // When collapsed, show flyout on hover
    if (isCollapsed) {
        return (
            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                    <div
                        className={cn(
                            "flex items-center justify-center px-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer group",
                            active
                                ? "bg-green-50 text-green-800"
                                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        )}
                    >
                        <Icon
                            className={cn(
                                "w-5 h-5 transition-colors",
                                active ? "text-green-600" : "text-gray-400 group-hover:text-gray-600"
                            )}
                        />
                    </div>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10} className="p-0">
                    <div className="py-2 min-w-[180px]">
                        <div className="px-3 py-2 text-sm font-semibold text-gray-900 border-b border-gray-100">
                            {label}
                        </div>
                        <div className="py-1">{children}</div>
                    </div>
                </TooltipContent>
            </Tooltip>
        );
    }

    return (
        <div>
            {/* Section Header */}
            <div
                className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer group",
                    active
                        ? "bg-green-50 text-green-800"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
                onClick={handleToggle}
            >
                <div className="flex items-center gap-3">
                    <Icon
                        className={cn(
                            "w-5 h-5 transition-colors",
                            active ? "text-green-600" : "text-gray-400 group-hover:text-gray-600"
                        )}
                    />
                    <span>{label}</span>
                </div>
                <motion.div
                    animate={{ rotate: isOpen ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                </motion.div>
            </div>

            {/* Children with Animation */}
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="ml-4 mt-1 space-y-0.5 border-l border-gray-100 pl-3">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ============================================
// MAIN NAVIGATION SIDEBAR COMPONENT
// ============================================

export const NavigationSidebar = () => {
    const location = useLocation();
    const pathname = location.pathname;

    // Collapse state with localStorage persistence
    const [isCollapsed, setIsCollapsed] = useState(() => getSidebarCollapsed());
    const { data: stats } = useDashboardStats();

    // Persist collapse state to localStorage
    useEffect(() => {
        setSidebarCollapsed(isCollapsed);
    }, [isCollapsed]);

    // Calculate category counts from stats
    const getCategoryCount = (categoryId: string): number | undefined => {
        if (!stats) return undefined;
        switch (categoryId) {
            case "all":
                return stats.documents_total || 0;
            case "draft":
                return stats.open_drafts || 0;
            default:
                return undefined;
        }
    };

    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };

    return (
        <TooltipProvider>
            <motion.div
                className={cn(
                    "h-screen flex flex-col bg-white border-r border-gray-200 transition-all duration-250 ease-in-out overflow-hidden",
                    isCollapsed ? "w-16" : "w-60"
                )}
                animate={{ width: isCollapsed ? 64 : 240 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
            >
                {/* Logo Section with Collapse Toggle */}
                <div className="p-3 border-b border-gray-100">
                    <div className={cn(
                        "flex items-center",
                        isCollapsed ? "justify-center" : "justify-between"
                    )}>
                        {/* Logo - clickable to Dashboard */}
                        <Link
                            to="/"
                            className={cn(
                                "flex items-center gap-3 hover:opacity-80 transition-opacity",
                                isCollapsed && "justify-center"
                            )}
                        >
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-bold text-sm">N</span>
                            </div>
                            {!isCollapsed && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-col min-w-0"
                                >
                                    <span className="text-sm font-semibold text-gray-900 truncate">
                                        niederwieser
                                    </span>
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                                        HR Documents
                                    </span>
                                </motion.div>
                            )}
                        </Link>

                        {/* Collapse Toggle Button */}
                        {!isCollapsed && (
                            <button
                                onClick={toggleCollapse}
                                className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                                aria-label="Sidebar einklappen"
                                title="Sidebar einklappen"
                            >
                                <ChevronLeft className="w-4 h-4 text-gray-400" />
                            </button>
                        )}
                    </div>

                    {/* Show expand button when collapsed */}
                    {isCollapsed && (
                        <button
                            onClick={toggleCollapse}
                            className="mt-2 w-full p-1.5 rounded-md hover:bg-gray-100 transition-colors flex items-center justify-center"
                            aria-label="Sidebar ausklappen"
                            title="Sidebar ausklappen"
                        >
                            <Menu className="w-4 h-4 text-gray-400" />
                        </button>
                    )}
                </div>

                {/* Main Navigation */}
                <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
                    {/* Inbox / Dashboard */}
                    <NavItem
                        icon={Inbox}
                        label="Posteingang"
                        href="/"
                        badge={stats?.open_drafts || 0}
                        active={pathname === "/"}
                        isCollapsed={isCollapsed}
                    />

                    {/* Create Section (Expandable) */}
                    <SidebarSection
                        icon={PenSquare}
                        label="Neu erstellen"
                        sectionId="create"
                        defaultOpen={false}
                        isCollapsed={isCollapsed}
                        active={pathname === "/generate" || pathname.startsWith("/composer")}
                    >
                        {CREATE_OPTIONS.map((option) => (
                            <Link
                                key={option.id}
                                to={option.href}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                                    pathname === option.href
                                        ? "bg-gray-100 text-gray-900 font-medium"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                )}
                            >
                                <option.icon className="w-4 h-4 text-gray-400" />
                                <span>{option.label}</span>
                            </Link>
                        ))}
                    </SidebarSection>

                    {/* Library Section (Expandable) */}
                    <SidebarSection
                        icon={Library}
                        label="Bibliothek"
                        sectionId="library"
                        defaultOpen={true}
                        isCollapsed={isCollapsed}
                        active={pathname.startsWith("/documents") || pathname.startsWith("/library")}
                    >
                        {LIBRARY_CATEGORIES.map((category) => {
                            const count = getCategoryCount(category.id);
                            const isActive =
                                pathname === category.href ||
                                (pathname.startsWith("/documents") &&
                                    category.id === "all" &&
                                    !location.search);

                            return (
                                <Link
                                    key={category.id}
                                    to={category.href}
                                    className={cn(
                                        "flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                                        isActive
                                            ? "bg-green-50 text-green-800 font-medium"
                                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                    )}
                                >
                                    <span>{category.label}</span>
                                    {count !== undefined && (
                                        <span className="text-xs text-gray-400">{count}</span>
                                    )}
                                </Link>
                            );
                        })}
                    </SidebarSection>

                    {/* Divider */}
                    <div className="py-2">
                        <div className="border-t border-gray-100" />
                    </div>

                    {/* Chat */}
                    <NavItem
                        icon={MessageCircle}
                        label="Chat"
                        href="/chat"
                        active={pathname === "/chat"}
                        isCollapsed={isCollapsed}
                    />

                    {/* Workflows */}
                    <NavItem
                        icon={Workflow}
                        label="Workflows"
                        href="/workflows"
                        active={pathname === "/workflows"}
                        isCollapsed={isCollapsed}
                    />

                    {/* Settings */}
                    <NavItem
                        icon={Settings}
                        label="Einstellungen"
                        href="/settings"
                        active={pathname.startsWith("/settings") || pathname.startsWith("/admin")}
                        isCollapsed={isCollapsed}
                    />
                </nav>

                {/* User Section */}
                <div className="p-2 border-t border-gray-100">
                    <UserDropdown isCollapsed={isCollapsed} />
                </div>
            </motion.div>
        </TooltipProvider>
    );
};

export default NavigationSidebar;
