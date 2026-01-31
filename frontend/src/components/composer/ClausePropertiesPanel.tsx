/**
 * ClausePropertiesPanel - Rechte Spalte mit Klausel-Eigenschaften
 *
 * Smart UX Konzept Phase 2:
 * - Zeigt Details der ausgewählten Klausel
 * - Rich Text Editor für Local/Deviation Klauseln
 * - Deviation-Info mit Original-Vergleich
 * - Aktionen: Aufbrechen, In Bibliothek aufnehmen
 */

import { useState, useEffect } from "react";
import { useDebounce } from "use-debounce";
import {
    Lock,
    Edit3,
    Unlock,
    Star,
    Info,
    ExternalLink,
    Loader2,
    History,
    Eye,
    EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Collapsible,
    CollapsibleContent,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/utils/sanitize";
import { RichTextEditor } from "./RichTextEditor";
import type { ClauseInstance } from "./types";

interface ClausePropertiesPanelProps {
    clause: ClauseInstance | null;
    onUpdate: (id: number, updates: { title?: string; content_html?: string }) => Promise<void>;
    onDeviate: (id: number) => void;
    onPromote: (id: number) => void;
    isSaving?: boolean;
}

export const ClausePropertiesPanel = ({
    clause,
    onUpdate,
    onDeviate,
    onPromote,
    isSaving = false,
}: ClausePropertiesPanelProps) => {
    const [editedTitle, setEditedTitle] = useState("");
    const [editedContent, setEditedContent] = useState("");
    const [hasChanges, setHasChanges] = useState(false);
    const [showOriginal, setShowOriginal] = useState(false);

    // Sync mit ausgewählter Klausel (E2E-015 fix)
    // Wichtig: Auf relevante Felder reagieren, nicht auf das ganze Objekt,
    // um unnötige Re-Renders zu vermeiden während Änderungen synchronisiert werden
    const clauseId = clause?.id ?? null;
    const clauseTitle = clause?.title ?? "";
    const clauseContentHtml = clause?.content_html ?? "";
    const clauseOrigin = clause?.origin ?? null;

    useEffect(() => {
        if (clauseId !== null) {
            setEditedTitle(clauseTitle);
            setEditedContent(clauseContentHtml);
            setHasChanges(false);
            setShowOriginal(false);
        } else {
            // Reset wenn keine Klausel ausgewählt
            setEditedTitle("");
            setEditedContent("");
            setHasChanges(false);
            setShowOriginal(false);
        }
    }, [clauseId, clauseTitle, clauseContentHtml]);

    // Debounced Auto-Save
    const [debouncedTitle] = useDebounce(editedTitle, 1000);
    const [debouncedContent] = useDebounce(editedContent, 1000);

    useEffect(() => {
        if (clauseId === null || clauseOrigin === "global") return;

        const titleChanged = debouncedTitle !== clauseTitle;
        const contentChanged = debouncedContent !== clauseContentHtml;

        if (titleChanged || contentChanged) {
            onUpdate(clauseId, {
                ...(titleChanged && { title: debouncedTitle }),
                ...(contentChanged && { content_html: debouncedContent }),
            });
            setHasChanges(false);
        }
    }, [debouncedTitle, debouncedContent, clauseId, clauseTitle, clauseContentHtml, clauseOrigin, onUpdate]);

    const handleTitleChange = (value: string) => {
        setEditedTitle(value);
        setHasChanges(true);
    };

    const handleContentChange = (value: string) => {
        setEditedContent(value);
        setHasChanges(true);
    };

    // Keine Klausel ausgewählt
    if (!clause) {
        return (
            <div className="w-80 flex-shrink-0 border-l bg-muted/30 flex flex-col h-full">
                <div className="p-4 border-b bg-white">
                    <h2 className="font-semibold text-sm text-muted-foreground">Eigenschaften</h2>
                </div>
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="text-center">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                            <Info className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Wählen Sie eine Klausel aus, um ihre Eigenschaften zu sehen
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const isGlobal = clause.origin === "global";
    const isDeviation = clause.origin === "deviation";
    const isLocal = clause.origin === "local";
    const canEdit = !isGlobal;
    const canPromote = !isGlobal && clause.content_html;
    const hasOriginalSnapshot = isDeviation && clause.original_content_snapshot;

    return (
        <div className="w-80 flex-shrink-0 border-l bg-muted/30 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b bg-white">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-sm">Eigenschaften</h2>
                    {isSaving && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Speichern...</span>
                        </div>
                    )}
                    {hasChanges && !isSaving && (
                        <Badge variant="outline" className="text-xs">
                            Nicht gespeichert
                        </Badge>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
                {/* Status Card */}
                <Card className={cn(
                    "border-l-4",
                    isGlobal && "border-l-green-500",
                    (isLocal || isDeviation) && "border-l-blue-500"
                )}>
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            {isGlobal ? (
                                <Lock className="w-4 h-4 text-green-600" />
                            ) : (
                                <Edit3 className="w-4 h-4 text-blue-600" />
                            )}
                            <CardTitle className="text-sm">
                                {isGlobal ? "Standard-Klausel" : isDeviation ? "Abgewandelte Klausel" : "Individuelle Klausel"}
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <CardDescription className="text-xs">
                            {isGlobal && "Diese Klausel stammt aus der Bibliothek und ist schreibgeschützt."}
                            {isDeviation && "Diese Klausel wurde vom Standard abgewandelt."}
                            {isLocal && "Diese Klausel wurde speziell für dieses Dokument erstellt."}
                        </CardDescription>
                    </CardContent>
                </Card>

                {/* Deviation Info */}
                {isDeviation && clause.deviated_at && (
                    <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-3">
                            <div className="flex items-start gap-2">
                                <History className="w-4 h-4 text-blue-600 mt-0.5" />
                                <div className="text-xs">
                                    <p className="font-medium text-blue-800">
                                        Abgewandelt am {new Date(clause.deviated_at).toLocaleDateString("de-DE")}
                                    </p>
                                    {clause.deviated_reason && (
                                        <p className="text-blue-700 mt-1">
                                            Grund: {clause.deviated_reason}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Title */}
                <div className="space-y-2">
                    <Label htmlFor="clause-title" className="text-xs font-medium">
                        Titel
                    </Label>
                    {canEdit ? (
                        <Input
                            id="clause-title"
                            value={editedTitle}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            className="h-9"
                        />
                    ) : (
                        <div className="p-2 bg-muted rounded text-sm">{clause.title}</div>
                    )}
                </div>

                {/* Content - Rich Text Editor für editierbare Klauseln */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="clause-content" className="text-xs font-medium">
                            Inhalt
                        </Label>
                        {hasOriginalSnapshot && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => setShowOriginal(!showOriginal)}
                            >
                                {showOriginal ? (
                                    <>
                                        <EyeOff className="w-3 h-3 mr-1" />
                                        Original ausblenden
                                    </>
                                ) : (
                                    <>
                                        <Eye className="w-3 h-3 mr-1" />
                                        Original anzeigen
                                    </>
                                )}
                            </Button>
                        )}
                    </div>

                    {/* Original Content Comparison */}
                    {showOriginal && hasOriginalSnapshot && (
                        <Collapsible open={showOriginal}>
                            <CollapsibleContent>
                                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <History className="w-4 h-4 text-amber-600" />
                                        <span className="text-xs font-medium text-amber-800">
                                            Original (vor Abwandlung)
                                        </span>
                                    </div>
                                    <div
                                        className="text-sm prose prose-sm max-w-none text-amber-900"
                                        dangerouslySetInnerHTML={{
                                            __html: sanitizeHtml(clause.original_content_snapshot || ""),
                                        }}
                                    />
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    )}

                    {canEdit ? (
                        <RichTextEditor
                            value={editedContent}
                            onChange={handleContentChange}
                            placeholder="Klauseltext eingeben..."
                            minHeight="200px"
                            autoFocus={isDeviation}
                        />
                    ) : (
                        <div
                            className="p-3 bg-muted rounded text-sm prose prose-sm max-w-none min-h-[200px]"
                            dangerouslySetInnerHTML={{
                                __html: sanitizeHtml(clause.content_html || ""),
                            }}
                        />
                    )}
                </div>

                {/* Metadata */}
                <Separator />

                <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Position</span>
                        <span>#{clause.display_order + 1}</span>
                    </div>
                    {clause.source_clause_id && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Quell-ID</span>
                            <span>{clause.source_clause_id}</span>
                        </div>
                    )}
                    {clause.source_clause_version && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Version</span>
                            <span>v{clause.source_clause_version}</span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <Separator />

                <div className="space-y-2">
                    {/* Deviate Button (nur für Global) */}
                    {isGlobal && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start"
                                        onClick={() => onDeviate(clause.id)}
                                    >
                                        <Unlock className="w-4 h-4 mr-2 text-amber-600" />
                                        Schloss öffnen
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                    <p>Klausel vom Standard abwandeln</p>
                                    <p className="text-xs text-muted-foreground">
                                        Ermöglicht das Bearbeiten dieser Klausel
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}

                    {/* Promote Button (für Local/Deviation) */}
                    {canPromote && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start"
                                        onClick={() => onPromote(clause.id)}
                                    >
                                        <Star className="w-4 h-4 mr-2 text-yellow-600" />
                                        In Bibliothek aufnehmen
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                    <p>Als Standard-Klausel speichern</p>
                                    <p className="text-xs text-muted-foreground">
                                        Macht diese Klausel für alle Dokumente verfügbar
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}

                    {/* View in Library (für Global) */}
                    {isGlobal && clause.source_clause_id && (
                        <Button variant="ghost" className="w-full justify-start text-muted-foreground">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            In Bibliothek anzeigen
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
