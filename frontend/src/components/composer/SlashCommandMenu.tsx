import { useEffect, useRef } from "react";
import {
    Type,
    Heading1,
    Heading2,
    List,
    ListOrdered,
    Quote
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SlashCommandItem {
    id: string;
    title: string;
    icon: React.ElementType;
    action: () => void;
}

interface SlashCommandMenuProps {
    items: SlashCommandItem[];
    selectedIndex: number;
    onSelect: (index: number) => void;
    position: { x: number; y: number };
}

export const SlashCommandMenu = ({
    items,
    selectedIndex,
    onSelect,
    position
}: SlashCommandMenuProps) => {
    const menuRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to selected item
    useEffect(() => {
        const activeItem = menuRef.current?.children[selectedIndex] as HTMLElement;
        if (activeItem) {
            activeItem.scrollIntoView({ block: "nearest" });
        }
    }, [selectedIndex]);

    if (items.length === 0) return null;

    return (
        <div
            ref={menuRef}
            className="fixed z-50 w-64 bg-white rounded-lg shadow-xl border border-warm-200 overflow-hidden flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100"
            style={{
                top: position.y + 24, // Offset below cursor
                left: position.x,
            }}
        >
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-warm-50/50 border-b mb-1">
                Befehle
            </div>

            {items.map((item, index) => (
                <button
                    key={item.id}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                        index === selectedIndex
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-warm-50 text-foreground"
                    )}
                    onClick={() => onSelect(index)}
                    onMouseEnter={() => onSelect(index)} // UX: Follow mouse too
                >
                    <div className={cn(
                        "p-1 rounded border",
                        index === selectedIndex ? "bg-white border-primary/20" : "bg-warm-50 border-warm-100"
                    )}>
                        <item.icon className="w-4 h-4" />
                    </div>
                    <span>{item.title}</span>
                </button>
            ))}
        </div>
    );
};

// Default commands factory
export const getSlashCommands = (editor: any): SlashCommandItem[] => [
    {
        id: "text",
        title: "Text",
        icon: Type,
        action: () => editor.chain().focus().setParagraph().run(),
    },
    {
        id: "h1",
        title: "Überschrift 1 (Nur Struktur)",
        icon: Heading1,
        action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
        id: "h2",
        title: "Überschrift 2 (Nur Struktur)",
        icon: Heading2,
        action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
        id: "bullet",
        title: "Aufzählung",
        icon: List,
        action: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
        id: "ordered",
        title: "Nummerierte Liste",
        icon: ListOrdered,
        action: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
        id: "blockquote",
        title: "Zitat",
        icon: Quote,
        action: () => editor.chain().focus().toggleBlockquote().run(),
    }
];
