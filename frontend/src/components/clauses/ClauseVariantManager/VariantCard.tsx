import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Trash2,
    Star,
    MoreVertical,
    FileText,
    GripVertical,
    Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClauseVariant } from "./types";

// Hilfsfunktion zum Kürzen und Bereinigen von HTML-Inhalten
export const truncateContent = (html: string | undefined, maxLength: number = 300): string => {
    if (!html) return "Kein Inhalt verfügbar";
    const text = html.replace(/<[^>]*>/g, "").trim();
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
};

interface VariantCardProps {
    variant: ClauseVariant;
    onSetDefault: () => void;
    onDelete: () => void;
}

export const VariantCard = ({
    variant,
    onSetDefault,
    onDelete,
}: VariantCardProps) => {
    return (
        <div
            className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-all",
                variant.is_default
                    ? "border-[#6EBD84] bg-secondary/5"
                    : "border-border hover:border-primary/30"
            )}
        >
            <div className="mt-1 text-muted-foreground cursor-grab">
                <GripVertical className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    {variant.variant_code && (
                        <Badge variant="outline" className="text-xs font-mono">
                            {variant.variant_code}
                        </Badge>
                    )}
                    <span className="font-medium text-foreground">{variant.variant_name}</span>
                    {variant.is_default && (
                        <Badge className="bg-secondary/10 text-secondary text-xs">
                            <Star className="w-3 h-3 mr-1 fill-current" />
                            Standard
                        </Badge>
                    )}
                </div>

                {variant.clause_title && (
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1 cursor-help hover:text-primary transition-colors">
                                    <FileText className="w-3 h-3" />
                                    <span className="truncate">{variant.clause_title}</span>
                                    <Eye className="w-3 h-3 ml-1 opacity-50" />
                                </p>
                            </TooltipTrigger>
                            <TooltipContent
                                side="right"
                                className="max-w-md p-3 text-sm"
                                sideOffset={5}
                            >
                                <div className="space-y-2">
                                    <div className="font-medium text-foreground border-b pb-1">
                                        {variant.clause_title}
                                    </div>
                                    <p className="text-muted-foreground leading-relaxed">
                                        {truncateContent(variant.clause_content_preview)}
                                    </p>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {variant.description && (
                    <p className="text-xs text-muted-foreground mt-1 italic">{variant.description}</p>
                )}
            </div>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {!variant.is_default && (
                        <DropdownMenuItem onClick={onSetDefault}>
                            <Star className="w-4 h-4 mr-2" />
                            Als Standard festlegen
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Entfernen
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};
