import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Sparkles, FolderOpen, LayoutTemplate,
  Users, Clock, ShieldCheck, Settings, Plus, Moon, Sun,
  LogOut, PanelLeftClose, PanelLeft, X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/stores/ui-store'
import { Button } from '@/components/ui/button'

/**
 * §6 — AppSidebar
 *
 * Fixed left sidebar with glass effect, collapsible,
 * mobile overlay support. Uses Framer Motion for animations.
 */

// ── Navigation Config ──────────────────────────────────────
const NAV_MAIN = [
  { label: 'Dashboard',    to: '/',           icon: LayoutDashboard },
  { label: 'KI Agent',     to: '/agent',      icon: Sparkles, badge: 'KI' },
  { label: 'Repository',   to: '/documents',  icon: FolderOpen },
  { label: 'Vorlagen',     to: '/templates',  icon: LayoutTemplate },
] as const

const NAV_MGMT = [
  { label: 'Teams',        to: '/teams',      icon: Users },
  { label: 'Fristen',      to: '/deadlines',  icon: Clock },
  { label: 'Compliance',   to: '/compliance', icon: ShieldCheck },
  { label: 'Einstellungen', to: '/settings',  icon: Settings },
] as const

// ── Nav Item ───────────────────────────────────────────────
function NavItem({
  icon: Icon, label, to, badge, collapsed, active,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  to: string
  badge?: string
  collapsed: boolean
  active: boolean
}) {
  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'group flex items-center transition-all duration-150 rounded-[var(--radius-sm-ds)] w-full',
        collapsed ? 'justify-center px-0 py-2.5' : 'gap-[11px] px-[10px] py-[9px]',
        active
          ? 'bg-[var(--nw-blue-50)] text-[var(--nw-blue)] font-semibold dark:bg-[rgba(36,49,134,0.18)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
      )}
    >
      <Icon className="shrink-0 w-[18px] h-[18px] stroke-[1.8]" aria-hidden="true" />
      {!collapsed && <span className="text-[13.5px] font-medium">{label}</span>}
      {!collapsed && badge && (
        <span className="ml-auto text-[9px] font-bold px-[7px] py-[2px] rounded-full bg-[var(--nw-blue)] text-white uppercase tracking-[0.04em]">
          {badge}
        </span>
      )}
    </Link>
  )
}

// ── Section Label ──────────────────────────────────────────
function SectionLabel({ children, collapsed }: { children: string; collapsed: boolean }) {
  if (collapsed) return null
  return (
    <span className="block px-[10px] pt-3 pb-[6px] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.08em]">
      {children}
    </span>
  )
}

// ── Sidebar ────────────────────────────────────────────────
interface AppSidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function AppSidebar({ mobileOpen = false, onMobileClose }: AppSidebarProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)

  const isDark = theme === 'dark'
  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const isActive = (to: string) =>
    to === '/' ? pathname === '/' : pathname.startsWith(to)

  const sidebarContent = (
    <div
      className={cn(
        'h-screen flex flex-col font-sans transition-all duration-200',
        'glass-sidebar',
        collapsed ? 'w-[72px]' : 'w-[248px]',
      )}
      style={{ padding: collapsed ? '24px 8px 16px' : '24px 14px 16px' }}
    >
      {/* Brand Header */}
      <div className={cn(
        'flex items-center shrink-0 mb-6',
        collapsed ? 'justify-center' : 'gap-[10px] px-2',
      )}>
        <Link to="/" className="flex items-center gap-[10px]" title={collapsed ? 'Niederwieser Docs' : undefined}>
          <div className={cn(
            'flex items-center justify-center bg-[var(--nw-blue)] text-white font-extrabold rounded-[10px]',
            'shadow-[0_2px_8px_rgba(36,49,134,0.3)]',
            collapsed ? 'w-8 h-8 text-[13px]' : 'w-9 h-9 text-[15px]',
          )}>
            N
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-bold text-[var(--text-primary)]">Niederwieser Docs</div>
              <span className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.07em]">
                Smart Document Generator
              </span>
            </div>
          )}
        </Link>
        {mobileOpen && onMobileClose && (
          <button
            onClick={onMobileClose}
            className="lg:hidden ml-auto p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            aria-label="Sidebar schließen"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* CTA Button */}
      {!collapsed ? (
        <button
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3 px-4 mb-7',
            'bg-[var(--nw-blue)] text-white rounded-[var(--radius-md)]',
            'text-[13.5px] font-semibold',
            'shadow-blue-sm transition-all duration-150',
            'hover:bg-[var(--nw-blue-light)] hover:-translate-y-px',
            pathname === '/generate' && 'opacity-50 pointer-events-none',
          )}
          onClick={() => navigate('/generate')}
          disabled={pathname === '/generate'}
        >
          <Plus size={16} strokeWidth={2.2} />
          Neues Dokument
        </button>
      ) : (
        <div className="mb-5">
          <Button
            size="icon"
            className="w-full h-9 rounded-[var(--radius-sm-ds)]"
            onClick={() => navigate('/generate')}
            disabled={pathname === '/generate'}
            title="Neues Dokument"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className={cn(
        'flex-1 overflow-y-auto scrollbar-hide',
        collapsed ? 'px-1 space-y-1' : 'space-y-px',
      )} aria-label="Hauptnavigation">
        <SectionLabel collapsed={collapsed}>Hauptmenü</SectionLabel>
        {NAV_MAIN.map((item) => (
          <NavItem
            key={item.to}
            {...item}
            badge={'badge' in item ? item.badge : undefined}
            collapsed={collapsed}
            active={isActive(item.to)}
          />
        ))}

        <SectionLabel collapsed={collapsed}>Verwaltung</SectionLabel>
        {NAV_MGMT.map((item) => (
          <NavItem
            key={item.to}
            {...item}
            collapsed={collapsed}
            active={isActive(item.to)}
          />
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="mt-auto pt-3.5 border-t border-[var(--border-light)]">
        {/* Collapse toggle (desktop only) */}
        <button
          onClick={toggleSidebar}
          className="hidden lg:flex nav-item w-full items-center gap-[11px] px-[10px] py-[9px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] rounded-[var(--radius-sm-ds)] transition-all duration-150 mb-1"
          title={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && <span className="text-[13px] font-medium">Einklappen</span>}
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-[11px] w-full px-[10px] py-[9px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] rounded-[var(--radius-sm-ds)] transition-all duration-150 mb-1"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
          {!collapsed && <span className="text-[13px] font-medium">{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        {/* User profile */}
        <div className={cn(
          'flex items-center gap-2.5 p-2 rounded-[var(--radius-sm)]',
          collapsed ? 'justify-center' : '',
        )}>
          <div className="flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg, var(--nw-blue-700), var(--nw-blue-400))' }}>
            {user?.email?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                  {user?.email ?? 'Unbekannt'}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)]">
                  {user?.role === 'admin' ? 'Administrator' : 'Benutzer'}
                </div>
              </div>
              <button
                onClick={logout}
                className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                title="Abmelden"
              >
                <LogOut size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed top-0 left-0 z-20 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
            />
            <motion.aside
              className="fixed top-0 left-0 z-50 h-screen lg:hidden"
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
