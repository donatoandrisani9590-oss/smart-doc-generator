/**
 * MiddlePanel - Document List Panel
 *
 * Features:
 * - Breadcrumb navigation (Library / All)
 * - Pages/Events toggle
 * - Search with filter
 * - Hierarchical document/folder list
 * - Expandable folders with nested items
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    Filter,
    FileText,
    Folder,
    ChevronRight,
    ChevronDown,
    MoreHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useDocumentTypes } from "@/hooks/useApi";
import { usePanelContext } from "./ThreePanelLayout";

interface FolderItem {
    id: number;
    name: string;
    type: "folder" | "document";
    count?: number;
    children?: FolderItem[];
    avatars?: string[];
    updatedAt?: string;
}

// Mock data for folders - in production this would come from API
const MOCK_FOLDERS: FolderItem[] = [
    {
        id: 1,
        name: "Arbeitsvertraege",
        type: "folder",
        count: 23,
        children: [
            { id: 11, name: "Vollzeit", type: "folder", count: 7 },
            { id: 12, name: "Teilzeit", type: "folder", count: 4 },
            { id: 13, name: "Befristet", type: "folder", count: 5 },
            { id: 14, name: "Minijob", type: "folder", count: 3 },
            { id: 15, name: "Praktikum", type: "folder", count: 4 },
        ],
    },
    {
        id: 2,
        name: "Kuendigungen",
        type: "folder",
        count: 15,
    },
    {
        id: 3,
        name: "Zeugnisse",
        type: "folder",
        count: 9,
        children: [
            { id: 31, name: "Arbeitszeugnisse", type: "folder", count: 6 },
            { id: 32, name: "Zwischenzeugnisse", type: "folder", count: 3 },
        ],
    },
    {
        id: 4,
        name: "Vereinbarungen",
        type: "folder",
        count: 12,
    },
];

interface FolderItemComponentProps {
    item: FolderItem;
    level: number;
    isSelected: boolean;
    onSelect: (id: number) => void;
}

const FolderItemComponent = ({ item, level, isSelected, onSelect }: FolderItemComponentProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasChildren = item.children && item.children.length > 0;

    return (
        <div>
            <div
                className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer group transition-all",
                    isSelected
                        ? "bg-green-50 border border-green-200"
                        : "hover:bg-gray-50 border border-transparent"
                )}
                style={{ paddingLeft: `${12 + level * 16}px` }}
                onClick={() => {
                    if (hasChildren) {
                        setIsExpanded(!isExpanded);
                    }
                    onSelect(item.id);
                }}
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Expand/Collapse Icon or Spacer */}
                    {hasChildren ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                            }}
                            className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                        >
                            {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                        </button>
                    ) : (
                        <div className="w-5" />
                    )}

                    {/* Icon */}
                    <div className={cn(
                        "p-1.5 rounded-md",
                        item.type === "folder" ? "bg-amber-100" : "bg-blue-100"
                    )}>
                        {item.type === "folder" ? (
                            <Folder className="w-4 h-4 text-amber-600" />
                        ) : (
                            <FileText className="w-4 h-4 text-blue-600" />
                        )}
                    </div>

                    {/* Name */}
                    <span className={cn(
                        "text-sm truncate",
                        isSelected ? "font-semibold text-gray-900" : "text-gray-700"
                    )}>
                        {item.name}
                    </span>

                    {/* Avatars (if any) */}
                    {item.avatars && item.avatars.length > 0 && (
                        <div className="flex -space-x-1.5 ml-2">
                            {item.avatars.slice(0, 3).map((avatar, i) => (
                                <div
                                    key={i}
                                    className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 border-2 border-white flex items-center justify-center"
                                >
                                    <span className="text-[8px] text-white font-bold">
                                        {avatar}
                                    </span>
                                </div>
                            ))}
                            {item.avatars.length > 3 && (
                                <div className="w-5 h-5 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                                    <span className="text-[8px] text-gray-600 font-bold">
                                        +{item.avatars.length - 3}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right side: Count and Menu */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.count !== undefined && (
                        <span className="text-xs text-gray-400">{item.count}</span>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <MoreHorizontal className="w-4 h-4 text-gray-400" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>Oeffnen</DropdownMenuItem>
                            <DropdownMenuItem>Umbenennen</DropdownMenuItem>
                            <DropdownMenuItem>Verschieben</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">Loeschen</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Children */}
            <AnimatePresence>
                {isExpanded && hasChildren && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        {item.children!.map((child) => (
                            <FolderItemComponent
                                key={child.id}
                                item={child}
                                level={level + 1}
                                isSelected={false}
                                onSelect={onSelect}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const MiddlePanel = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"pages" | "events">("pages");
    const { selectedItemId, setSelectedItemId } = usePanelContext();

    // Get document types for folders
    const { data: documentTypes } = useDocumentTypes();

    // Build folder structure from document types
    const folders = useMemo(() => {
        if (!documentTypes || documentTypes.length === 0) {
            return MOCK_FOLDERS;
        }

        // Group by category
        const categoryMap = new Map<string, FolderItem[]>();
        documentTypes.forEach((dt: any) => {
            const category = dt.category || "Sonstige";
            if (!categoryMap.has(category)) {
                categoryMap.set(category, []);
            }
            categoryMap.get(category)!.push({
                id: dt.id,
                name: dt.name,
                type: "document",
            });
        });

        // Convert to folder structure
        return Array.from(categoryMap.entries()).map(([category, items], index) => ({
            id: 1000 + index,
            name: category,
            type: "folder" as const,
            count: items.length,
            children: items,
        }));
    }, [documentTypes]);

    // Filter folders based on search
    const filteredFolders = useMemo(() => {
        if (!searchQuery.trim()) return folders;

        const query = searchQuery.toLowerCase();
        return folders.filter(folder => {
            const folderMatches = folder.name.toLowerCase().includes(query);
            const childrenMatch = folder.children?.some(child =>
                child.name.toLowerCase().includes(query)
            );
            return folderMatches || childrenMatch;
        });
    }, [folders, searchQuery]);

    const totalCount = folders.reduce((acc, f) => acc + (f.count || 0), 0);

    return (
        <div className="w-full h-full flex flex-col bg-white">
            {/* Header with Breadcrumb and Tabs */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm mb-3">
                    <span className="font-semibold text-gray-900">Bibliothek</span>
                    <span className="text-gray-400">/</span>
                    <span className="text-gray-500">Alle</span>
                    <Badge variant="secondary" className="ml-1 bg-gray-100 text-gray-600 text-xs">
                        {totalCount}
                    </Badge>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg w-fit">
                    <button
                        onClick={() => setActiveTab("pages")}
                        className={cn(
                            "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                            activeTab === "pages"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        Seiten
                    </button>
                    <button
                        onClick={() => setActiveTab("events")}
                        className={cn(
                            "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                            activeTab === "events"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        Ereignisse
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            type="text"
                            placeholder="Suchen..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 bg-gray-50 border-gray-200 focus:bg-white"
                            data-global-search
                        />
                    </div>
                    <Button variant="outline" size="sm" className="h-9 px-3 gap-2">
                        <Filter className="w-4 h-4" />
                        Filter
                    </Button>
                </div>
            </div>

            {/* Folder List */}
            <div className="flex-1 overflow-y-auto p-2">
                {filteredFolders.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">Keine Ergebnisse gefunden</p>
                    </div>
                ) : (
                    <div className="space-y-0.5">
                        {filteredFolders.map((folder) => (
                            <FolderItemComponent
                                key={folder.id}
                                item={folder}
                                level={0}
                                isSelected={selectedItemId === folder.id}
                                onSelect={(id) => {
                                    setSelectedItemId(id);
                                    // Navigate to document if it's a document type
                                    if (folder.type === "document") {
                                        navigate(`/generate?type=${folder.id}`);
                                    }
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MiddlePanel;
