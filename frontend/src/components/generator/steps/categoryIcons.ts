import {
    Briefcase,
    FileX,
    Mail,
    MessageSquare,
    Award,
    FilePlus,
    AlertTriangle,
    FileText,
    type LucideIcon,
} from "lucide-react";

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
    vertrag: Briefcase,
    contract: Briefcase,
    beendigung: FileX,
    brief: Mail,
    letter: Mail,
    mitteilung: MessageSquare,
    memo: MessageSquare,
    bescheinigung: Award,
    certificate: Award,
    nachtrag: FilePlus,
    amendment: FilePlus,
    disziplinar: AlertTriangle,
};

export function getCategoryIcon(category?: string): LucideIcon {
    if (!category) return FileText;
    return CATEGORY_ICON_MAP[category.toLowerCase()] ?? FileText;
}

// Re-export existing category label translation
const CATEGORY_LABELS: Record<string, string> = {
    contract: "Vertrag",
    letter: "Brief",
    memo: "Mitteilung",
    certificate: "Bescheinigung",
    amendment: "Nachtrag",
    default: "Allgemein",
};

export function translateCategory(category: string): string {
    const lower = category.toLowerCase();
    return CATEGORY_LABELS[lower] || category;
}
