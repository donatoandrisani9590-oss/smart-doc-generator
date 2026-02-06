/**
 * UI Configuration
 *
 * Centralized timing constants for debounce, animations,
 * undo/redo history, and other UI behavior.
 */

/** Debounce timings in milliseconds */
export const DEBOUNCE = {
  /** Search input debounce (e.g. global search, settings search) */
  search: 300,
  /** Undo/redo history commit debounce */
  undoRedo: 300,
  /** Toast-based undo action expiry (time before action becomes permanent) */
  undoToast: 5_000,
  /** Progress bar update interval in undo toast */
  undoProgressInterval: 50,
} as const;

/** Undo/redo state history limits */
export const HISTORY = {
  /** Maximum number of states kept in the undo/redo stack */
  maxUndoSteps: 50,
} as const;

/** Pagination defaults */
export const PAGINATION = {
  /** Default items per page in list views */
  defaultPageSize: 20,
} as const;
