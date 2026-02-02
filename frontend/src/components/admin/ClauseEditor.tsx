/**
 * ClauseEditor - TipTap WYSIWYG Editor im "Strict Mode"
 *
 * Implementiert die v4.2 Spezifikation:
 * - NUR erlaubte Formatierungen: H1, H2, Bold, Italic, Bullet/Ordered Lists
 * - Blockquotes, Code-Blöcke, Horizontale Linien etc. DEAKTIVIERT
 * - Platzhalter-Picker mit Kategorien
 * - Platzhalter-Validierung (Levenshtein Typo-Erkennung)
 * - Browser-native Rechtschreibprüfung (de-DE)
 * - Save mit Validierungs-Dialog
 */

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { PlaceholderHighlight } from '@/components/editor/PlaceholderHighlight'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Save, Loader2, Info, Hash, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlaceholderDropdown } from '@/components/editor/PlaceholderDropdown'
import { PlaceholderValidationWarning } from '@/components/editor/PlaceholderValidationWarning'
import { useValidatePlaceholders, usePlaceholders } from '@/hooks/useApi'
import { useState, useCallback, useEffect } from 'react'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"

const ToolbarButton = ({ onClick, isActive, children, title, description, disabled }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title?: string;
    description?: string;
    disabled?: boolean;
}) => {
    const button = (
        <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.preventDefault(); onClick(); }}
            className={cn(
                "h-8 w-8 p-0 transition-colors",
                isActive && "bg-primary/10 text-primary",
                disabled && "opacity-50 cursor-not-allowed"
            )}
            disabled={disabled}
        >
            {children}
        </Button>
    );

    if (title) {
        return (
            <TooltipProvider delayDuration={200}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        {button}
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                        <p className="font-medium">{title}</p>
                        {description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                        )}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return button;
}

interface ClauseEditorProps {
    content?: string;
    onChange?: (html: string) => void;
    onSave?: (html: string) => Promise<void>;
    showSaveButton?: boolean;
    strictMode?: boolean;  // Default: true - Nur erlaubte Formatierungen
    countryCode?: string;  // 'DE' oder 'IT' für Spracheinstellung
    showParagraphHint?: boolean; // Zeigt Hinweis zur automatischen §-Nummerierung
}

