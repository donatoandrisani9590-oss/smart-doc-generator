/**
 * RichTextEditor - TipTap-basierter WYSIWYG-Editor
 *
 * Smart UX Phase 2:
 * - Inline-Editing für Local/Deviation Klauseln
 * - Minimale Toolbar für Klausel-typische Formatierung
 * - Auto-Save mit Debounce
 */

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { useEffect, useCallback, useState } from "react";
import {
    Bold,
    Italic,
    Underline,
    List,
    ListOrdered,
    Undo,
    Redo,
    RemoveFormatting,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { SlashCommandMenu, getSlashCommands, type SlashCommandItem } from "./SlashCommandMenu";

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    disabled?: boolean;
    minHeight?: string;
    className?: string;
    autoFocus?: boolean;
}

export const RichTextEditor = ({
    value,
    onChange,
    placeholder = "Text eingeben...",
    disabled = false,
    minHeight = "150px",
    className,
    autoFocus = false,
}: RichTextEditorProps) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false, // Keine Überschriften in Klauseln
                codeBlock: false, // Kein Code
                code: false,
                blockquote: false,
            }),
            Placeholder.configure({
                placeholder,
                emptyEditorClass: "is-editor-empty",
            }),
            Typography, // Typografische Ersetzungen (Anführungszeichen etc.)
        ],
        content: value,
        editable: !disabled,
        autofocus: autoFocus ? "end" : false,
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            // Leerer Editor = leerer String statt <p></p>
            if (html === "<p></p>") {
                onChange("");
            } else {
                onChange(html);
            }
        },
        editorProps: {
            attributes: {
                class: cn(
                    "prose prose-sm max-w-none focus:outline-none",
                    "prose-p:my-2 prose-ul:my-2 prose-ol:my-2",
                    disabled && "cursor-not-allowed opacity-60"
                ),
            },
        },
    });

    // ══════════════════════════════════════════════════════════════════════════
    // SLASH COMMANDS LOGIC (Foundation)
    // ══════════════════════════════════════════════════════════════════════════
    const [slashMenuOpen, setSlashMenuOpen] = useState(false);
    const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 });
    const [slashQuery, setSlashQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);

    const commands = getSlashCommands(editor);
    const filteredCommands = commands.filter(item =>
        item.title.toLowerCase().includes(slashQuery.toLowerCase())
    );

    useEffect(() => {
        if (!editor) return;

        const handleUpdate = () => {
            const { state, view } = editor;
            const selection = state.selection;
            const { $from } = selection;

            // Look for slash command pattern
            const lineTextBefore = $from.parent.textContent.substring(0, $from.parentOffset);
            const match = lineTextBefore.match(/(?:^|\s)\/([a-zA-Z0-9]*)$/);

            if (match) {
                const query = match[1];
                const startPos = $from.pos - query.length - 1; // -1 for slash

                // Get coords
                const coords = view.coordsAtPos(startPos);

                setSlashMenuOpen(true);
                setSlashQuery(query);
                setSlashMenuPosition({ x: coords.left, y: coords.bottom });
                setSelectedIndex(0);
            } else {
                setSlashMenuOpen(false);
                setSlashQuery("");
            }
        };

        editor.on("transaction", handleUpdate);

        return () => {
            editor.off("transaction", handleUpdate);
        };
    }, [editor]);

    // Keyboard Navigation for Menu
    useEffect(() => {
        if (!slashMenuOpen || !editor) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
                return true;
            }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
                return true;
            }
            if (e.key === "Enter") {
                e.preventDefault();
                if (filteredCommands.length > 0) {
                    const item = filteredCommands[selectedIndex];
                    selectCommand(item);
                }
                return true;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                setSlashMenuOpen(false);
                return true;
            }
        };

        // Use a DOM listener on the editor element for high priority
        const editorDom = editor.view.dom;
        editorDom.addEventListener("keydown", handleKeyDown);

        return () => {
            editorDom.removeEventListener("keydown", handleKeyDown);
        };
    }, [slashMenuOpen, selectedIndex, filteredCommands, editor]);

    const selectCommand = (item: SlashCommandItem) => {
        if (!editor) return;

        const { state } = editor;
        const { $from } = state.selection;
        const lineTextBefore = $from.parent.textContent.substring(0, $from.parentOffset);
        const match = lineTextBefore.match(/(?:^|\s)\/([a-zA-Z0-9]*)$/);

        if (match) {
            const query = match[1];
            // Remove the query text + slash
            const range = {
                from: $from.pos - query.length - 1,
                to: $from.pos
            };

            editor.chain().focus().deleteRange(range).run();
            // Run action
            item.action();
        }

        setSlashMenuOpen(false);
    };

    // Sync value from outside
    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value, { emitUpdate: false });
        }
    }, [value, editor]);

    // Cleanup
    useEffect(() => {
        return () => {
            editor?.destroy();
        };
    }, [editor]);

    const ToolbarButton = useCallback(
        ({
            onClick,
            isActive,
            disabled: btnDisabled,
            children,
            title,
        }: {
            onClick: () => void;
            isActive?: boolean;
            disabled?: boolean;
            children: React.ReactNode;
            title: string;
        }) => (
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClick}
                disabled={btnDisabled}
                title={title}
                className={cn(
                    "h-8 w-8 p-0",
                    isActive && "bg-muted text-primary"
                )}
            >
                {children}
            </Button>
        ),
        []
    );

    if (!editor) {
        return (
            <div
                className={cn(
                    "border rounded-lg bg-muted/30 animate-pulse",
                    className
                )}
                style={{ minHeight }}
            />
        );
    }

    return (
        <div
            className={cn(
                "rich-text-editor border rounded-lg overflow-hidden",
                disabled && "opacity-60",
                className
            )}
        >
            {/* Toolbar */}
            {!disabled && (
                <div className="border-b bg-muted/30 p-1 flex items-center gap-0.5 flex-wrap">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        isActive={editor.isActive("bold")}
                        title="Fett (Strg+B)"
                    >
                        <Bold className="w-4 h-4" />
                    </ToolbarButton>

                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        isActive={editor.isActive("italic")}
                        title="Kursiv (Strg+I)"
                    >
                        <Italic className="w-4 h-4" />
                    </ToolbarButton>

                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        isActive={editor.isActive("strike")}
                        title="Durchgestrichen"
                    >
                        <Underline className="w-4 h-4" />
                    </ToolbarButton>

                    <Separator orientation="vertical" className="mx-1 h-6" />

                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        isActive={editor.isActive("bulletList")}
                        title="Aufzählung"
                    >
                        <List className="w-4 h-4" />
                    </ToolbarButton>

                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        isActive={editor.isActive("orderedList")}
                        title="Nummerierte Liste"
                    >
                        <ListOrdered className="w-4 h-4" />
                    </ToolbarButton>

                    <Separator orientation="vertical" className="mx-1 h-6" />

                    <ToolbarButton
                        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                        title="Formatierung entfernen"
                    >
                        <RemoveFormatting className="w-4 h-4" />
                    </ToolbarButton>

                    <div className="flex-1" />

                    <ToolbarButton
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().undo()}
                        title="Rückgängig (Strg+Z)"
                    >
                        <Undo className="w-4 h-4" />
                    </ToolbarButton>

                    <ToolbarButton
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().redo()}
                        title="Wiederholen (Strg+Y)"
                    >
                        <Redo className="w-4 h-4" />
                    </ToolbarButton>
                </div>
            )}

            {/* Editor Content */}
            <EditorContent
                editor={editor}
                className="p-3"
                style={{ minHeight }}
            />

            {/* Slash Command Menu */}
            {slashMenuOpen && filteredCommands.length > 0 && (
                <SlashCommandMenu
                    items={filteredCommands}
                    selectedIndex={selectedIndex}
                    onSelect={(index) => selectCommand(filteredCommands[index])}
                    position={slashMenuPosition}
                />
            )}

            {/* Styles */}
            <style>{`
                .is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left;
                    color: hsl(var(--muted-foreground));
                    pointer-events: none;
                    height: 0;
                }

                .ProseMirror:focus {
                    outline: none;
                }

                .ProseMirror p {
                    margin: 0.5em 0;
                }

                .ProseMirror ul,
                .ProseMirror ol {
                    padding-left: 1.5em;
                }

                .ProseMirror li {
                    margin: 0.25em 0;
                }
            `}</style>
        </div>
    );
};

export default RichTextEditor;
