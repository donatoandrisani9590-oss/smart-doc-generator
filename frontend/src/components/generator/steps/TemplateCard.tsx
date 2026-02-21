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
                    "flex items-center gap-2.5 p-3 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border)]",
                    "transition-all duration-200 cursor-pointer text-left w-full shadow-[var(--shadow-sm)]",
                    "hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nw-blue)]/30"
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
                "flex flex-col items-start p-6 rounded-[var(--radius-lg)] bg-[var(--bg-surface)] border border-[var(--border)]",
                "transition-all duration-200 cursor-pointer text-left w-full shadow-[var(--shadow-sm)]",
                "hover:-translate-y-[2px] hover:shadow-[var(--shadow-lg)] hover:border-[var(--nw-blue-100)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nw-blue)]/30"
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
                    className="mt-3 text-[11px] font-normal text-[var(--text-tertiary)] border-[var(--border)]"
                >
                    {translateCategory(type.category)}
                </Badge>
            )}
        </button>
    );
}
