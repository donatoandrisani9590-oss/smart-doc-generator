/**
 * HeaderNav - Translucent header bar (Ive redesign)
 *
 * Replaces sidebar as primary navigation.
 * - Left: Logo mark (home link)
 * - Center: Pill-based navigation with active state
 * - Right: Primary CTA, AI, notifications, user menu
 */

import { Link, useLocation, useNavigate } from "react-router-dom";
import { PlusCircle, Sparkles, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserMenu } from "./UserMenu";
import { useFeatureEnabled } from "@/hooks/useFeatureSettings";
import { useState } from "react";

const navItems = [
    { label: "Übersicht", href: "/", match: (p: string) => p === "/" },
    { label: "Dokumente", href: "/documents", match: (p: string) => p.startsWith("/documents") || p.startsWith("/search"), featureFlag: "show_documents_overview" as const },
    { label: "Vorlagen", href: "/settings?tab=templates", match: (p: string) => p === "/settings" && typeof window !== "undefined" && window.location.search.includes("tab=templates") },
    { label: "Einstellungen", href: "/settings", match: (p: string) => (p.startsWith("/settings") && !(typeof window !== "undefined" && window.location.search.includes("tab=templates"))) || p.startsWith("/admin") },
];

export const HeaderNav = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const pathname = location.pathname;
    const isDocumentsEnabled = useFeatureEnabled("show_documents_overview");
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const visibleNavItems = navItems.filter(item => {
        if (item.featureFlag === "show_documents_overview" && !isDocumentsEnabled) return false;
        return true;
    });

    const isActive = (item: typeof navItems[0]) => {
        if (item.href === "/settings?tab=templates") {
            return pathname === "/settings" && location.search.includes("tab=templates");
        }
        if (item.href === "/settings") {
            return (pathname.startsWith("/settings") && !location.search.includes("tab=templates")) || pathname.startsWith("/admin");
        }
        return item.match(pathname);
    };

    return (
        <>
            <header
                className="h-16 px-6 lg:px-8 flex items-center justify-between glass-header-bar z-40 sticky top-0"
                role="banner"
            >
                {/* Left: Logo */}
                <div className="flex items-center gap-4 shrink-0">
                    <Link to="/" className="flex items-center gap-2.5" aria-label="Startseite">
                        <img
                            src="/niederwieser-logo-blue.svg"
                            alt="Niederwieser"
                            className="h-6 w-auto dark:hidden"
                        />
                        <img
                            src="/niederwieser-logo.svg"
                            alt="Niederwieser"
                            className="h-6 w-auto hidden dark:block"
                        />
                        <div className="h-5 w-px bg-border/40 hidden lg:block" />
                        <span className="text-[11px] font-semibold text-foreground/30 uppercase tracking-[0.15em] hidden lg:block">
                            Docs
                        </span>
                    </Link>
                </div>

                {/* Center: Navigation Pills (desktop) */}
                <nav className="hidden lg:flex items-center gap-1" aria-label="Hauptnavigation">
                    {visibleNavItems.map((item) => (
                        <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                                "px-4 py-2 text-[13px] font-medium rounded-lg transition-all duration-200",
                                isActive(item)
                                    ? "text-foreground font-semibold bg-muted/40"
                                    : "text-foreground/50 hover:text-foreground hover:bg-muted/30"
                            )}
                            aria-current={isActive(item) ? "page" : undefined}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* New Document CTA */}
                    <Button
                        size="sm"
                        className="hidden sm:flex gap-2 rounded-full px-4 h-8 text-[12px] shadow-[var(--shadow-elevated)]"
                        onClick={() => navigate("/generate")}
                    >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Neues Dokument</span>
                    </Button>

                    {/* AI Assistant */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-foreground/30 hover:text-foreground/60"
                        onClick={() => navigate("/agent")}
                        aria-label="KI-Assistent"
                        title="KI-Assistent"
                    >
                        <Sparkles className="w-4 h-4" />
                    </Button>

                    {/* User Menu (includes theme + country) */}
                    <UserMenu />

                    {/* Mobile menu toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden h-9 w-9"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label={mobileMenuOpen ? "Menü schließen" : "Menü öffnen"}
                        aria-expanded={mobileMenuOpen}
                    >
                        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </Button>
                </div>
            </header>

            {/* Mobile Navigation Overlay */}
            {mobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 z-30 pt-16">
                    <div
                        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-hidden="true"
                    />
                    <nav className="relative bg-background shadow-[var(--shadow-elevated)] p-4 space-y-1" aria-label="Mobile Navigation">
                        {visibleNavItems.map((item) => (
                            <Link
                                key={item.href}
                                to={item.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className={cn(
                                    "block px-4 py-3 text-[13px] font-medium rounded-lg transition-colors",
                                    isActive(item)
                                        ? "text-foreground font-semibold bg-muted/40"
                                        : "text-foreground/50 hover:text-foreground hover:bg-muted/30"
                                )}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <div className="pt-2 mt-2">
                            <Link
                                to="/generate"
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-primary"
                            >
                                <PlusCircle className="w-4 h-4" />
                                Neues Dokument
                            </Link>
                        </div>
                    </nav>
                </div>
            )}
        </>
    );
};
