/**
 * Attachment Selector Component
 *
 * Modern, user-friendly component for selecting attachments
 * to include with generated documents.
 *
 * Features:
 * - Visual attachment cards with file type icons
 * - Real-time page count and file size calculation
 * - Category grouping
 * - Preselection support for mandatory attachments
 * - Smooth animations
 */

import { useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Paperclip,
    FileText,
    FileType,
    FileStack,
    Lock,
    Info,
} from "lucide-react";
import { useAttachmentsForDocumentType, type AttachmentForDocumentType } from "@/hooks/useApi";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface AttachmentSelectorProps {
    documentTypeId: number;
    selectedIds: number[];
    onSelectionChange: (ids: number[]) => void;
    disabled?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/* formatFileSize - für zukünftige Verwendung bei Dateigröße-Anzeige
const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
*/

const getFileIcon = (fileType: string, className: string = "w-5 h-5") => {
    if (fileType === "pdf") {
        return <FileText className={`${className} text-red-500`} />;
    }
    return <FileType className={`${className} text-blue-500`} />;
};

// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
};

// ═══════════════════════════════════════════════════════════════════════════
// SINGLE ATTACHMENT ITEM
// ═══════════════════════════════════════════════════════════════════════════

interface AttachmentItemProps {
    attachment: AttachmentForDocumentType;
    isSelected: boolean;
    onToggle: () => void;
    disabled?: boolean;
}

const AttachmentItem = ({ attachment, isSelected, onToggle, disabled }: AttachmentItemProps) => {
    const isMandatory = attachment.is_mandatory;
    const isDisabled = disabled || isMandatory;

    return (
        <motion.div
            variants={itemVariants}
            whileHover={!isDisabled ? { scale: 1.01 } : undefined}
            whileTap={!isDisabled ? { scale: 0.99 } : undefined}
        >
            <div
                className={`
                    flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer
                    ${isSelected
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-background hover:bg-primary/5 hover:border-primary/30"
                    }
                    ${isDisabled ? "cursor-not-allowed opacity-75" : ""}
                `}
                onClick={() => !isDisabled && onToggle()}
            >
                {/* Checkbox */}
                <div className="flex-shrink-0">
                    <Checkbox
                        id={`attachment-${attachment.attachment_id}`}
                        checked={isSelected}
                        onCheckedChange={() => !isDisabled && onToggle()}
                        disabled={isDisabled}
                        className={isSelected ? "border-primary data-[state=checked]:bg-primary" : ""}
                    />
                </div>

                {/* File Icon */}
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
                    {getFileIcon(attachment.file_type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <Label
                        htmlFor={`attachment-${attachment.attachment_id}`}
                        className={`
                            font-medium text-foreground cursor-pointer block truncate
                            ${isDisabled ? "cursor-not-allowed" : ""}
                        `}
                    >
                        {attachment.name}
                    </Label>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="uppercase font-medium">{attachment.file_type}</span>
                        {attachment.page_count && (
                            <>
                                <span className="text-border">•</span>
                                <span>{attachment.page_count} {attachment.page_count === 1 ? "Seite" : "Seiten"}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Mandatory Badge */}
                {isMandatory && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge
                                    variant="secondary"
                                    className="bg-primary/10 text-primary gap-1 flex-shrink-0"
                                >
                                    <Lock className="w-3 h-3" />
                                    Pflicht
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Diese Anlage ist für diesen Dokumenttyp vorgeschrieben</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const AttachmentSelector = ({
    documentTypeId,
    selectedIds,
    onSelectionChange,
    disabled = false,
}: AttachmentSelectorProps) => {
    const { data, isLoading, error } = useAttachmentsForDocumentType(documentTypeId);

    const attachments: AttachmentForDocumentType[] = data || [];

    // Auto-select preselected and mandatory attachments on initial load
    useEffect(() => {
        if (attachments.length > 0 && selectedIds.length === 0) {
            const preselectedIds = attachments
                .filter(a => a.is_preselected || a.is_mandatory)
                .map(a => a.attachment_id);
            if (preselectedIds.length > 0) {
                onSelectionChange(preselectedIds);
            }
        }
    }, [attachments, selectedIds.length, onSelectionChange]);

    const handleToggle = (id: number, isMandatory: boolean) => {
        if (isMandatory) return; // Can't deselect mandatory attachments

        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter((i) => i !== id));
        } else {
            onSelectionChange([...selectedIds, id]);
        }
    };

    // Calculate totals for selected attachments
    const { totalPages, selectedCount } = useMemo(() => {
        const selected = attachments.filter((a) => selectedIds.includes(a.attachment_id));
        return {
            totalPages: selected.reduce((sum, a) => sum + (a.page_count || 0), 0),
            selectedCount: selected.length,
        };
    }, [attachments, selectedIds]);

    // Don't render if no document type selected or no attachments
    if (!documentTypeId || (attachments.length === 0 && !isLoading)) {
        return null;
    }

    if (isLoading) {
        return (
            <Card className="overflow-hidden">
                <CardHeader className="pb-3 bg-gradient-to-r from-[#243186]/5 to-transparent">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-primary" />
                        Anlagen
                    </CardTitle>
                </CardHeader>
                <CardContent className="py-6">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Lade Anlagen...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="overflow-hidden border-red-200">
                <CardContent className="py-6">
                    <div className="flex items-center justify-center gap-2 text-red-600">
                        <Info className="w-4 h-4" />
                        <span className="text-sm">Anlagen konnten nicht geladen werden</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-[#243186]/5 to-transparent">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-primary" />
                        Anlagen hinzufügen
                    </CardTitle>
                    {attachments.length > 0 && (
                        <Badge variant="outline" className="text-muted-foreground font-normal">
                            {attachments.length} verfügbar
                        </Badge>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-4">
                {/* Help Text */}
                <p className="text-sm text-muted-foreground flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                        Wählen Sie Anlagen aus, die dem generierten Dokument angehängt werden sollen.
                    </span>
                </p>

                {/* Attachment List */}
                <motion.div
                    className="space-y-2"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <AnimatePresence mode="popLayout">
                        {attachments.map((attachment) => (
                            <AttachmentItem
                                key={attachment.attachment_id}
                                attachment={attachment}
                                isSelected={selectedIds.includes(attachment.attachment_id)}
                                onToggle={() => handleToggle(attachment.attachment_id, attachment.is_mandatory)}
                                disabled={disabled}
                            />
                        ))}
                    </AnimatePresence>
                </motion.div>

                {/* Summary */}
                {selectedCount > 0 && (
                    <motion.div
                        className="pt-3 border-t border-border/30"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5 text-sm text-primary">
                                    <Paperclip className="w-4 h-4" />
                                    <span className="font-medium">
                                        {selectedCount} {selectedCount === 1 ? "Anlage" : "Anlagen"} ausgewählt
                                    </span>
                                </div>
                            </div>
                            {totalPages > 0 && (
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <FileStack className="w-4 h-4" />
                                    <span>{totalPages} zusätzliche Seiten</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </CardContent>
        </Card>
    );
};
