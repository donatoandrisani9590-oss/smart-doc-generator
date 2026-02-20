import { useState, useCallback, useEffect, useRef } from "react";
import {
  Bold, Italic, Underline, Heading1, Heading2,
  List, ListOrdered, Link, Sparkles,
} from "lucide-react";
import type { Editor as TinyMCEEditor } from "tinymce";

interface BubbleMenuProps {
  editorRef: React.MutableRefObject<TinyMCEEditor | null>;
  onAIClick: () => void;
}

interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  h1: boolean;
  h2: boolean;
  ul: boolean;
  ol: boolean;
}

export function BubbleMenu({ editorRef, onAIClick }: BubbleMenuProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [formatState, setFormatState] = useState<FormatState>({
    bold: false, italic: false, underline: false,
    h1: false, h2: false, ul: false, ol: false,
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const updatePosition = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = editor.selection;
    if (!selection || selection.isCollapsed()) {
      setPosition(null);
      return;
    }

    const selectedText = selection.getContent({ format: "text" });
    if (!selectedText || selectedText.trim().length === 0) {
      setPosition(null);
      return;
    }

    const rng = selection.getRng();
    const rect = rng.getBoundingClientRect();
    const iframe = editor.iframeElement;
    if (!iframe) return;

    const iframeRect = iframe.getBoundingClientRect();

    // Position bubble 8px above selection, centered horizontally
    const top = iframeRect.top + rect.top - 8;
    const left = iframeRect.left + rect.left + rect.width / 2;

    // Clamp to viewport
    const menuWidth = 340; // approximate
    const clampedLeft = Math.max(menuWidth / 2 + 8, Math.min(left, window.innerWidth - menuWidth / 2 - 8));
    const clampedTop = Math.max(48, top);

    setPosition({ top: clampedTop, left: clampedLeft });

    // Update format state
    setFormatState({
      bold: editor.formatter.match("bold"),
      italic: editor.formatter.match("italic"),
      underline: editor.formatter.match("underline"),
      h1: editor.formatter.match("h1"),
      h2: editor.formatter.match("h2"),
      ul: !!editor.dom.getParent(selection.getNode(), "ul"),
      ol: !!editor.dom.getParent(selection.getNode(), "ol"),
    });
  }, [editorRef]);

  // Listen for selection changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleSelectionChange = () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(updatePosition, 200);
    };

    editor.on("selectionchange NodeChange mouseup keyup", handleSelectionChange);
    return () => {
      clearTimeout(debounceRef.current);
      editor.off("selectionchange NodeChange mouseup keyup", handleSelectionChange);
    };
  }, [editorRef, updatePosition]);

  // Hide on escape
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPosition(null);
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, []);

  const execCommand = useCallback((command: string, value?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.execCommand(command, false, value);
    // Re-check format state after command
    setTimeout(updatePosition, 50);
  }, [editorRef, updatePosition]);

  const formatBlock = useCallback((tag: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const node = editor.selection.getNode();
    const currentTag = node.nodeName.toLowerCase();
    // Toggle: if already this heading, revert to paragraph
    editor.execCommand("FormatBlock", false, currentTag === tag ? "p" : tag);
    setTimeout(updatePosition, 50);
  }, [editorRef, updatePosition]);

  if (!position) return null;

  return (
    <div
      ref={menuRef}
      className="bubble-menu"
      style={{
        top: position.top,
        left: position.left,
        transform: "translate(-50%, -100%)",
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent editor blur
    >
      {/* Text formatting */}
      <button className={`bubble-tool ${formatState.bold ? "active" : ""}`}
              onClick={() => execCommand("Bold")} title="Fett (Ctrl+B)">
        <Bold className="h-4 w-4" />
      </button>
      <button className={`bubble-tool ${formatState.italic ? "active" : ""}`}
              onClick={() => execCommand("Italic")} title="Kursiv (Ctrl+I)">
        <Italic className="h-4 w-4" />
      </button>
      <button className={`bubble-tool ${formatState.underline ? "active" : ""}`}
              onClick={() => execCommand("Underline")} title="Unterstrichen (Ctrl+U)">
        <Underline className="h-4 w-4" />
      </button>

      <div className="bubble-separator" />

      {/* Headings */}
      <button className={`bubble-tool ${formatState.h1 ? "active" : ""}`}
              onClick={() => formatBlock("h1")} title="Überschrift 1">
        <Heading1 className="h-4 w-4" />
      </button>
      <button className={`bubble-tool ${formatState.h2 ? "active" : ""}`}
              onClick={() => formatBlock("h2")} title="Überschrift 2">
        <Heading2 className="h-4 w-4" />
      </button>

      <div className="bubble-separator" />

      {/* Lists & Link */}
      <button className={`bubble-tool ${formatState.ul ? "active" : ""}`}
              onClick={() => execCommand("InsertUnorderedList")} title="Aufzählung">
        <List className="h-4 w-4" />
      </button>
      <button className={`bubble-tool ${formatState.ol ? "active" : ""}`}
              onClick={() => execCommand("InsertOrderedList")} title="Nummerierung">
        <ListOrdered className="h-4 w-4" />
      </button>
      <button className="bubble-tool"
              onClick={() => execCommand("mceLink")} title="Link einfügen">
        <Link className="h-4 w-4" />
      </button>

      <div className="bubble-separator" />

      {/* AI Refinement */}
      <button className="bubble-tool" onClick={onAIClick} title="KI-Nachbesserung">
        <Sparkles className="h-4 w-4" />
      </button>
    </div>
  );
}
