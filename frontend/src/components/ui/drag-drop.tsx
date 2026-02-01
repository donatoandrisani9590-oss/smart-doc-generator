/**
 * Drag & Drop Components
 *
 * Reusable components for:
 * - Sortable lists (e.g., clause ordering) using @dnd-kit
 * - File drop zones
 * - Accessible drag handles with keyboard navigation
 */

import {
    useState,
    useRef,
    useCallback,
    createContext,
    useContext,
    useMemo,
} from "react";
import type { ReactNode, DragEvent, CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    type DragStartEvent,
    type DragEndEvent,
    type UniqueIdentifier,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Upload, File, X, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// ============================================================================
// Sortable List Components (using @dnd-kit)
// ============================================================================

interface SortableItem {
    id: string | number;
    [key: string]: unknown;
}

interface SortableListProps<T extends SortableItem> {
    items: T[];
    onReorder: (items: T[]) => void;
    renderItem: (item: T, index: number) => ReactNode;
    renderDragOverlay?: (item: T) => ReactNode;
    className?: string;
    disabled?: boolean;
}

// Context for sharing sortable state
interface SortableContextValue {
    activeId: UniqueIdentifier | null;
    disabled: boolean;
}

const SortableListContext = createContext<SortableContextValue>({
    activeId: null,
    disabled: false,
});

/**
 * Sortable list with drag & drop and keyboard support using @dnd-kit
 *
 * Features:
 * - Drag handles for precise control
 * - Keyboard navigation (Arrow keys, Home, End)
 * - Visual feedback during drag
 * - Smooth animations
 * - Touch support
 * - Accessibility (ARIA labels, screen reader support)
 */
export function SortableList<T extends SortableItem>({
    items,
    onReorder,
    renderItem,
    renderDragOverlay,
    className,
    disabled = false,
}: SortableListProps<T>) {
    const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // 8px movement before drag starts
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveId(event.active.id);
    }, []);

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;

            if (over && active.id !== over.id) {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                const newItems = arrayMove(items, oldIndex, newIndex);
                onReorder(newItems);
            }

            setActiveId(null);
        },
        [items, onReorder]
    );

    const handleDragCancel = useCallback(() => {
        setActiveId(null);
    }, []);

    const activeItem = useMemo(
        () => items.find((item) => item.id === activeId),
        [items, activeId]
    );

    const contextValue = useMemo(
        () => ({ activeId, disabled }),
        [activeId, disabled]
    );

    const itemIds = useMemo(() => items.map((item) => item.id), [items]);

    return (
        <SortableListContext.Provider value={contextValue}>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                    <div className={className} role="list" aria-label="Sortierbare Liste">
                        {items.map((item, index) => (
                            <div key={item.id} role="listitem">
                                {renderItem(item, index)}
                            </div>
                        ))}
                    </div>
                </SortableContext>

                {/* Drag Overlay for visual feedback */}
                <DragOverlay adjustScale={false}>
                    {activeItem && renderDragOverlay ? (
                        renderDragOverlay(activeItem)
                    ) : activeItem ? (
                        <div className="opacity-80 shadow-lg rounded-lg bg-background border">
                            {renderItem(activeItem, items.findIndex((i) => i.id === activeItem.id))}
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </SortableListContext.Provider>
    );
}

/**
 * Hook to access sortable list context
 */
export function useSortableListContext() {
    return useContext(SortableListContext);
}

// ============================================================================
// Sortable Item Components
// ============================================================================

interface SortableItemProps {
    id: string | number;
    children: ReactNode;
    className?: string;
    disabled?: boolean;
}

/**
 * Wrapper for individual sortable items
 * Must be used as a child of SortableList's renderItem
 */
export function SortableItemWrapper({
    id,
    children,
    className,
    disabled: itemDisabled,
}: SortableItemProps) {
    const { disabled: listDisabled } = useSortableListContext();
    const isDisabled = itemDisabled ?? listDisabled;

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id,
        disabled: isDisabled,
    });

    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1 : 0,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "relative transition-shadow",
                isDragging && "shadow-lg",
                className
            )}
            {...attributes}
        >
            {/* Provide listeners via context or render prop pattern */}
            <SortableItemContext.Provider value={{ listeners, isDragging, isDisabled }}>
                {children}
            </SortableItemContext.Provider>
        </div>
    );
}

