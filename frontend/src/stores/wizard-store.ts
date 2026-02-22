import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * §61 Contract 1B — Wizard Client State
 *
 * All wizard-related UI state lives here. Server data (document types,
 * clauses, etc.) is fetched via TanStack Query, never stored in Zustand.
 */

interface WizardStore {
  currentStep: number
  documentTypeId: number | null
  formData: Record<string, unknown>
  selectedClauseIds: number[]
  tone: number
  stationeryId: number | null

  setStep: (step: number) => void
  setDocumentType: (id: number | null) => void
  setFormField: (key: string, value: unknown) => void
  setFormData: (data: Record<string, unknown>) => void
  toggleClause: (id: number) => void
  setSelectedClauses: (ids: number[]) => void
  setTone: (tone: number) => void
  setStationery: (id: number | null) => void
  reset: () => void
}

const initialState = {
  currentStep: 0,
  documentTypeId: null as number | null,
  formData: {} as Record<string, unknown>,
  selectedClauseIds: [] as number[],
  tone: 3,
  stationeryId: null as number | null,
}

export const useWizardStore = create<WizardStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setStep: (step) => set({ currentStep: step }),
      setDocumentType: (id) => set({ documentTypeId: id }),
      setFormField: (key, value) =>
        set({ formData: { ...get().formData, [key]: value } }),
      setFormData: (data) =>
        set({ formData: { ...get().formData, ...data } }),
      toggleClause: (id) =>
        set((s) => ({
          selectedClauseIds: s.selectedClauseIds.includes(id)
            ? s.selectedClauseIds.filter((c) => c !== id)
            : [...s.selectedClauseIds, id],
        })),
      setSelectedClauses: (ids) => set({ selectedClauseIds: ids }),
      setTone: (tone) => set({ tone }),
      setStationery: (id) => set({ stationeryId: id }),
      reset: () => set(initialState),
    }),
    { name: 'nw-wizard' }
  )
)
