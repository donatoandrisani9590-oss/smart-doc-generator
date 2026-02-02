/**
 * ThreePanelLayout - Modern Three-Panel Design
 *
 * Inspired by modern content management interfaces:
 * - Left: Navigation sidebar with Library categories
 * - Middle: Searchable document list
 * - Right: Document detail/preview panel
 */

import { useState, useEffect, createContext, useContext } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { NavigationSidebar } from "./NavigationSidebar";
import { MiddlePanel } from "./MiddlePanel";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { SkipLink, LiveRegion } from "@/hooks/useAccessibility";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Context for panel state
interface PanelContextType {
    selectedItemId: number | null;
    setSelectedItemId: (id: number | null) => void;
    middlePanelCollapsed: boolean;
    setMiddlePanelCollapsed: (collapsed: boolean) => void;
}

const PanelContext = createContext<PanelContextType | null>(null);

export const usePanelContext = () => {
    const context = useContext(PanelContext);
    if (!context) {
        throw new Error("usePanelContext must be used within ThreePanelLayout");
    }
    return context;
};

// Page titles based on route
const getPageTitle = (pathname: string): string => {
    if (pathname === "/") return "Dashboard";
    if (pathname.startsWith("/generate")) return "Neues Dokument";
    if (pathname.startsWith("/documents")) return "Dokumente";
    if (pathname.startsWith("/admin")) return "Einstellungen";
    return "Dokumente";
};

export const ThreePanelLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const pageTitle = getPageTitle(location.pathname);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [pageAnnouncement, setPageAnnouncement] = useState("");
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
    const [middlePanelCollapsed, setMiddlePanelCollapsed] = useState(false);

    // Determine if we should show the three-panel layout
    // Only show for document-related pages
    const showThreePanel = location.pathname === "/" ||
        location.pathname.startsWith("/documents") ||
        location.pathname.startsWith("/library");

    // Announce page changes for screen readers
    useEffect(() => {
        setPageAnnouncement(`Seite: ${pageTitle}`);
    }, [pageTitle]);

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    // Close mobile menu on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && mobileMenuOpen) {
                setMobileMenuOpen(false);
            }
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [mobileMenuOpen]);

    // Global keyboard shortcuts
    useKeyboardShortcuts({
        onSearch: () => {
            const searchInput = document.querySelector('[data-global-search]') as HTMLInputElement;
            searchInput?.focus();
        },
        onNewDocument: () => navigate("/generate"),
        onHelp: () => setShowShortcuts(true),
    });

    return (
        <PanelContext.Provider value={{
            selectedItemId,
            setSelectedItemId,
            middlePanelCollapsed,
            setMiddlePanelCollapsed
        }}>
            <div className="flex h-screen bg-gray-50 font-sans text-foreground overflow-hidden">
                {/* Skip to main content link for keyboard users */}
                <SkipLink targetId="main-content" />

                {/* Live region for page announcements */}
                <LiveRegion message={pageAnnouncement} priority="polite" />

                {/* Left Navigation Sidebar - Always visible on desktop */}
                <div className="hidden lg:flex">
                    <NavigationSidebar />
                </div>

                {/* Mobile Sidebar Overlay */}
                {mobileMenuOpen && (
                    <div className="lg:hidden fixed inset-0 z-50">
                        <div
                            className="absolute inset-0 bg-black/50"
                            onClick={() => setMobileMenuOpen(false)}
                            aria-hidden="true"
                        />
                        <div className="relative w-60 h-full bg-white">
                            <NavigationSidebar />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-4 right-4"
                                onClick={() => setMobileMenuOpen(false)}
                                aria-label="Menu schliessen"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Middle Panel - Document List (conditionally shown) */}
                {showThreePanel && !middlePanelCollapsed && (
                    <div className="hidden lg:flex w-80 xl:w-96 border-r border-gray-200 bg-white flex-shrink-0">
                        <MiddlePanel />
                    </div>
                )}

                {/* Main Content Area (Right Panel) */}
                <main
                    className={cn(
                        "flex-1 flex flex-col overflow-hidden bg-white",
                        showThreePanel && "border-l border-gray-100"
                    )}
                    role="main"
                >
                    {/* Mobile Header */}
                    <header className="lg:hidden h-14 px-4 flex items-center justify-between border-b border-gray-200 bg-white">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setMobileMenuOpen(true)}
                                aria-label="Menu oeffnen"
                            >
                                <Menu className="w-5 h-5" />
                            </Button>
                            <h2 className="text-lg font-semibold">{pageTitle}</h2>
                        </div>
                    </header>

                    {/* Content */}
                    <div
                        id="main-content"
                        className="flex-1 overflow-auto"
                        tabIndex={-1}
                    >
                        <Outlet />
                    </div>
                </main>

                {/* Keyboard Shortcuts Dialog */}
                <KeyboardShortcutsDialog
                    open={showShortcuts}
                    onOpenChange={setShowShortcuts}
                />
            </div>
        </PanelContext.Provider>
    );
};

export default ThreePanelLayout;
