/**
 * BubbleMenu — Floating toolbar that appears on text selection in Tiptap editor.
 * Uses native DOM selection API for positioning (no Tiptap BubbleMenu extension needed).
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Underline, Heading1, Heading2,
  List, ListOrdered, Link, Sparkles,
} from "lucide-react";

interface BubbleMenuProps {
  editor: Editor | null;
  onAIClick: () => void;
}

export function BubbleMenu({ editor, onAIClick }: BubbleMenuProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const updatePosition = useCallback(() => {
    if (!editor) { setPosition(null); return; }

    const { from, to } = editor.state.selection;
    if (from === to) { setPosition(null); return; }

    // Get the DOM coordinates of the selection
    const view = editor.view;
    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to);

    // Position above the selection, centered
    const top = start.top - 8;
    const left = (start.left + end.right) / 2;

    // Clamp to viewport
    const menuWidth = 360;
    const clampedLeft = Math.max(menuWidth / 2 + 8, Math.min(left, window.innerWidth - menuWidth / 2 - 8));
    const clampedTop = Math.max(48, top);

    setPosition({ top: clampedTop, left: clampedLeft });
  }, [editor]);

  // Listen for selection changes via editor events
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(updatePosition, 150);
    };

    editor.on("selectionUpdate", handleUpdate);
    editor.on("transaction", handleUpdate);

    return () => {
      clearTimeout(debounceRef.current);
      editor.off("selectionUpdate", handleUpdate);
      editor.off("transaction", handleUpdate);
    };
  }, [editor, updatePosition]);

  // Hide on Escape
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPosition(null);
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, []);

  const handleLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href ?? "";
    const url = window.prompt("URL eingeben:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor || !position) return null;

  return (
    <div
      ref={menuRef}
      className="bubble-menu"
      role="toolbar"
      aria-label="Textformatierung"
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        transform: "translate(-50%, -100%)",
        zIndex: 50,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button className={`bubble-tool ${editor.isActive("bold") ? "active" : ""}`}
              title="Fett (Ctrl+B)" onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </button>
      <button className={`bubble-tool ${editor.isActive("italic") ? "active" : ""}`}
              title="Kursiv (Ctrl+I)" onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </button>
      <button className={`bubble-tool ${editor.isActive("underline") ? "active" : ""}`}
              title="Unterstrichen (Ctrl+U)" onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Underline className="h-4 w-4" />
      </button>

      <div className="bubble-separator" />

      <button className={`bubble-tool ${editor.isActive("heading", { level: 1 }) ? "active" : ""}`}
              title="Überschrift 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-4 w-4" />
      </button>
      <button className={`bubble-tool ${editor.isActive("heading", { level: 2 }) ? "active" : ""}`}
              title="Überschrift 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </button>

      <div className="bubble-separator" />

      <button className={`bubble-tool ${editor.isActive("bulletList") ? "active" : ""}`}
              title="Aufzählung" onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </button>
      <button className={`bubble-tool ${editor.isActive("orderedList") ? "active" : ""}`}
              title="Nummerierung" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </button>
      <button className={`bubble-tool ${editor.isActive("link") ? "active" : ""}`}
              title="Link einfügen" onClick={handleLink}>
        <Link className="h-4 w-4" />
      </button>

      <div className="bubble-separator" />

      <button className="bubble-tool" title="KI-Nachbesserung" onClick={onAIClick}>
        <Sparkles className="h-4 w-4" />
      </button>
    </div>
  );
}
