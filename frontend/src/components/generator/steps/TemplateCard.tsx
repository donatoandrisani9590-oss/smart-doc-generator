/* eslint-disable react-hooks/static-components -- Icon is a stable Lucide component reference from lookup table */
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getCategoryIcon, translateCategory } from "./categoryIcons";

interface DocumentType {
    id: number;
    name: string;
    category?: string;
    description?: string | null;
    updated_at?: string | null;
}

interface TemplateCardProps {
    type: DocumentType;
    /** Compact mode for "Zuletzt verwendet" row */
    compact?: boolean;
    onClick: (type: DocumentType) => void;
}

export function TemplateCard({ type, compact, onClick }: TemplateCardProps) {
    const Icon = getCategoryIcon(type.category);

    if (compact) {
        return (
            <button
                onClick={() => onClick(type)}
                className={cn(
                    "flex items-center gap-2.5 p-3 rounded-xl bg-white border border-warm-100",
                    "transition-all duration-300 ease-out cursor-pointer text-left w-full",
                    "hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                )}
                aria-label={`${type.name} auswählen`}
            >
                <Icon className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
                <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {type.name}
                </span>
            </button>
        );
    }

    return (
        <button
            onClick={() => onClick(type)}
            className={cn(
                "flex flex-col items-start p-5 rounded-2xl bg-white border border-warm-100",
                "transition-all duration-300 ease-out cursor-pointer text-left w-full",
                "hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            )}
            aria-label={`${type.name} auswählen`}
        >
            <Icon className="w-6 h-6 text-[var(--text-tertiary)] mb-3" />
            <span className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight">
                {type.name}
            </span>
            {type.description && (
                <span className="text-sm text-[var(--text-tertiary)] mt-1 line-clamp-2">
                    {type.description}
                </span>
            )}
            {type.category && (
                <Badge
                    variant="outline"
                    className="mt-3 text-[11px] font-normal text-[var(--text-tertiary)] border-warm-200"
                >
                    {translateCategory(type.category)}
                </Badge>
            )}
        </button>
    );
}
