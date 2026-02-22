import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { ReactLenis } from 'lenis/react'
import { AppSidebar } from './AppSidebar'
import { BackgroundOrbs } from './BackgroundOrbs'
import { PageTransition } from './PageTransition'
import { Footer } from './Footer'
import { CommandPalette } from './CommandPalette'
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog'
import { Button } from '@/components/ui/button'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useUIStore } from '@/stores/ui-store'

/**
 * §6 — AppShell
 *
 * Top-level layout: sidebar + main content area.
 * Renders BackgroundOrbs ONCE for the entire app.
 * Lenis for smooth scrolling, Framer Motion for transitions.
 */

const PAGE_TITLES: Record<string, string> = {
  '/':              'Übersicht',
  '/generate':      'Neues Dokument',
  '/agent':         'KI-Assistent',
  '/documents':     'Dokumente',
  '/bulk':          'Massen-Import',
  '/search':        'Suche',
  '/teams':         'Teams',
  '/deadlines':     'Fristen',
  '/notifications': 'Benachrichtigungen',
  '/templates':     'Vorlagen',
  '/settings':      'Einstellungen',
  '/compliance':    'Compliance',
}

function getPageTitle(pathname: string): string {
  if (pathname === '/') return PAGE_TITLES['/']
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (path !== '/' && pathname.startsWith(path)) return title
  }
  return 'Seite nicht gefunden'
}

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const pageTitle = getPageTitle(location.pathname)

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [location.pathname])

  // Announce page for screen readers
  useEffect(() => {
    document.title = `${pageTitle} — Niederwieser Docs`
  }, [pageTitle])

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    onSearch: () => setCommandPaletteOpen(true),
    onNewDocument: () => navigate('/generate'),
    onHelp: () => setShowShortcuts(true),
  })

  // Sidebar width CSS variable
  const sidebarWidth = collapsed ? '72px' : '248px'

  return (
    <ReactLenis root options={{ lerp: 0.1, duration: 1.2 }}>
      <div className="min-h-screen bg-background font-sans text-foreground">
        {/* Skip link for accessibility (§55) */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-[var(--nw-blue)]"
        >
          Zum Hauptinhalt springen
        </a>

        {/* Live region for page changes (§55) */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          Seite: {pageTitle}
        </div>

        {/* Background orbs — rendered ONCE (§60.3) */}
        <BackgroundOrbs />

        {/* Sidebar */}
        <AppSidebar
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        {/* Main content — offset by sidebar width on desktop */}
        <div
          className="min-h-screen flex flex-col relative z-[1]"
          style={{ marginLeft: `var(--sidebar-offset, ${sidebarWidth})` }}
        >
          {/* Mobile header bar */}
          <div className="lg:hidden sticky top-0 z-30 h-14 px-4 flex items-center justify-between glass-header-bar">
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
            <div className="w-9" aria-hidden />
          </div>

          {/* Page content */}
          <main
            id="main-content"
            className="flex-1 overflow-x-hidden"
            role="main"
            tabIndex={-1}
          >
            <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-[1380px] mx-auto w-full">
              <PageTransition>
                <Outlet />
              </PageTransition>
            </div>
          </main>

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
      </div>
    </ReactLenis>
  )
}