// Context for sortable item
interface SortableItemContextValue {
    listeners: ReturnType<typeof useSortable>["listeners"];
    isDragging: boolean;
    isDisabled: boolean;
}

const SortableItemContext = createContext<SortableItemContextValue>({
    listeners: undefined,
    isDragging: false,
    isDisabled: false,
});

/**
 * Hook to access sortable item context (for drag handle)
 */
export function useSortableItemContext() {
    return useContext(SortableItemContext);
}

// ============================================================================
// Drag Handle Component
// ============================================================================

interface DragHandleProps {
    className?: string;
    children?: ReactNode;
}

/**
 * Drag handle component - must be used inside SortableItemWrapper
 * Provides visual handle and accessibility
 */
export function DragHandle({ className, children }: DragHandleProps) {
    const { listeners, isDragging, isDisabled } = useSortableItemContext();

    return (
        <button
            type="button"
            {...listeners}
            className={cn(
                "flex items-center justify-center w-8 h-8 text-muted-foreground transition-all rounded",
                "hover:text-foreground hover:bg-muted/50",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                "touch-none select-none",
                isDragging ? "cursor-grabbing" : "cursor-grab",
                isDisabled && "cursor-not-allowed opacity-50",
                className
            )}
            aria-label="Element verschieben. Pfeiltasten zum Sortieren verwenden."
            disabled={isDisabled}
        >
            {children || <GripVertical className="w-4 h-4" />}
        </button>
    );
}

// ============================================================================
// Simple Sortable Row Component (convenience wrapper)
// ============================================================================

interface SortableRowProps {
    id: string | number;
    children: ReactNode;
    className?: string;
    showDragHandle?: boolean;
    disabled?: boolean;
}

/**
 * Convenience component for simple sortable rows
 * Includes drag handle by default
 */
export function SortableRow({
    id,
    children,
    className,
    showDragHandle = true,
    disabled,
}: SortableRowProps) {
    return (
        <SortableItemWrapper id={id} disabled={disabled} className={className}>
            <div className="flex items-center gap-2">
                {showDragHandle && <DragHandle />}
                <div className="flex-1">{children}</div>
            </div>
        </SortableItemWrapper>
    );
}

// ============================================================================
// File Drop Zone Components
// ============================================================================

interface FileDropZoneProps {
    onFilesDropped: (files: File[]) => void;
    accept?: string[];
    maxSize?: number; // in bytes
    maxFiles?: number;
    multiple?: boolean;
    disabled?: boolean;
    className?: string;
    children?: ReactNode;
}

interface DroppedFile {
    file: File;
    id: string;
    status: "pending" | "uploading" | "success" | "error";
    progress?: number;
    error?: string;
}

/**
 * File drop zone with drag & drop support
 */
