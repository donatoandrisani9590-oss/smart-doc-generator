/**
 * Layout - Design System v5.0 (Sidebar Navigation + Background Orbs)
 *
 * - Fixed left sidebar (248px) as primary navigation
 * - Content area offset by sidebar width
 * - Background orbs: animated ambient gradient blobs
 * - Mobile: hamburger button + overlay sidebar
 * - Subtle footer anchor
 */

import { useState, useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ReactLenis, type LenisRef } from "lenis/react";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { CommandPalette } from "./CommandPalette";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { SkipLink, LiveRegion } from "@/hooks/useAccessibility";
import { useEventStream } from "@/hooks/useEventStream";
import { Button } from "@/components/ui/button";
import { ScrollProgress } from "@/components/ui/scroll-progress";
import { PageTransition } from "@/components/ui/page-transition";

// Register GSAP plugins globally (once)
gsap.registerPlugin(ScrollTrigger, useGSAP);

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
    if (pathname.startsWith("/templates")) return "Vorlagen";
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
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const lenisRef = useRef<LenisRef>(null);
    const layoutRef = useRef<HTMLDivElement>(null);

    // SSE Real-time Updates
    useEventStream();

    // Sync Lenis smooth scroll with GSAP's ticker + ScrollTrigger
    useEffect(() => {
        const lenis = lenisRef.current?.lenis;
        if (!lenis) return;

        lenis.on("scroll", ScrollTrigger.update);

        const update = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(update);
        gsap.ticker.lagSmoothing(0);

        return () => {
            lenis.off("scroll", ScrollTrigger.update);
            gsap.ticker.remove(update);
        };
    }, []);

    // Initial app-load animation: sidebar slides in, content fades in, orbs drift
    useGSAP(() => {
        const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (prefersReduced) return;

        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

        tl.from("[data-gsap='sidebar']", {
            x: -20,
            opacity: 0,
            duration: 0.5,
        })
        .from("[data-gsap='main']", {
            y: 12,
            opacity: 0,
            duration: 0.5,
        }, "-=0.3");

        // Ambient orb drift animation
        gsap.to(".bg-orb-1", {
            x: 40, y: 30,
            duration: 18, repeat: -1, yoyo: true, ease: "sine.inOut",
        });
        gsap.to(".bg-orb-2", {
            x: -30, y: -20,
            duration: 22, repeat: -1, yoyo: true, ease: "sine.inOut",
        });
        gsap.to(".bg-orb-3", {
            x: 20, y: -25,
            duration: 15, repeat: -1, yoyo: true, ease: "sine.inOut",
        });
    }, { scope: layoutRef });

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
        <ReactLenis
            root
            ref={lenisRef}
            options={{ autoRaf: false, lerp: 0.1, duration: 1.2 }}
        >
            <div ref={layoutRef} className="min-h-screen bg-background font-sans text-foreground">
                <ScrollProgress />
                <SkipLink targetId="main-content" />
                <LiveRegion message={pageAnnouncement} priority="polite" />

                {/* Background Orbs (Prototype ambient gradient blobs) */}
                <div className="bg-orbs" aria-hidden="true">
                    <div className="bg-orb bg-orb-1" />
                    <div className="bg-orb bg-orb-2" />
                    <div className="bg-orb bg-orb-3" />
                </div>

                {/* Sidebar Navigation */}
                <div data-gsap="sidebar">
                    <Sidebar
                        mobileOpen={mobileSidebarOpen}
                        onMobileClose={() => setMobileSidebarOpen(false)}
                    />
                </div>

                {/* Main Content — offset by sidebar width on desktop, above orbs */}
                <div className="lg:ml-[var(--sidebar-width)] min-h-screen flex flex-col main-content relative z-[1]">
                    {/* Mobile header bar with hamburger */}
                    <div className="lg:hidden sticky top-0 z-30 h-14 px-4 flex items-center justify-between bg-[var(--bg-surface)]/80 backdrop-blur-md border-b border-[rgba(0,0,0,0.04)] dark:border-[rgba(255,255,255,0.06)]">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setMobileSidebarOpen(true)}
                            aria-label="Menü öffnen"
                        >
                            <Menu className="w-5 h-5" />
                        </Button>
                        <span className="text-sm font-medium text-[var(--text-secondary)]">
                            {pageTitle}
                        </span>
                        <div className="w-9" />
                    </div>

                    <main
                        id="main-content"
                        className="flex-1 overflow-x-hidden"
                        role="main"
                        tabIndex={-1}
                        data-gsap="main"
                    >
                        <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-[1380px] mx-auto w-full">
                            <PageTransition>
                                <Outlet />
                            </PageTransition>
                        </div>
                    </main>

                    {/* Footer */}
                    <Footer />
                </div>

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
        </ReactLenis>
    );
};
