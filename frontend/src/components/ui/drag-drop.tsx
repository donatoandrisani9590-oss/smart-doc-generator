/**
 * Drag & Drop Components
 *
 * Reusable components for:
 * - Sortable lists (e.g., clause ordering)
 * - File drop zones
 * - Accessible drag handles
 */

import {
    useState,
    useRef,
    useCallback,
} from "react";
import type { ReactNode, DragEvent, KeyboardEvent } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { GripVertical, Upload, File, X, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// ============================================================================
// Sortable List Components
// ============================================================================

interface SortableItem {
    id: string | number;
    [key: string]: unknown;
}

interface SortableListProps<T extends SortableItem> {
    items: T[];
    onReorder: (items: T[]) => void;
    renderItem: (item: T, index: number, dragHandleProps: DragHandleProps) => ReactNode;
    className?: string;
    disabled?: boolean;
}

interface DragHandleProps {
    "aria-label": string;
    "aria-describedby": string;
    role: string;
    tabIndex: number;
    onKeyDown: (e: KeyboardEvent) => void;
    className?: string;
}

/**
 * Sortable list with drag & drop and keyboard support
 */
export function SortableList<T extends SortableItem>({
    items,
    onReorder,
    renderItem,
    className,
    disabled = false,
}: SortableListProps<T>) {
    const [activeId, setActiveId] = useState<string | number | null>(null);
    const instructionsId = `sortable-instructions-${Math.random().toString(36).substr(2, 9)}`;

    const handleKeyDown = useCallback(
        (index: number) => (e: KeyboardEvent) => {
            if (disabled) return;

            const currentItems = [...items];
            let newIndex = index;

            switch (e.key) {
                case "ArrowUp":
                case "ArrowLeft":
                    e.preventDefault();
                    if (index > 0) {
                        newIndex = index - 1;
                        [currentItems[index], currentItems[newIndex]] = [currentItems[newIndex], currentItems[index]];
                        onReorder(currentItems);
                    }
                    break;
                case "ArrowDown":
                case "ArrowRight":
                    e.preventDefault();
                    if (index < items.length - 1) {
                        newIndex = index + 1;
                        [currentItems[index], currentItems[newIndex]] = [currentItems[newIndex], currentItems[index]];
                        onReorder(currentItems);
                    }
                    break;
                case "Home":
                    e.preventDefault();
                    if (index > 0) {
                        const [item] = currentItems.splice(index, 1);
                        currentItems.unshift(item);
                        onReorder(currentItems);
                    }
                    break;
                case "End":
                    e.preventDefault();
                    if (index < items.length - 1) {
                        const [item] = currentItems.splice(index, 1);
                        currentItems.push(item);
                        onReorder(currentItems);
                    }
                    break;
            }
        },
        [items, onReorder, disabled]
    );

    const getDragHandleProps = useCallback(
        (_item: T, index: number): DragHandleProps => ({
            "aria-label": `Element ${index + 1} von ${items.length} verschieben`,
            "aria-describedby": instructionsId,
            role: "button",
            tabIndex: disabled ? -1 : 0,
            onKeyDown: handleKeyDown(index),
        }),
        [items.length, instructionsId, handleKeyDown, disabled]
    );

    return (
        <div className={className}>
            {/* Screen reader instructions */}
            <div id={instructionsId} className="sr-only">
                Verwenden Sie die Pfeiltasten, um Elemente zu verschieben. Home springt zum Anfang, End zum Ende.
            </div>

            <Reorder.Group
                axis="y"
                values={items}
                onReorder={onReorder}
                className="space-y-2"
            >
                <AnimatePresence>
                    {items.map((item, index) => (
                        <Reorder.Item
                            key={item.id}
                            value={item}
                            dragListener={!disabled}
                            className={cn(
                                "relative",
                                activeId === item.id && "z-10"
                            )}
                            onDragStart={() => setActiveId(item.id)}
                            onDragEnd={() => setActiveId(null)}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {renderItem(item, index, getDragHandleProps(item, index))}
                        </Reorder.Item>
                    ))}
                </AnimatePresence>
            </Reorder.Group>
        </div>
    );
}

/**
 * Drag handle component
 */
export function DragHandle({
    className,
    ...props
}: DragHandleProps & { children?: ReactNode; className?: string }) {
    return (
        <div
            {...props}
            className={cn(
                "flex items-center justify-center w-6 h-6 text-muted-foreground hover:text-foreground transition-colors cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded",
                className
            )}
        >
            <GripVertical className="w-4 h-4" />
        </div>
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
                    errors.push(`${file.name}: Datei zu groß (max. ${maxSizeMB} MB)`);
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
                aria-label="Dateien hier ablegen oder klicken zum Auswählen"
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
                                {accept.length > 0 && `${accept.join(", ")} • `}
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
