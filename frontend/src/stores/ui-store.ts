import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * §61 Contract 1B — UI Client State
 *
 * Persistent UI preferences that survive page reloads.
 * Theme, sidebar collapse, view mode preferences.
 */

interface UIStore {
  sidebarCollapsed: boolean
  repositoryView: 'kanban' | 'list'
  theme: 'light' | 'dark' | 'system'
  commandPaletteOpen: boolean

  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setRepositoryView: (view: 'kanban' | 'list') => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setCommandPaletteOpen: (open: boolean) => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      repositoryView: 'kanban',
      theme: 'system',
      commandPaletteOpen: false,

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setRepositoryView: (view) => set({ repositoryView: view }),
      setTheme: (theme) => set({ theme }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
    }),
    {
      name: 'nw-ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        repositoryView: state.repositoryView,
        theme: state.theme,
        // commandPaletteOpen is NOT persisted — always starts closed
      }),
    }
  )
)
