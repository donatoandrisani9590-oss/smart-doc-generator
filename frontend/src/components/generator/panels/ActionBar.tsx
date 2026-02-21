/**
 * ActionBar - Status bar for the Split-Screen Editor
 *
 * Fixiert am unteren Rand des linken Panels:
 * - Sidebar Toggles (KI-Chat, Kommentare)
 * - Auto-Save Status Anzeige
 * - ValidationProgress Ampel (zeigt Formular-Status)
 * - Entwurf speichern Button (erlaubt partielle Daten)
 *
 * Export functionality has moved to EditorActionPanel (floating on canvas).
 */

import { useState, useMemo, useCallback } from "react";
import { Save, Loader2, CheckCircle2, Cloud, CloudOff, Sparkles, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWizardContext } from "../WizardContext";
import { ValidationProgress, type ValidationState, type ValidationIssue } from "../ValidationProgress";

// Pflichtfelder Definition
const REQUIRED_FIELDS = [
    { name: "vorname", label: "Vorname", group: "Mitarbeiterdaten" },
    { name: "nachname", label: "Nachname", group: "Mitarbeiterdaten" },
    { name: "position", label: "Position", group: "Vertragsdaten" },
    { name: "gehalt", label: "Gehalt", group: "Vertragsdaten" },
    { name: "eintrittsdatum", label: "Eintrittsdatum", group: "Vertragsdaten" },
    { name: "signatory_name", label: "Unterzeichner", group: "Unterzeichner" },
] as const;

export const ActionBar = () => {
    const { state, actions } = useWizardContext();
    const { documentTypeId, documentTitle, formData, isGenerating, autoSaveStatus, lastSavedText, showCommentSidebar, showChatSidebar } = state;

    const [isSavingDraft, setIsSavingDraft] = useState(false);

    // Berechne Validierungs-State für die Ampel
    const validationState: ValidationState = useMemo(() => {
        const missingFields: ValidationIssue[] = [];
        let completedFields = 0;

        REQUIRED_FIELDS.forEach((field) => {
            const value = formData[field.name as keyof typeof formData];
            const isEmpty = value === undefined || value === null || value === "";

            if (isEmpty) {
                missingFields.push({
                    type: "missing",
                    field: field.name,
                    fieldId: field.name,
                    label: field.label,
                    message: "Pflichtfeld nicht ausgefüllt",
                    group: field.group,
                });
            } else {
                completedFields++;
            }
        });

        // Zusätzliche Validierung: Dokumenttitel
        if (!documentTitle.trim()) {
            missingFields.push({
                type: "missing",
                field: "documentTitle",
                fieldId: "documentTitle",
                label: "Dokumenttitel",
                message: "Bitte gib einen Titel ein",
                group: "Dokument",
            });
        } else {
            completedFields++;
        }

        return {
            isValid: missingFields.length === 0,
            errors: [],
            warnings: [],
            missingFields,
            completedFields,
            totalRequiredFields: REQUIRED_FIELDS.length + 1, // +1 für Dokumenttitel
        };
    }, [formData, documentTitle]);

    // Scroll zu Feld Handler
    const handleScrollToField = useCallback((fieldId: string) => {
        const element = document.getElementById(fieldId);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.focus();
        }
    }, []);

    // Drafts only need a document type - partial data is explicitly allowed
    const canSaveDraft = !!documentTypeId;

    // Entwurf speichern (erlaubt partielle Daten)
    const handleSaveDraft = async () => {
        if (!canSaveDraft) return;
        setIsSavingDraft(true);
        try {
            await actions.saveDraft();
        } finally {
            setIsSavingDraft(false);
        }
    };

    const isAnyLoading = isSavingDraft || isGenerating;

    // Auto-Save Status Anzeige
    const autoSaveIndicator = useMemo(() => {
        switch (autoSaveStatus) {
            case 'saving':
                return { icon: <Cloud className="w-3 h-3 animate-pulse" />, text: "Speichert...", color: "text-[var(--nw-blue-500)]" };
            case 'saved':
                return { icon: <CheckCircle2 className="w-3 h-3" />, text: lastSavedText || "Gespeichert", color: "text-[var(--nw-green-600)]" };
            case 'error':
                return { icon: <CloudOff className="w-3 h-3" />, text: "Speichern fehlgeschlagen", color: "text-destructive" };
            case 'offline':
                return { icon: <CloudOff className="w-3 h-3" />, text: "Offline gespeichert", color: "text-[var(--color-draft)]" };
            case 'pending':
                return { icon: <Cloud className="w-3 h-3" />, text: "Änderungen...", color: "text-[var(--text-tertiary)]" };
            default:
                return null;
        }
    }, [autoSaveStatus, lastSavedText]);

    return (
        <div className="p-3 shadow-[var(--shadow-up-subtle)] bg-[var(--bg-surface)] border-t border-[var(--border-light)] space-y-2.5">
            {/* Sidebar Toggles — KI-Chat & Kommentare */}
            <div className="flex items-center justify-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 gap-1.5 text-xs ${showChatSidebar ? "text-[var(--nw-blue)] bg-[var(--nw-blue-50)]" : "text-[var(--text-muted)]"}`}
                    onClick={() => actions.toggleChatSidebar()}
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    KI-Chat
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 gap-1.5 text-xs ${showCommentSidebar ? "text-[var(--nw-blue)] bg-[var(--nw-blue-50)]" : "text-[var(--text-muted)]"}`}
                    onClick={() => actions.toggleCommentSidebar()}
                >
                    <MessagesSquare className="w-3.5 h-3.5" />
                    Kommentare
                </Button>
            </div>

            {/* Auto-Save Status */}
            {autoSaveIndicator && (
                <div className={`flex items-center justify-center gap-1.5 text-[11px] ${autoSaveIndicator.color}`}>
                    {autoSaveIndicator.icon}
                    <span>{autoSaveIndicator.text}</span>
                </div>
            )}

            {/* ValidationProgress — the single source of truth for status */}
            <ValidationProgress
                validation={validationState}
                onScrollToField={handleScrollToField}
                className="w-full"
            />

            {/* Speichern */}
            <Button
                variant="ghost"
                className="w-full gap-2"
                onClick={handleSaveDraft}
                disabled={!canSaveDraft || isAnyLoading}
            >
                {isSavingDraft ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Save className="w-4 h-4" />
                )}
                Entwurf speichern
            </Button>
        </div>
    );
};

export default ActionBar;
