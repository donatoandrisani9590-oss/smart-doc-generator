/**
 * Layout - Ive Redesign (Header-Only Navigation)
 *
 * - Translucent header bar as sole navigation
 * - Full-width content with max-w-7xl centering
 * - Subtle footer anchor
 * - No sidebar
 */

import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { HeaderNav } from "./HeaderNav";
import { Footer } from "./Footer";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { CommandPalette } from "./CommandPalette";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { SkipLink, LiveRegion } from "@/hooks/useAccessibility";
import { useEventStream } from "@/hooks/useEventStream";

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
    if (pathname.startsWith("/agent")) return "KI-Assistent";
    return "Seite nicht gefunden";
};

export const Layout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const pageTitle = getPageTitle(location.pathname);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [pageAnnouncement, setPageAnnouncement] = useState("");
    const [showTour, setShowTour] = useState(false);
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

    // SSE Real-time Updates
    useEventStream();

    // Announce page changes for screen readers
    useEffect(() => {
        setPageAnnouncement(`Seite: ${pageTitle}`);
    }, [pageTitle]);

    // Global keyboard shortcuts
    useKeyboardShortcuts({
        onSearch: () => setCommandPaletteOpen(true),
        onNewDocument: () => navigate("/generate"),
        onHelp: () => setShowShortcuts(true),
    });

    return (
        <div className="flex flex-col min-h-screen bg-background font-sans text-foreground">
            <SkipLink targetId="main-content" />
            <LiveRegion message={pageAnnouncement} priority="polite" />

            {/* Header — sole navigation */}
            <HeaderNav />

            {/* Main Content */}
            <main
                id="main-content"
                className="flex-1 overflow-x-hidden scroll-smooth"
                role="main"
                tabIndex={-1}
            >
                <div className="px-4 sm:px-6 lg:px-12 py-6 lg:py-8 max-w-7xl mx-auto w-full">
                    <div key={location.pathname} className="w-full animate-enter">
                        <Outlet />
                    </div>
                </div>
            </main>

            {/* Footer */}
            <Footer />

            {/* Overlays */}
            <CommandPalette
                open={commandPaletteOpen}
                onOpenChange={setCommandPaletteOpen}
            />
            <KeyboardShortcutsDialog
                open={showShortcuts}
                onOpenChange={setShowShortcuts}
            />
            <OnboardingTour
                isOpen={showTour}
                onOpenChange={setShowTour}
            />
        </div>
    );
};
