/**
 * Constants for the ClausesPage module
 *
 * Category-to-color mapping for visual orientation in clause lists.
 */

/** Tailwind border-left color classes mapped to clause categories */
export const CATEGORY_COLORS: Record<string, string> = {
    'Einleitung': 'border-l-blue-500',
    'Vergütung': 'border-l-emerald-500',
    'Kündigung': 'border-l-red-500',
    'Arbeitszeit': 'border-l-amber-500',
    'Urlaub': 'border-l-cyan-500',
    'Nebentätigkeit': 'border-l-purple-500',
    'Geheimhaltung': 'border-l-slate-500',
    'Wettbewerb': 'border-l-orange-500',
    'Probezeit': 'border-l-lime-500',
    'Sonstiges': 'border-l-warm-400',
    'Allgemein': 'border-l-primary',
};

/** Returns the Tailwind border-left color class for a given category */
export const getCategoryColor = (category: string | undefined): string => {
    if (!category) return CATEGORY_COLORS['Allgemein'];
    return CATEGORY_COLORS[category] || 'border-l-primary';
};
