/**
 * DocumentEditor - TinyMCE-based WYSIWYG Editor for Document Preview
 *
 * Self-hosted TinyMCE Community Edition with:
 * - Two-way binding (value prop + onChange callback)
 * - Minimalist toolbar (Bold, Italic, Lists, Tables, Images)
 * - A4 document styling
 * - No menubar, single scrollbar
 */

import { useRef, useCallback, useEffect, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";
import { useDebouncedCallback } from "use-debounce";
import { Loader2 } from "lucide-react";
import type { Editor as TinyMCEEditor } from "tinymce";
import { useTheme } from "@/contexts/ThemeContext";

// Import TinyMCE core (required for self-hosted)
import "tinymce/tinymce";
// Import plugins
import "tinymce/plugins/lists";
import "tinymce/plugins/table";
import "tinymce/plugins/image";
import "tinymce/plugins/link";
import "tinymce/plugins/autoresize";
import "tinymce/plugins/searchreplace";
import "tinymce/plugins/fullscreen";
import "tinymce/plugins/code";
import "tinymce/plugins/charmap";
import "tinymce/plugins/pagebreak";
import "tinymce/plugins/anchor";
import "tinymce/plugins/insertdatetime";
import "tinymce/plugins/wordcount";
// Import theme, icons, and model
import "tinymce/themes/silver";
import "tinymce/icons/default";
import "tinymce/models/dom";

interface DocumentEditorProps {
  /** HTML content to display/edit */
  value: string;

  /** Callback when content changes (debounced internally) */
  onChange: (html: string) => void;

  /** Whether the editor is in read-only mode */
  readOnly?: boolean;

  /** Loading state (shows skeleton while true) */
  isLoading?: boolean;

  /** Additional CSS class for the container */
  className?: string;

  /** Compact toolbar mode for split-screen usage */
  compact?: boolean;

  /** Callback specifically for user-initiated edits (keyboard input, formatting) */
  onUserEdit?: (html: string) => void;

  /** Callback to expose the TinyMCE editor instance */
  onEditorInit?: (editor: TinyMCEEditor) => void;
}

// Compact single-line toolbar for split-screen mode
const COMPACT_TOOLBAR = "undo redo | fontfamily fontsize | bold italic underline | bullist numlist | link table | removeformat";

// Full two-line toolbar for standalone mode
const FULL_TOOLBAR = [
  "undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor",
  "alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image table | charmap pagebreak | searchreplace fullscreen code | removeformat",
];

export const DocumentEditor = ({
  value,
  onChange,
  readOnly = false,
  isLoading = false,
  className,
  compact = false,
  onUserEdit,
  onEditorInit,
}: DocumentEditorProps) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const editorRef = useRef<TinyMCEEditor | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const lastValueRef = useRef(value);

  // Track if editor has been initialized and is ready to accept user input
  // This prevents firing onUserEdit during initial content setup
  const isInitializedRef = useRef(false);

  // Track if we're currently updating content programmatically (not user edit)
  const isProgrammaticUpdateRef = useRef(false);

  // Debounce onChange to avoid excessive re-renders (300ms)
  const debouncedOnChange = useDebouncedCallback((content: string, isUserEdit: boolean) => {
    onChange(content);
    // Only call onUserEdit if:
    // 1. This was not a programmatic update
    // 2. Editor is fully initialized
    // 3. onUserEdit callback exists
    if (isUserEdit && onUserEdit && isInitializedRef.current) {
      onUserEdit(content);
    }
  }, 300);

  // Handle editor content changes
  const handleEditorChange = useCallback(
    (content: string) => {
      lastValueRef.current = content;
      // Pass whether this is a user edit (not programmatic)
      const isUserEdit = !isProgrammaticUpdateRef.current;
      debouncedOnChange(content, isUserEdit);
    },
    [debouncedOnChange]
  );

  // Update editor content when value prop changes externally
  useEffect(() => {
    if (editorRef.current && isEditorReady) {
      // Only update if value changed externally (not from our own onChange)
      if (value !== lastValueRef.current) {
        // Mark as programmatic update to prevent triggering onUserEdit
        isProgrammaticUpdateRef.current = true;
        lastValueRef.current = value;
        editorRef.current.setContent(value || "");
        // Reset flag after a longer delay to allow TinyMCE to fully process the content change
        // TinyMCE can take time to normalize HTML and fire multiple events
        // Using 1000ms to ensure all TinyMCE internal events have finished
        setTimeout(() => {
          isProgrammaticUpdateRef.current = false;
        }, 1000);
      }
    }
  }, [value, isEditorReady]);

  // Mark editor as fully initialized after initial content is set
  // This adds a delay to ensure TinyMCE has finished all initialization
  useEffect(() => {
    if (isEditorReady && !isInitializedRef.current) {
      // Wait 1 second after editor is ready to mark as initialized
      // This gives TinyMCE time to normalize content and fire initial events
      const timer = setTimeout(() => {
        isInitializedRef.current = true;
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isEditorReady]);

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className={`document-editor-loading ${className || ""}`}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className={`document-editor-container ${className || ""}`}
    >
      <Editor
        key={`editor-${resolvedTheme}`}
        onInit={(_evt, editor) => {
          editorRef.current = editor;
          setIsEditorReady(true);
          if (onEditorInit) onEditorInit(editor);
        }}
        initialValue={value}
        onEditorChange={handleEditorChange}
        disabled={readOnly}
        tinymceScriptSrc="/tinymce/tinymce.min.js"
        licenseKey="gpl"
        init={{

          // === Core Settings ===
          height: "auto",
          min_height: 800,
          width: "100%",

          // === UI Configuration (Minimalist) ===
          menubar: false,
          statusbar: true, // Show word count
          branding: false,
          promotion: false,
          resize: false,

          // === Plugins ===
          plugins: [
            "lists",
            "table",
            "image",
            "link",
            "autoresize",
            "searchreplace",
            "fullscreen",
            "code",
            "charmap",
            "pagebreak",
            "anchor",
            "insertdatetime",
            "wordcount",
          ],

          // === Toolbar Configuration ===
          toolbar: compact ? COMPACT_TOOLBAR : FULL_TOOLBAR,
          toolbar_mode: compact ? "scrolling" : "wrap",

          // === Font Configuration (like Word) ===
          font_family_formats:
            "Arial=Arial, Helvetica, sans-serif;" +
            "Calibri=Calibri, sans-serif;" +
            "Times New Roman=Times New Roman, Times, serif;" +
            "Georgia=Georgia, serif;" +
            "Verdana=Verdana, Geneva, sans-serif;" +
            "Helvetica=Helvetica, Arial, sans-serif;" +
            "Courier New=Courier New, Courier, monospace;" +
            "Trebuchet MS=Trebuchet MS, sans-serif;" +
            "Garamond=Garamond, serif;",
          font_size_formats: "8pt 9pt 10pt 11pt 12pt 14pt 16pt 18pt 20pt 24pt 28pt 36pt",

          // === Table Plugin Configuration ===
          table_toolbar:
            "tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol",
          table_default_styles: {
            width: "100%",
            borderCollapse: "collapse",
          },

          // === Image Plugin Configuration ===
          images_reuse_filename: true,
          // Default: convert to base64 data URL
          images_upload_handler: (blobInfo) => {
            return Promise.resolve(
              `data:${blobInfo.blob().type};base64,${blobInfo.base64()}`
            );
          },

          // === Content Styling (A4 Document) ===
          content_css: "/tinymce-document.css",
          content_style: isDark
            ? "body { background: #1a1d2e !important; color: #dde1e8 !important; } .document-title { color: #7b8bcc !important; } table td, table th { border-color: #2a2f42 !important; } table th { background: #1e2236 !important; } .custom-clause { background: #1e2236 !important; border-left-color: #5566aa !important; } .party-role { color: #8890a4 !important; }"
            : undefined,
          body_class: "mce-content-body",

          // === Self-Hosted Asset Paths (dark skin when dark mode) ===
          skin_url: isDark
            ? "/tinymce/skins/ui/oxide-dark"
            : "/tinymce/skins/ui/oxide",
          content_css_cors: true,

          // === Editor Behavior ===
          paste_data_images: true,
          paste_as_text: false,
          browser_spellcheck: true,

          // === Prevent Double Scrollbars ===
          autoresize_bottom_margin: 20,
          autoresize_overflow_padding: 20,

          // === Setup Callback ===
          setup: (editor) => {
            editor.on("init", () => {
              // Apply A4 paper styling to editor body
              const body = editor.getBody();
              body.style.fontFamily = "'Arial', 'Inter', sans-serif";
              body.style.fontSize = "11pt";
              body.style.lineHeight = "1.15";
              body.style.color = isDark ? "#dde1e8" : "#1D1D1F";
              body.style.margin = "0";
              body.style.background = isDark ? "#1a1d2e" : "#ffffff";
              body.style.boxSizing = "border-box";
              body.style.width = "100%";
              body.style.maxWidth = "100%";
              body.style.overflowX = "hidden";

              // Responsive padding: Use smaller margins when container is narrow
              const containerWidth = editor.getContainer()?.offsetWidth || 800;
              if (containerWidth < 750) {
                body.style.padding = "15mm 12mm 15mm 15mm";
              } else {
                body.style.padding = "25mm 20mm 20mm 25mm";
              }
            });
          },
        }}
      />
    </div>
  );
};

export default DocumentEditor;