export const ClauseEditor = ({
    content = "",
    onChange,
    onSave,
    showSaveButton = false,
    strictMode = true,
    countryCode = "DE",
    showParagraphHint = true
}: ClauseEditorProps) => {
    const [isSaving, setIsSaving] = useState(false)
    const [showValidationWarning, setShowValidationWarning] = useState(false)
    const [pendingContent, setPendingContent] = useState<string | null>(null)
    const [validationResult, setValidationResult] = useState<{
        unknown_placeholders: {
            name: string;
            suggestions: string[];
            suggestion_labels: string[];
        }[];
    } | null>(null)

    const validateMutation = useValidatePlaceholders()
    const { data: placeholders } = usePlaceholders()

    // Spracheinstellung für Rechtschreibprüfung
    const editorLang = countryCode === "IT" ? "it-IT" : "de-DE"
    const placeholderText = countryCode === "IT"
        ? "Inserisci il testo della clausola..."
        : "Klauseltext hier eingeben..."

    // Bekannte Platzhalter-Namen für Validierung extrahieren
    const knownPlaceholderNames = placeholders?.map(p => p.name) || []

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                // ══════════════════════════════════════════════════════════
                // STRICT MODE KONFIGURATION (v4.2)
                //
                // NUR diese Formatierungen sind erlaubt:
                // ✅ Überschrift 1 (H1)
                // ✅ Überschrift 2 (H2)
                // ✅ Fett (Bold)
                // ✅ Kursiv (Italic)
                // ✅ Aufzählung (Bullet List)
                // ✅ Nummerierte Liste (Ordered List)
                //
                // ❌ DEAKTIVIERT:
                // - Blockquotes
                // - Code-Blöcke
                // - Horizontale Linien
                // - Inline Code
                // - Strike-through
                // - Hard Breaks (Shift+Enter)
                // ══════════════════════════════════════════════════════════
                heading: strictMode ? { levels: [1, 2] } : { levels: [1, 2, 3] },
                blockquote: strictMode ? false : undefined,
                codeBlock: false,  // Immer deaktiviert - nicht relevant für Verträge
                code: false,       // Inline Code deaktiviert
                horizontalRule: false,
                strike: strictMode ? false : undefined,
                hardBreak: strictMode ? false : undefined,
            }),
            Placeholder.configure({
                placeholder: placeholderText,
            }),
            // Visuelle Platzhalter-Hervorhebung (UX-Verbesserung)
            PlaceholderHighlight.configure({
                className: 'placeholder-chip',
                knownPlaceholders: knownPlaceholderNames,
            }),
        ],
        content,
        onUpdate: ({ editor }) => {
            onChange?.(editor.getHTML())
        },
        editorProps: {
            attributes: {
                class: 'tiptap-strict prose prose-sm focus:outline-none min-h-[300px] p-4',
                // Enable browser-native spellcheck
                spellcheck: 'true',
                lang: editorLang,
            },
            // Verhindere Einfügen von nicht-erlaubten Formaten
            handlePaste: strictMode ? () => {
                // Erlaube Einfügen, aber entferne nicht-erlaubte Formate
                return false // Default-Handling, TipTap filtert automatisch
            } : undefined,
        },
    })

    // Update editor content when prop changes
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content)
        }
    }, [content, editor])

    const handleInsertPlaceholder = useCallback((placeholder: string) => {
        if (editor) {
            editor.chain().focus().insertContent(placeholder).run()
        }
    }, [editor])

    const handleSave = useCallback(async () => {
        if (!editor || !onSave) return

        const html = editor.getHTML()
        setIsSaving(true)

        try {
            // Validate placeholders first
            const result = await validateMutation.mutateAsync(html)

            if (!result.is_valid && result.unknown_placeholders.length > 0) {
                // Show warning dialog
                setValidationResult(result)
                setPendingContent(html)
                setShowValidationWarning(true)
                setIsSaving(false)
                return
            }

            // All placeholders valid, save directly
            await onSave(html)
        } catch (error) {
            console.error('Save failed:', error)
        } finally {
            setIsSaving(false)
        }
    }, [editor, onSave, validateMutation])

    const handleAcceptSuggestion = useCallback((oldName: string, newName: string) => {
        if (editor && pendingContent) {
            // Replace the old placeholder with the new one
            const regex = new RegExp(`\\{\\{\\s*${oldName}\\s*\\}\\}`, 'g')
            const newContent = pendingContent.replace(regex, `{{ ${newName} }}`)
            editor.commands.setContent(newContent)
            setPendingContent(newContent)

            // Remove this placeholder from the validation result
            if (validationResult) {
                const remaining = validationResult.unknown_placeholders.filter(
                    p => p.name !== oldName
                )
                if (remaining.length === 0) {
                    // All fixed, close dialog and save
                    setShowValidationWarning(false)
                    setValidationResult(null)
                    onSave?.(newContent)
                } else {
                    setValidationResult({ unknown_placeholders: remaining })
                }
            }
        }
    }, [editor, pendingContent, validationResult, onSave])

    const handleIgnoreAll = useCallback(async () => {
        if (pendingContent && onSave) {
            setShowValidationWarning(false)
            setValidationResult(null)
            setIsSaving(true)
            try {
                await onSave(pendingContent)
            } finally {
                setIsSaving(false)
                setPendingContent(null)
            }
        }
    }, [pendingContent, onSave])

    const handleCancelValidation = useCallback(() => {
        setShowValidationWarning(false)
        setValidationResult(null)
        setPendingContent(null)
    }, [])

    // Handler für Paragraph-Nummer einfügen - MUSS vor early return stehen (React Hooks Regeln)
    const handleInsertParagraphNumber = useCallback(() => {
        if (editor) {
            editor.chain().focus().insertContent('§ {{ paragraph_number }}').run()
        }
    }, [editor])

    if (!editor) return null

    // Transform placeholders for the dropdown
    const dropdownPlaceholders = placeholders?.map(p => ({
        name: p.name,
        label: p.label,
        type: p.type,
        category: p.category
    }))

    // Prüfen ob content bereits paragraph_number enthält
    const hasParagraphNumber = content.includes('paragraph_number')

    return (
        <>
            <Card className="overflow-hidden border-input">
                {/* Strict Mode Indicator */}
                {strictMode && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border-b border-primary/10 text-xs text-primary">
                        <Info className="w-3.5 h-3.5" />
                        <span>
                            <strong>Strict Mode:</strong> Nur Überschriften, Fett, Kursiv und Listen erlaubt
                        </span>
                    </div>
                )}
                <div className="flex items-center gap-1 p-2 border-b bg-muted/30 flex-wrap">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        isActive={editor.isActive('heading', { level: 1 })}
                        title="Überschrift 1"
                        description="Hauptüberschrift für Abschnitte wie §-Titel"
                    >
                        <Heading1 className="w-4 h-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        isActive={editor.isActive('heading', { level: 2 })}
                        title="Überschrift 2"
                        description="Unterüberschrift für Unterabschnitte"
                    >
                        <Heading2 className="w-4 h-4" />
                    </ToolbarButton>
                    <div className="w-px h-6 bg-border mx-1" />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        isActive={editor.isActive('bold')}
                        title="Fett"
                        description="Text hervorheben (Strg+B)"
                    >
                        <Bold className="w-4 h-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        isActive={editor.isActive('italic')}
                        title="Kursiv"
                        description="Text betonen (Strg+I)"
                    >
                        <Italic className="w-4 h-4" />
                    </ToolbarButton>
                    <div className="w-px h-6 bg-border mx-1" />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        isActive={editor.isActive('bulletList')}
                        title="Aufzählung"
                        description="Liste mit Aufzählungspunkten"
                    >
                        <List className="w-4 h-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        isActive={editor.isActive('orderedList')}
                        title="Nummerierte Liste"
                        description="Liste mit 1. 2. 3. Nummerierung"
                    >
                        <ListOrdered className="w-4 h-4" />
                    </ToolbarButton>
                    <div className="w-px h-6 bg-border mx-1" />

                    {/* Placeholder Picker */}
                    <PlaceholderDropdown
                        onInsert={handleInsertPlaceholder}
                        placeholders={dropdownPlaceholders}
                    />

                    {/* Paragraph Number Button */}
                    {showParagraphHint && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={hasParagraphNumber ? "secondary" : "outline"}
                                        size="sm"
                                        onClick={handleInsertParagraphNumber}
                                        className="gap-1.5 text-xs"
                                    >
                                        <Hash className="w-3.5 h-3.5" />
                                        § Nummer
                                        {hasParagraphNumber && (
                                            <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px] bg-green-100 text-green-700">
                                                ✓
                                            </Badge>
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <div className="space-y-2">
                                        <p className="font-medium">Automatische Paragraphen-Nummerierung</p>
                                        <p className="text-xs text-muted-foreground">
                                            Fügt <code className="bg-muted px-1 rounded">{'{{ paragraph_number }}'}</code> ein.
                                            Die Nummer wird automatisch basierend auf der Position im Dokument vergeben.
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            <strong>Beispiel:</strong> "§ 1 Vertragsparteien", "§ 2 Arbeitszeit"
                                        </p>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}

                    {/* Save Button */}
                    {showSaveButton && onSave && (
                        <>
                            <div className="flex-1" />
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleSave}
                                disabled={isSaving}
                                className="gap-2"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Speichern
                            </Button>
                        </>
                    )}
                </div>
                <EditorContent editor={editor} />

                {/* Paragraph Number Info Banner */}
                {showParagraphHint && (
                    <div className="flex items-start gap-2 px-3 py-2 bg-gradient-to-r from-amber-50 to-transparent border-t border-amber-100 text-xs text-amber-800">
                        <HelpCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
                        <div>
                            <strong>Tipp zur Paragraphen-Nummerierung:</strong>{' '}
                            Verwenden Sie <code className="bg-amber-100 px-1 rounded">{'{{ paragraph_number }}'}</code> in
                            der Überschrift, z.B. "§ {'{{ paragraph_number }}'} Vertragsgegenstand".
                            Die Nummern werden automatisch beim Zusammenstellen des Dokuments vergeben.
                        </div>
                    </div>
                )}
            </Card>

            {/* Validation Warning Dialog */}
            <PlaceholderValidationWarning
                open={showValidationWarning}
                onOpenChange={setShowValidationWarning}
                unknownPlaceholders={validationResult?.unknown_placeholders || []}
                onAcceptSuggestion={handleAcceptSuggestion}
                onIgnoreAll={handleIgnoreAll}
                onCancel={handleCancelValidation}
            />
        </>
    )
}
