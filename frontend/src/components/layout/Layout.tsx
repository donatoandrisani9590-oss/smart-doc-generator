/**
 * Layout - Soft & Simple Design
 *
 * - Glassmorphism Sidebar
 * - Clean, detached Header
 * - Soft/Muted Content Background (Airy feel)
 * - Framer Motion Page Transitions
 */

import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
// framer-motion removed - caused opacity stuck bug in production
import { Sidebar } from "./Sidebar";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { ThemeToggle } from "./ThemeToggle";
import { CountrySelector } from "./CountrySelector";
import { useTheme } from "@/contexts/ThemeContext";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { CommandPalette } from "./CommandPalette";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { SkipLink, LiveRegion } from "@/hooks/useAccessibility";
import { useEventStream } from "@/hooks/useEventStream";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Page titles based on route
const getPageTitle = (pathname: string): string => {
    if (pathname === "/") return "Übersicht";
    if (pathname.startsWith("/generate")) return "Neues Dokument";
    if (pathname.startsWith("/documents")) return "Dokumente";
    if (pathname.startsWith("/bulk")) return "Massen-Import";
    if (pathname.startsWith("/search")) return "Suche";
    if (pathname.startsWith("/teams")) return "Teams";
    if (pathname.startsWith("/deadlines")) return "Fristen";
    if (pathname.startsWith("/notifications")) return "Benachrichtigungen";
    if (pathname.startsWith("/settings")) return "Einstellungen";
    if (pathname.startsWith("/admin")) return "Einstellungen";
    return "Seite nicht gefunden";
};

export const Layout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const pageTitle = getPageTitle(location.pathname);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [pageAnnouncement, setPageAnnouncement] = useState("");
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showTour, setShowTour] = useState(false);
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
    const { resolvedTheme } = useTheme();

    // SSE Real-time Updates (einmal pro Layout-Mount)
    useEventStream();

    // Collapse sidebar on settings/admin pages to avoid double-nav
    const isSidebarCollapsed = location.pathname.startsWith('/settings') || location.pathname.startsWith('/admin');

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
        onSearch: () => setCommandPaletteOpen(true),
        onNewDocument: () => navigate("/generate"),
        onHelp: () => setShowShortcuts(true),
    });

    return (
        <div className="flex min-h-screen bg-background font-sans text-foreground overflow-hidden">
            {/* Skip to main content link for keyboard users */}
            <SkipLink targetId="main-content" />

            {/* Live region for page announcements */}
            <LiveRegion message={pageAnnouncement} priority="polite" />

            {/* Desktop Sidebar - Collapses to icon rail on settings pages */}
            <div className="hidden lg:block shrink-0 z-20 transition-all duration-200">
                <Sidebar collapsed={isSidebarCollapsed} />
            </div>

            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-hidden="true"
                    />
                    <div className="relative w-[280px] h-full shadow-2xl">
                        <Sidebar />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-4 right-4 lg:hidden text-muted-foreground"
                            onClick={() => setMobileMenuOpen(false)}
                            aria-label="Menü schließen"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-h-screen min-w-0 relative" role="main">
                {/* Header - Detached & Airy */}
                <header
                    className="h-16 px-8 flex items-center justify-between glass-header z-10 sticky top-0"
                    role="banner"
                    style={{
                        backdropFilter: 'blur(12px)',
                        backgroundColor: resolvedTheme === 'dark'
                            ? 'rgba(20, 22, 30, 0.85)'
                            : 'rgba(255, 255, 255, 0.85)',
                    }}
                >
                    <div className="flex items-center gap-4">
                        {/* Mobile menu button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden -ml-2"
                            onClick={() => setMobileMenuOpen(true)}
                            aria-label="Menü öffnen"
                            aria-expanded={mobileMenuOpen}
                        >
                            <Menu className="w-5 h-5" />
                        </Button>
                        <h1 className="text-lg font-semibold text-foreground tracking-tight" aria-live="polite">
                            {pageTitle}
                        </h1>
                    </div>

                    <nav className="flex items-center gap-2" aria-label="Schnellaktionen">
                        <ThemeToggle />
                        <CountrySelector />
                        <div className="w-px h-6 bg-border mx-1" />
                        <NotificationDropdown />
                    </nav>
                </header>

                {/* Content Area with Transitions */}
                <div
                    id="main-content"
                    className="flex-1 overflow-y-auto overflow-x-hidden bg-background scroll-smooth"
                    tabIndex={-1}
                >
                    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
                        <div key={location.pathname} className="w-full animate-enter">
                            <Outlet />
                        </div>
                    </div>
                    {/* Bottom spacer for comfortable scrolling */}
                    <div className="h-12" />
                </div>
            </main>

            {/* Command Palette (Cmd+K) */}
            <CommandPalette
                open={commandPaletteOpen}
                onOpenChange={setCommandPaletteOpen}
            />

            {/* Keyboard Shortcuts Dialog */}
            <KeyboardShortcutsDialog
                open={showShortcuts}
                onOpenChange={setShowShortcuts}
            />

            {/* Onboarding Tour */}
            <OnboardingTour
                isOpen={showTour}
                onOpenChange={setShowTour}
            />
        </div>
    );
};
