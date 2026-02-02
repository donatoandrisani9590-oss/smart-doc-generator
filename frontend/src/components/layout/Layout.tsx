import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { CountrySelector } from "./CountrySelector";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { OnboardingTour, useOnboardingTour } from "@/components/onboarding/OnboardingTour";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { SkipLink, LiveRegion } from "@/hooks/useAccessibility";
import { Keyboard, HelpCircle, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Page titles based on route - UX-optimiert für HR-Mitarbeiter
const getPageTitle = (pathname: string): string => {
    if (pathname === "/") return "Übersicht";
    if (pathname.startsWith("/generate")) return "Neues Dokument erstellen";
    if (pathname.startsWith("/documents")) return "Dokumentarchiv";
    if (pathname.startsWith("/bulk")) return "Massen-Import";
    if (pathname.startsWith("/search")) return "Suche";
    if (pathname.startsWith("/teams")) return "Teams";
    if (pathname.startsWith("/deadlines")) return "Fristen";
    if (pathname.startsWith("/composer")) return "Dokument-Designer";
    if (pathname.startsWith("/notifications")) return "Benachrichtigungen";
    if (pathname.startsWith("/admin/company-settings")) return "Firmendaten";
    if (pathname.startsWith("/admin/settings")) return "Design";
    if (pathname.startsWith("/admin/clauses")) return "Textbausteine";
    if (pathname.startsWith("/admin/attachments")) return "Anlagen";
    if (pathname.startsWith("/admin/types")) return "Dokumentvorlagen";
    if (pathname.startsWith("/admin/form-fields")) return "Formularfelder";
    if (pathname.startsWith("/admin/template-preview")) return "Vorschau testen";
    if (pathname.startsWith("/admin/document-designer")) return "Layout-Editor";
    if (pathname.startsWith("/admin/works-council")) return "Betriebsrat";
    if (pathname.startsWith("/admin/retention")) return "Aufbewahrung";
    if (pathname.startsWith("/admin/audit")) return "Protokoll";
    if (pathname.startsWith("/admin/users")) return "Benutzer";
    if (pathname.startsWith("/admin/clause-approvals")) return "Freigaben";
    return "Übersicht";
};

export const Layout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const pageTitle = getPageTitle(location.pathname);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [pageAnnouncement, setPageAnnouncement] = useState("");
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { isOpen: showTour, setIsOpen: setShowTour, startTour } = useOnboardingTour();

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
            // Trigger global search (could emit event or set state)
            const searchInput = document.querySelector('[data-global-search]') as HTMLInputElement;
            searchInput?.focus();
        },
        onNewDocument: () => navigate("/generate"),
        onHelp: () => setShowShortcuts(true),
    });

    return (
        <div className="flex min-h-screen bg-background font-sans text-foreground">
            {/* Skip to main content link for keyboard users */}
            <SkipLink targetId="main-content" />

            {/* Live region for page announcements */}
            <LiveRegion message={pageAnnouncement} priority="polite" />

            {/* Desktop Sidebar - hidden on mobile */}
            <div className="hidden lg:block">
                <Sidebar />
            </div>

            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-hidden="true"
                    />
                    {/* Sidebar */}
                    <div className="relative w-64 h-full">
                        <Sidebar />
                        {/* Close button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-4 right-4 lg:hidden"
                            onClick={() => setMobileMenuOpen(false)}
                            aria-label="Menü schließen"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            )}

            <main className="flex-1 overflow-auto" role="main">
                <header className="h-16 px-4 lg:px-6 flex items-center justify-between glass-header" role="banner">
                    <div className="flex items-center gap-3">
                        {/* Mobile menu button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden"
                            onClick={() => setMobileMenuOpen(true)}
                            aria-label="Menü öffnen"
                            aria-expanded={mobileMenuOpen}
                        >
                            <Menu className="w-5 h-5" />
                        </Button>
                        <h2 className="text-lg font-semibold text-foreground" aria-live="polite">
                            {pageTitle}
                        </h2>
                    </div>
                    <nav className="flex items-center gap-2 lg:gap-4" aria-label="Schnellaktionen">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={startTour}
                            aria-label="Einführungstour starten"
                            title="Tour starten"
                        >
                            <HelpCircle className="w-5 h-5" aria-hidden="true" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowShortcuts(true)}
                            aria-label="Tastaturkürzel anzeigen"
                            title="Tastaturkürzel (? oder Cmd+/)"
                        >
                            <Keyboard className="w-5 h-5" aria-hidden="true" />
                        </Button>
                        <CountrySelector />
                        <NotificationDropdown />
                    </nav>
                </header>
                <div id="main-content" className="p-6 max-w-7xl mx-auto" tabIndex={-1}>
                    <Outlet />
                </div>
            </main>

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
