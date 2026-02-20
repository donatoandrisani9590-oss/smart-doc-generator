/**
 * StationeryCard - Ive-fidelity card for a Briefpapier (letterhead) template
 *
 * Compact card with mini-canvas A4 preview showing header/footer zone bands,
 * metadata badges, and a DropdownMenu for all CRUD actions.
 */

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    MoreVertical,
    Pencil,
    Download,
    Star,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES (unchanged — same export contract)
// ═══════════════════════════════════════════════════════════════════════════

export interface StationeryTemplate {
    id: number;
    name: string;
    description: string | null;
    original_filename: string;
    file_size: number;
    country_code: string | null;
    has_header: boolean;
    has_footer: boolean;
    has_logo: boolean;
    font_family: string | null;
    scope: "company" | "team" | "private";
    team_id: number | null;
    category: string | null;
    template_type: "stationery" | "content";
    is_default: boolean;
    is_own: boolean;
    thumbnail_url: string | null;
    created_at: string;
    updated_at: string | null;
}

interface StationeryCardProps {
    template: StationeryTemplate;
    onSetDefault: (id: number) => void;
    onDelete: (template: StationeryTemplate) => void;
    onDownload: (template: StationeryTemplate) => void;
    onEdit: (template: StationeryTemplate) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// MINI-CANVAS — schematic A4 preview with header/footer zone bands
// ═══════════════════════════════════════════════════════════════════════════

function MiniCanvas({ template }: { template: StationeryTemplate }) {
    return (
        <div className="flex items-center justify-center p-5 bg-[var(--canvas-desk)]">
            <div
                className="relative w-full bg-white rounded-sm"
                style={{
                    aspectRatio: "210 / 297",
                    boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
                }}
            >
                {/* Header zone band */}
                {template.has_header && (
                    <div className="absolute top-0 inset-x-0 h-[14%] bg-[var(--canvas-desk)] rounded-t-sm flex items-center justify-center">
                        {template.has_logo && (
                            <div className="w-6 h-2.5 rounded-[2px] bg-[#C8C8CC]" />
                        )}
                    </div>
                )}

                {/* Text line hints — centered body area */}
                <div className="absolute inset-x-0 flex flex-col gap-[5px] px-[18%]" style={{ top: template.has_header ? "22%" : "12%" }}>
                    <div className="h-[2px] rounded-full bg-[#E5E5EA] w-[70%]" />
                    <div className="h-[2px] rounded-full bg-[#E5E5EA] w-full" />
                    <div className="h-[2px] rounded-full bg-[#E5E5EA] w-[85%]" />
                    <div className="h-[2px] rounded-full bg-[#E5E5EA] w-[60%]" />
                </div>

                {/* Footer zone band */}
                {template.has_footer && (
                    <div className="absolute bottom-0 inset-x-0 h-[10%] bg-[var(--canvas-desk)] rounded-b-sm" />
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function StationeryCard({ template, onSetDefault, onDelete, onDownload, onEdit }: StationeryCardProps) {
    return (
        <div className="widget-card widget-card-interactive overflow-hidden !p-0">
            {/* Canvas preview area */}
            <div className="relative">
                {template.thumbnail_url ? (
                    <div className="flex items-center justify-center p-5 bg-[var(--canvas-desk)]">
                        <img
                            src={template.thumbnail_url}
                            alt={template.name}
                            className="w-full rounded-sm object-contain"
                            style={{
                                aspectRatio: "210 / 297",
                                boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
                            }}
                        />
                    </div>
                ) : (
                    <MiniCanvas template={template} />
                )}

                {/* Standard badge — top right of canvas */}
                {template.is_default && (
                    <div className="absolute top-2.5 right-2.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60 rounded-md px-2 py-0.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                            Standard
                        </span>
                    </div>
                )}
            </div>

            {/* Info section */}
            <div className="px-4 py-3">
                {/* Title row + dropdown trigger */}
                <div className="flex items-center justify-between gap-2">
                    <h4
                        className="text-sm font-medium text-[var(--canvas-text)] truncate"
                        title={template.name}
                    >
                        {template.name}
                    </h4>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className={cn(
                                    "shrink-0 inline-flex items-center justify-center rounded-md",
                                    "w-7 h-7 text-muted-foreground/60 hover:text-foreground",
                                    "hover:bg-muted/50 transition-colors",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                )}
                            >
                                <MoreVertical className="w-4 h-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => onEdit(template)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Bearbeiten
                            </DropdownMenuItem>
                            {!template.is_default && (
                                <DropdownMenuItem onClick={() => onSetDefault(template.id)}>
                                    <Star className="w-4 h-4 mr-2" />
                                    Als Standard setzen
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => onDownload(template)}>
                                <Download className="w-4 h-4 mr-2" />
                                Herunterladen
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => onDelete(template)}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Löschen
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Metadata badges */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {template.country_code && (
                        <span className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-0.5">
                            {template.country_code}
                        </span>
                    )}
                    {template.has_header && (
                        <span className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-0.5">
                            Kopfzeile
                        </span>
                    )}
                    {template.has_footer && (
                        <span className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-0.5">
                            Fusszeile
                        </span>
                    )}
                    {template.has_logo && (
                        <span className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-0.5">
                            Logo
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default StationeryCard;
