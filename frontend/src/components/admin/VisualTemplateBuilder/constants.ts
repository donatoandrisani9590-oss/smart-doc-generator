// ============================================================================
// Category Icons Mapping
// ============================================================================

import {
    FileText,
    Layers,
    Calendar,
    Type,
    Hash,
    ToggleLeft,
    FileCheck,
} from "lucide-react";
import type { CategoryIconsMap } from "./types";

export const categoryIcons: CategoryIconsMap = {
    Arbeitszeit: FileText,
    Verguetung: Hash,
    Urlaub: Calendar,
    Kuendigung: FileCheck,
    Sonstiges: Layers,
    Formular: Type,
    Datum: Calendar,
    Toggle: ToggleLeft,
};

export const getCategoryIcon = (category: string): React.ElementType => {
    return categoryIcons[category] || FileText;
};
