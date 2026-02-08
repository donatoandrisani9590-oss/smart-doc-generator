/**
 * ComposerHeader - Top bar for the Document Composer
 *
 * Shows:
 * - Back navigation
 * - Document title
 * - Save status (auto-saving, unsaved, saved)
 * - Focus mode toggle
 * - Save, Preview, Export actions
 */

import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, Download, Eye, Save, Check, Cloud, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutoSaveState } from "./useAutoSave";

interface ComposerHeaderProps {
    draftName: string | null | undefined;
    documentTypeName: string | undefined;
    autoSaveState: AutoSaveState;
    onManualSave: () => void;
    isFocusMode: boolean;
    onToggleFocusMode: () => void;
}

export const ComposerHeader = ({
    draftName,
    documentTypeName,
    autoSaveState,
    onManualSave,
    isFocusMode,
    onToggleFocusMode,
}: ComposerHeaderProps) => {
    const navigate = useNavigate();
    const { isAutoSaving, hasUnsavedChanges, lastSavedAt } = autoSaveState;

    return (
        <div className="h-14 border-b bg-white flex items-center justify-between px-4">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => navigate("/composer")}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Zurück
                </Button>
                <div className="h-6 w-px bg-border" />
                <div>
                    <h1 className="font-semibold">{draftName || documentTypeName || "Dokument"}</h1>
                    {/* UX-Refactoring: Speicherstatus statt technische ID */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {isAutoSaving ? (
                            <span className="flex items-center gap-1 text-amber-600">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Wird gespeichert...
                            </span>
                        ) : hasUnsavedChanges ? (
                            <span className="flex items-center gap-1 text-amber-600">
                                <Cloud className="w-3 h-3" />
                                Nicht gespeichert
                            </span>
                        ) : lastSavedAt ? (
                            <span className="flex items-center gap-1 text-green-600">
                                <Check className="w-3 h-3" />
                                Gespeichert
                            </span>
                        ) : (
                            <span>Neuer Entwurf</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Focus Mode Toggle */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleFocusMode}
                    title={isFocusMode ? "Focus Modus beenden" : "Focus Modus aktivieren"}
                >
                    {isFocusMode ? (
                        <Minimize2 className="w-4 h-4 mr-2" />
                    ) : (
                        <Maximize2 className="w-4 h-4 mr-2" />
                    )}
                    {isFocusMode ? "Exit Focus" : "Focus"}
                </Button>

                {/* UX-Refactoring: Expliziter "Speichern" Button */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onManualSave}
                    disabled={isAutoSaving || !hasUnsavedChanges}
                    className={hasUnsavedChanges ? "border-amber-300 text-amber-700 hover:bg-amber-50" : ""}
                >
                    {isAutoSaving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4 mr-2" />
                    )}
                    Speichern
                </Button>
                <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-2" />
                    Vorschau
                </Button>
                <Button size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Exportieren
                </Button>
            </div>
        </div>
    );
};
