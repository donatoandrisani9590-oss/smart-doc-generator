/**
 * DocumentEditor - Tiptap-based WYSIWYG Editor for Document Preview
 *
 * Headless Tiptap editor with:
 * - Two-way binding (value prop + onChange callback)
 * - A4 document styling via prose classes
 * - Dark mode support
 * - Programmatic vs user edit tracking
 * - Character count footer
 */

import { useRef, useCallback, useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import { useDebouncedCallback } from "use-debounce";
import { Loader2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import type { Editor } from "@tiptap/react";

interface DocumentEditorProps {
  /** HTML content to display/edit */
  value: string;

  /** Callback when content changes (debounced internally) */
  onChange: (html: string) => void;

  /** Whether the editor is in read-only mode */
  readOnly?: boolean;

  /** Loading state (shows spinner while true) */
  isLoading?: boolean;

  /** Additional CSS class for the container */
  className?: string;

  /** Compact mode for split-screen usage */
  compact?: boolean;

  /** Callback specifically for user-initiated edits (keyboard input, formatting) */
  onUserEdit?: (html: string) => void;

  /** Callback to expose the Tiptap Editor instance */
  onEditorInit?: (editor: Editor) => void;
}

// Build the extensions array once (static, no need to recreate per render)
const extensions = [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3],
    },
  }),
  Underline,
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableCell,
  TableHeader,
  Link.configure({
    openOnClick: false,
  }),
  Highlight.configure({
    multicolor: true,
  }),
  Color,
  TextStyle,
  Typography,
  CharacterCount,
  Placeholder.configure({
    placeholder: "Dokumenttext eingeben\u2026",
  }),
];

export const DocumentEditor = ({
  value,
  onChange,
  readOnly = false,
  isLoading = false,
  className,
  onUserEdit,
  onEditorInit,
}: DocumentEditorProps) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const lastValueRef = useRef(value);
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Track if editor has been initialized and is ready to accept user input.
  // Prevents firing onUserEdit during initial content setup.
  const isInitializedRef = useRef(false);

  // Track if we are currently updating content programmatically (not a user edit)
  const isProgrammaticUpdateRef = useRef(false);

  // Debounce onChange to avoid excessive re-renders (300ms)
  const debouncedOnChange = useDebouncedCallback(
    (content: string, isUserEdit: boolean) => {
      onChange(content);
      if (isUserEdit && onUserEdit && isInitializedRef.current) {
        onUserEdit(content);
      }
    },
    300
  );

  // onUpdate handler for Tiptap
  const handleUpdate = useCallback(
    ({ editor }: { editor: Editor }) => {
      const html = editor.getHTML();
      lastValueRef.current = html;
      const isUserEdit = !isProgrammaticUpdateRef.current;
      debouncedOnChange(html, isUserEdit);
    },
    [debouncedOnChange]
  );

  const editor = useEditor({
    extensions,
    content: value,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: [
          "prose prose-sm max-w-[595px] mx-auto p-10 min-h-[842px]",
          "font-sans text-[10pt] leading-relaxed text-gray-900",
          "focus:outline-none",
          // Missing variable highlighting
          "[&_.missing-variable]:bg-red-50",
          "[&_.missing-variable]:text-red-600",
          "[&_.missing-variable]:border",
          "[&_.missing-variable]:border-dashed",
          "[&_.missing-variable]:border-red-500",
          "[&_.missing-variable]:rounded",
          "[&_.missing-variable]:px-1",
          "[&_.missing-variable]:text-[9pt]",
          "[&_.missing-variable]:italic",
          // Dark mode prose overrides
          isDark ? "dark:prose-invert dark:text-warm-100" : "",
        ]
          .filter(Boolean)
          .join(" "),
        "aria-label": "Dokumenteneditor",
      },
    },
    onUpdate: handleUpdate,
    onCreate: ({ editor: editorInstance }) => {
      setIsEditorReady(true);
      if (onEditorInit) {
        onEditorInit(editorInstance);
      }
    },
    // Vite/React: render immediately (not SSR)
    immediatelyRender: true,
  });

  // Update editable state when readOnly prop changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  // Update editor content when value prop changes externally
  useEffect(() => {
    if (editor && isEditorReady) {
      if (value !== lastValueRef.current) {
        isProgrammaticUpdateRef.current = true;
        lastValueRef.current = value;
        editor.commands.setContent(value || "", { emitUpdate: false });
        // Reset programmatic flag after Tiptap processes the update
        setTimeout(() => {
          isProgrammaticUpdateRef.current = false;
        }, 500);
      }
    }
  }, [value, editor, isEditorReady]);

  // Mark editor as fully initialized after initial content is set.
  // Adds a delay so that Tiptap finishes all initial processing.
  useEffect(() => {
    if (isEditorReady && !isInitializedRef.current) {
      const timer = setTimeout(() => {
        isInitializedRef.current = true;
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isEditorReady]);

  // Character count from the extension
  const characterCount = editor?.storage.characterCount?.characters() ?? 0;
  const wordCount = editor?.storage.characterCount?.words() ?? 0;

  // Loading state: show spinner
  if (isLoading && !editor?.getText()) {
    return (
      <div
        className={`flex items-center justify-center min-h-[400px] ${className || ""}`}
      >
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className={[
        "document-editor-container rounded-2xl overflow-hidden",
        "bg-[var(--glass-1-bg)] backdrop-blur-[var(--glass-1-blur)]",
        "border border-[var(--glass-1-border)]",
        "shadow-[var(--glass-1-shadow)]",
        className || "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Editor content area */}
      <div className="bg-white dark:bg-warm-900 rounded-b-2xl">
        <EditorContent editor={editor} />
      </div>

      {/* Character count footer */}
      {editor && (
        <div className="flex items-center justify-end gap-3 px-4 py-1.5 text-[11px] text-muted-foreground border-t border-[var(--glass-1-border)] bg-[var(--glass-1-bg)]">
          <span>{wordCount} Wörter</span>
          <span>{characterCount} Zeichen</span>
        </div>
      )}
    </div>
  );
};

export default DocumentEditor;
