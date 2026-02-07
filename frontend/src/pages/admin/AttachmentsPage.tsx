/**
 * Attachments Management Page
 *
 * Admin page for managing document attachments (Anlagen):
 * - Upload new attachments (PDF/DOCX)
 * - View all attachments with filtering
 * - Delete attachments
 * - Assign attachments to document types
 *
 * Design: Modern, clean UX optimized for HR users
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Paperclip,
    Search,
    Plus,
    Trash2,
    FileText,
    FileType,
    Filter,
    Loader2,
    Upload,
    CheckCircle2,
    AlertCircle,
    HardDrive,
    FileStack,
    X,
    Info,
} from "lucide-react";
import {
    useAttachments,
    useUploadAttachment,
    useDeleteAttachment,
    type Attachment,
} from "@/hooks/useApi";
import { useDropzone } from "react-dropzone";

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (fileType: string) => {
    if (fileType === "pdf") {
        return <FileText className="w-8 h-8 text-red-500" />;
    }
    return <FileType className="w-8 h-8 text-blue-500" />;
};

/* Animation variants - für zukünftige Verwendung
const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95 },
};
*/

const listItemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
        opacity: 1,
        x: 0,
        transition: { delay: i * 0.05 },
    }),
};

// ═══════════════════════════════════════════════════════════════════════════
// UPLOAD DIALOG COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface UploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    countryCode: string;
    onSuccess: () => void;
}

