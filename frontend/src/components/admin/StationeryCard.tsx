/**
 * StationeryCard - Visual card for a Briefpapier (letterhead) template
 *
 * Displays a thumbnail preview (or placeholder icon) with metadata badges
 * and hover-action buttons for download, set-as-default, and delete.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    FileText,
    Download,
    Star,
    Trash2,
    Pencil,
    Image,
    PanelTop,
    PanelBottom,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
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
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function StationeryCard({ template, onSetDefault, onDelete, onDownload, onEdit }: StationeryCardProps) {
    return (
        <Card className="group hover:shadow-md transition-all overflow-hidden">
            {/* Thumbnail area - 3:4 aspect ratio */}
            <div className="relative aspect-[3/4] bg-warm-50 border-b border-warm-200 overflow-hidden">
                {template.thumbnail_url ? (
                    <img
                        src={template.thumbnail_url}
                        alt={template.name}
                        className="w-full h-full object-contain"
                    />
                ) : (
                    /* Placeholder with document icon */
                    <div className="w-full h-full flex items-center justify-center">
                        <FileText className="w-16 h-16 text-warm-400" />
                    </div>
                )}

                {/* Default star badge - top right */}
                {template.is_default && (
                    <div className="absolute top-2 right-2">
                        <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">
                            <Star className="w-3 h-3 mr-1 fill-yellow-500" />
                            Standard
                        </Badge>
                    </div>
                )}

                {/* Hover overlay with actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-end justify-center pb-3 opacity-0 group-hover:opacity-100">
                    <div className="flex gap-1">
                        {template.is_own && (
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => onEdit(template)}
                                title="Bearbeiten"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onDownload(template)}
                            title="Herunterladen"
                        >
                            <Download className="w-3.5 h-3.5" />
                        </Button>
                        {!template.is_default && (
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => onSetDefault(template.id)}
                                title="Als Standard setzen"
                            >
                                <Star className="w-3.5 h-3.5" />
                            </Button>
                        )}
                        {template.is_own && (
                            <Button
                                size="sm"
                                variant="secondary"
                                className="text-destructive hover:text-destructive"
                                onClick={() => onDelete(template)}
                                title="Löschen"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Info area */}
            <CardContent className="p-3">
                <h4 className="font-medium text-sm truncate" title={template.name}>
                    {template.name}
                </h4>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {template.country_code && (
                        <Badge variant="outline" className="text-[10px]">
                            {template.country_code}
                        </Badge>
                    )}
                    {template.has_logo && (
                        <Badge variant="secondary" className="text-[10px] gap-1 py-0 px-1.5">
                            <Image className="w-2.5 h-2.5" />
                            Logo
                        </Badge>
                    )}
                    {template.has_header && (
                        <Badge variant="secondary" className="text-[10px] gap-1 py-0 px-1.5">
                            <PanelTop className="w-2.5 h-2.5" />
                            Kopfzeile
                        </Badge>
                    )}
                    {template.has_footer && (
                        <Badge variant="secondary" className="text-[10px] gap-1 py-0 px-1.5">
                            <PanelBottom className="w-2.5 h-2.5" />
                            Fusszeile
                        </Badge>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default StationeryCard;