export function FileDropZone({
    onFilesDropped,
    accept = [],
    maxSize = 10 * 1024 * 1024, // 10MB default
    maxFiles = 10,
    multiple = true,
    disabled = false,
    className,
    children,
}: FileDropZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dragCounter = useRef(0);

    const validateFiles = useCallback(
        (files: File[]): { valid: File[]; errors: string[] } => {
            const valid: File[] = [];
            const errors: string[] = [];

            for (const file of files) {
                // Check file type
                if (accept.length > 0) {
                    const fileType = file.type;
                    const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`;
                    const isValidType = accept.some(
                        (type) =>
                            type === fileType ||
                            type === fileExtension ||
                            (type.endsWith("/*") && fileType.startsWith(type.replace("/*", "/")))
                    );
                    if (!isValidType) {
                        errors.push(`${file.name}: Dateityp nicht erlaubt`);
                        continue;
                    }
                }

                // Check file size
                if (file.size > maxSize) {
                    const maxSizeMB = (maxSize / 1024 / 1024).toFixed(1);
                    errors.push(`${file.name}: Datei zu gross (max. ${maxSizeMB} MB)`);
                    continue;
                }

                valid.push(file);
            }

            // Check max files
            if (valid.length > maxFiles) {
                errors.push(`Maximal ${maxFiles} Dateien erlaubt`);
                valid.splice(maxFiles);
            }

            return { valid, errors };
        },
        [accept, maxSize, maxFiles]
    );

    const handleFiles = useCallback(
        (files: FileList | null) => {
            if (!files || disabled) return;

            const fileArray = Array.from(files);
            if (!multiple && fileArray.length > 1) {
                fileArray.splice(1);
            }

            const { valid, errors } = validateFiles(fileArray);

            if (errors.length > 0) {
                setError(errors.join(". "));
                setTimeout(() => setError(null), 5000);
            }

            if (valid.length > 0) {
                onFilesDropped(valid);
            }
        },
        [disabled, multiple, validateFiles, onFilesDropped]
    );

    const handleDragEnter = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
            setIsDragging(false);
        }
    }, []);

    const handleDragOver = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback(
        (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            dragCounter.current = 0;
            handleFiles(e.dataTransfer.files);
        },
        [handleFiles]
    );

    const handleClick = useCallback(() => {
        if (!disabled) {
            inputRef.current?.click();
        }
    }, [disabled]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if ((e.key === "Enter" || e.key === " ") && !disabled) {
                e.preventDefault();
                inputRef.current?.click();
            }
        },
        [disabled]
    );

    return (
        <div className={className}>
            <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-label="Dateien hier ablegen oder klicken zum Auswaehlen"
                aria-disabled={disabled}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={cn(
                    "relative flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-lg transition-all cursor-pointer",
                    "hover:border-primary hover:bg-primary/5",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                    isDragging && "border-primary bg-primary/10 scale-[1.02]",
                    error && "border-destructive",
                    disabled && "cursor-not-allowed opacity-50 hover:border-border hover:bg-transparent"
                )}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={accept.join(",")}
                    multiple={multiple}
                    onChange={(e) => handleFiles(e.target.files)}
                    className="sr-only"
                    disabled={disabled}
                    aria-hidden="true"
                />

                {children || (
                    <>
                        <div
                            className={cn(
                                "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                                isDragging ? "bg-primary/20" : "bg-muted"
                            )}
                        >
                            <Upload
                                className={cn(
                                    "w-6 h-6 transition-colors",
                                    isDragging ? "text-primary" : "text-muted-foreground"
                                )}
                            />
                        </div>
                        <div className="text-center">
                            <p className="font-medium">
                                {isDragging
                                    ? "Dateien hier ablegen"
                                    : "Dateien hierher ziehen"}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                oder <span className="text-primary underline">durchsuchen</span>
                            </p>
                        </div>
                        {(accept.length > 0 || maxSize) && (
                            <p className="text-xs text-muted-foreground">
                                {accept.length > 0 && `${accept.join(", ")} - `}
                                Max. {(maxSize / 1024 / 1024).toFixed(0)} MB
                            </p>
                        )}
                    </>
                )}
            </div>

            {/* Error message */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-2 mt-2 text-sm text-destructive"
                        role="alert"
                    >
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{error}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/**
 * File preview list component
 */
interface FilePreviewListProps {
    files: DroppedFile[];
    onRemove: (id: string) => void;
    className?: string;
}

export function FilePreviewList({ files, onRemove, className }: FilePreviewListProps) {
    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    return (
        <div className={cn("space-y-2", className)} role="list" aria-label="Hochgeladene Dateien">
            <AnimatePresence mode="popLayout">
                {files.map((file) => (
                    <motion.div
                        key={file.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                        role="listitem"
                    >
                        <File className="w-5 h-5 text-muted-foreground flex-shrink-0" />

                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.file.name}</p>
                            <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.file.size)}
                            </p>
                        </div>

                        {file.status === "uploading" && file.progress !== undefined && (
                            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all"
                                    style={{ width: `${file.progress}%` }}
                                    role="progressbar"
                                    aria-valuenow={file.progress}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                />
                            </div>
                        )}

                        {file.status === "success" && (
                            <CheckCircle className="w-5 h-5 text-green-500" aria-label="Erfolgreich hochgeladen" />
                        )}

                        {file.status === "error" && (
                            <AlertCircle className="w-5 h-5 text-destructive" aria-label={file.error || "Fehler beim Hochladen"} />
                        )}

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onRemove(file.id)}
                            aria-label={`${file.file.name} entfernen`}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

// ============================================================================
// Exports
// ============================================================================

export type { SortableItem, DroppedFile, SortableListProps };