const UploadDialog = ({ open, onOpenChange, countryCode, onSuccess }: UploadDialogProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    const uploadMutation = useUploadAttachment();

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const selectedFile = acceptedFiles[0];
            setFile(selectedFile);
            // Auto-fill name from filename (without extension)
            if (!name) {
                const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
                setName(nameWithoutExt);
            }
        }
    }, [name]);

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        onDropRejected: (rejectedFiles) => {
            const rejection = rejectedFiles[0];
            if (rejection?.errors?.[0]?.code === "file-too-large") {
                setErrorMessage("Datei zu gross. Maximum: 10 MB");
                setUploadState("error");
            }
        },
        accept: {
            "application/pdf": [".pdf"],
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
        },
        maxFiles: 1,
        maxSize: MAX_FILE_SIZE,
        multiple: false,
    });

    const handleUpload = async () => {
        if (!file || !name.trim()) return;

        setUploadState("uploading");
        setErrorMessage("");

        try {
            await uploadMutation.mutateAsync({
                file,
                name: name.trim(),
                description: description.trim() || undefined,
                countryCode,
                category: category.trim() || undefined,
            });
            setUploadState("success");
            setTimeout(() => {
                onSuccess();
                resetForm();
                onOpenChange(false);
            }, 1500);
        } catch (error) {
            setUploadState("error");
            setErrorMessage(error instanceof Error ? error.message : "Upload fehlgeschlagen");
        }
    };

    const resetForm = () => {
        setFile(null);
        setName("");
        setDescription("");
        setCategory("");
        setUploadState("idle");
        setErrorMessage("");
    };

    const handleClose = () => {
        resetForm();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="w-5 h-5 text-primary" />
                        Neue Anlage hochladen
                    </DialogTitle>
                    <DialogDescription>
                        Laden Sie eine PDF- oder Word-Datei hoch, die als Anlage zu Dokumenten hinzugefügt werden kann.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Drag & Drop Zone */}
                    <div
                        {...getRootProps()}
                        className={`
                            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                            transition-all duration-200 ease-out
                            ${isDragActive
                                ? "border-primary bg-primary/5 scale-[1.02]"
                                : file
                                    ? "border-[#6EBD84] bg-secondary/5"
                                    : "border-border hover:border-primary/50 hover:bg-primary/5"
                            }
                        `}
                    >
                        <input {...getInputProps()} />
                        {file ? (
                            <div className="flex flex-col items-center gap-2">
                                {getFileIcon(file.name.split(".").pop() || "")}
                                <p className="font-medium text-foreground">{file.name}</p>
                                <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFile(null);
                                    }}
                                    className="mt-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                                >
                                    <X className="w-4 h-4 mr-1" />
                                    Entfernen
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Upload className="w-6 h-6 text-primary" />
                                </div>
                                <p className="font-medium text-foreground">
                                    {isDragActive ? "Datei hier ablegen" : "Datei hierher ziehen"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    oder <span className="text-primary font-medium">durchsuchen</span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-2">PDF oder DOCX, max. 10 MB</p>
                            </div>
                        )}
                    </div>

                    {/* Name Input */}
                    <div className="space-y-2">
                        <Label htmlFor="attachment-name" className="text-sm font-medium">
                            Anzeigename <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="attachment-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="z.B. DSGVO Einwilligung"
                            className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                            Dieser Name wird den HR-Mitarbeitern bei der Dokumenterstellung angezeigt.
                        </p>
                    </div>

                    {/* Category Input */}
                    <div className="space-y-2">
                        <Label htmlFor="attachment-category" className="text-sm font-medium">
                            Kategorie
                        </Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder="Kategorie wählen (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="datenschutz">Datenschutz</SelectItem>
                                <SelectItem value="compliance">Compliance</SelectItem>
                                <SelectItem value="arbeitsrecht">Arbeitsrecht</SelectItem>
                                <SelectItem value="betriebsrat">Betriebsrat</SelectItem>
                                <SelectItem value="sonstiges">Sonstiges</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Description Input */}
                    <div className="space-y-2">
                        <Label htmlFor="attachment-description" className="text-sm font-medium">
                            Beschreibung
                        </Label>
                        <Textarea
                            id="attachment-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Kurze Beschreibung der Anlage (optional)"
                            className="resize-none"
                            rows={2}
                        />
                    </div>

                    {/* Status Messages */}
                    <AnimatePresence mode="wait">
                        {uploadState === "success" && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-2 p-3 rounded-lg bg-secondary/10 text-secondary"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="font-medium">Erfolgreich hochgeladen!</span>
                            </motion.div>
                        )}
                        {uploadState === "error" && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600"
                            >
                                <AlertCircle className="w-5 h-5" />
                                <span>{errorMessage}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleClose} disabled={uploadState === "uploading"}>
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleUpload}
                        disabled={!file || !name.trim() || uploadState === "uploading" || uploadState === "success"}
                        className="bg-primary hover:bg-primary/90"
                    >
                        {uploadState === "uploading" ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Wird hochgeladen...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4 mr-2" />
                                Hochladen
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// DELETE CONFIRMATION DIALOG
// ═══════════════════════════════════════════════════════════════════════════

interface DeleteDialogProps {
    attachment: Attachment | null;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
}

const DeleteDialog = ({ attachment, onClose, onConfirm, isDeleting }: DeleteDialogProps) => (
    <Dialog open={!!attachment} onOpenChange={() => onClose()}>
        <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                    <Trash2 className="w-5 h-5" />
                    Anlage löschen?
                </DialogTitle>
                <DialogDescription>
                    Sind Sie sicher, dass Sie diese Anlage löschen möchten?
                </DialogDescription>
            </DialogHeader>

            {attachment && (
                <div className="py-4">
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-100">
                        {getFileIcon(attachment.file_type)}
                        <div>
                            <p className="font-medium text-foreground">{attachment.name}</p>
                            <p className="text-sm text-muted-foreground">
                                {attachment.file_type.toUpperCase()} • {formatFileSize(attachment.file_size_bytes)}
                            </p>
                        </div>
                    </div>
                    <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
                        <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-amber-800">
                            Die Anlage wird aus allen Dokumenttypen entfernt, denen sie zugewiesen ist.
                        </p>
                    </div>
                </div>
            )}

            <DialogFooter className="gap-2">
                <Button variant="outline" onClick={onClose} disabled={isDeleting}>
                    Abbrechen
                </Button>
                <Button
                    variant="destructive"
                    onClick={onConfirm}
                    disabled={isDeleting}
                >
                    {isDeleting ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Wird gelöscht...
                        </>
                    ) : (
                        <>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Endgültig löschen
                        </>
                    )}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const AttachmentsPage = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [countryFilter, setCountryFilter] = useState<string>("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [attachmentToDelete, setAttachmentToDelete] = useState<Attachment | null>(null);

    const { data: attachments, isLoading, refetch } = useAttachments(
        countryFilter !== "all" ? countryFilter : undefined,
        categoryFilter !== "all" ? categoryFilter : undefined
    );

    const deleteMutation = useDeleteAttachment();

    // Filter attachments by search query
    const filteredAttachments = attachments?.filter((attachment) => {
        const matchesSearch =
            searchQuery === "" ||
            attachment.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            attachment.description?.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesSearch;
    }) ?? [];

    // Get unique categories from attachments
    const categories = Array.from(
        new Set(attachments?.map((a) => a.category).filter(Boolean) ?? [])
    );

    const handleDelete = async () => {
        if (!attachmentToDelete) return;

        try {
            await deleteMutation.mutateAsync(attachmentToDelete.id);
            setAttachmentToDelete(null);
        } catch {
            // Error handling is done in the mutation
        }
    };

    // Calculate totals
    const totalSize = filteredAttachments.reduce((sum, a) => sum + (a.file_size_bytes || 0), 0);
    const totalPages = filteredAttachments.reduce((sum, a) => sum + (a.page_count || 0), 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <motion.div
                className="flex justify-between items-center"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Anlagen-Verwaltung
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Verwalten Sie Dokumente, die als Anlagen zu generierten Verträgen hinzugefügt werden können
                    </p>
                </div>
                <Button
                    className="gap-2 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all"
                    onClick={() => setShowUploadDialog(true)}
                >
                    <Plus className="w-4 h-4" />
                    Neue Anlage hochladen
                </Button>
            </motion.div>

            {/* Stats Cards */}
            <motion.div
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <Card className="bg-gradient-to-br from-[#243186]/5 to-[#243186]/10 border-primary/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Paperclip className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-primary">
                                    {filteredAttachments.length}
                                </p>
                                <p className="text-sm text-muted-foreground">Anlagen verfügbar</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-[#6EBD84]/5 to-[#6EBD84]/10 border-[#6EBD84]/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                                <FileStack className="w-6 h-6 text-secondary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-secondary">
                                    {totalPages}
                                </p>
                                <p className="text-sm text-muted-foreground">Seiten gesamt</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-border/20 to-border/30 border-border/40">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-[#6E6E73]/10 flex items-center justify-center">
                                <HardDrive className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">
                                    {formatFileSize(totalSize)}
                                </p>
                                <p className="text-sm text-muted-foreground">Speicherplatz</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Filters */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-wrap gap-4">
                            <div className="flex-1 min-w-[200px]">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Anlagen durchsuchen..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                            <Select value={countryFilter} onValueChange={setCountryFilter}>
                                <SelectTrigger className="w-[150px]">
                                    <Filter className="w-4 h-4 mr-2" />
                                    <SelectValue placeholder="Land" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Alle Länder</SelectItem>
                                    <SelectItem value="DE">Deutschland</SelectItem>
                                    <SelectItem value="IT">Italien</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Kategorie" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Alle Kategorien</SelectItem>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat as string} value={cat as string}>
                                            {cat as string}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Attachments List */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
            >
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : filteredAttachments.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <div className="w-16 h-16 mx-auto rounded-full bg-primary/5 flex items-center justify-center mb-4">
                                <Paperclip className="w-8 h-8 text-primary/40" />
                            </div>
                            <p className="text-lg font-medium text-foreground">
                                Keine Anlagen gefunden
                            </p>
                            <p className="text-muted-foreground mt-1 max-w-md mx-auto">
                                {searchQuery || categoryFilter !== "all"
                                    ? "Versuchen Sie andere Filterkriterien oder laden Sie eine neue Anlage hoch."
                                    : "Laden Sie Ihre erste Anlage hoch, um sie zu Dokumenten hinzufügen zu können."}
                            </p>
                            {!searchQuery && categoryFilter === "all" && (
                                <Button
                                    className="mt-4 bg-primary hover:bg-primary/90"
                                    onClick={() => setShowUploadDialog(true)}
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Erste Anlage hochladen
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        <AnimatePresence mode="popLayout">
                            {filteredAttachments.map((attachment, index) => (
                                <motion.div
                                    key={attachment.id}
                                    custom={index}
                                    variants={listItemVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    layout
                                >
                                    <Card className="hover:shadow-md transition-all duration-200 group">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-4">
                                                {/* File Icon */}
                                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#243186]/5 to-[#243186]/10 flex items-center justify-center flex-shrink-0">
                                                    {getFileIcon(attachment.file_type)}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div>
                                                            <h3 className="font-semibold text-foreground truncate">
                                                                {attachment.name}
                                                            </h3>
                                                            {attachment.description && (
                                                                <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                                                                    {attachment.description}
                                                                </p>
                                                            )}
                                                            <div className="flex flex-wrap gap-2 mt-2">
                                                                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/15">
                                                                    {attachment.file_type.toUpperCase()}
                                                                </Badge>
                                                                <Badge variant="secondary" className="bg-secondary/10 text-secondary hover:bg-secondary/15">
                                                                    {attachment.country_code}
                                                                </Badge>
                                                                {attachment.category && (
                                                                    <Badge variant="outline" className="text-muted-foreground">
                                                                        {attachment.category}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Meta Info */}
                                                        <div className="text-right flex-shrink-0">
                                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                                {attachment.page_count && (
                                                                    <div className="flex items-center gap-1">
                                                                        <FileStack className="w-4 h-4" />
                                                                        <span>{attachment.page_count} Seiten</span>
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center gap-1">
                                                                    <HardDrive className="w-4 h-4" />
                                                                    <span>{formatFileSize(attachment.file_size_bytes)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => setAttachmentToDelete(attachment)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </motion.div>

            {/* Upload Dialog */}
            <UploadDialog
                open={showUploadDialog}
                onOpenChange={setShowUploadDialog}
                countryCode={countryFilter !== "all" ? countryFilter : "DE"}
                onSuccess={() => refetch()}
            />

            {/* Delete Confirmation Dialog */}
            <DeleteDialog
                attachment={attachmentToDelete}
                onClose={() => setAttachmentToDelete(null)}
                onConfirm={handleDelete}
                isDeleting={deleteMutation.isPending}
            />
        </div>
    );
};
