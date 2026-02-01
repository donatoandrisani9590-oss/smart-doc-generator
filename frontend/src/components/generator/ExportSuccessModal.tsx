/**
 * ExportSuccessModal - Magic Moment nach erfolgreichem Export
 *
 * Feiert den Erfolg des Users mit:
 * - ✅ Animierter Checkmark
 * - 🎉 Subtle Celebration Animation
 * - 📊 Statistik "X Dokumente diesen Monat erstellt"
 * - Download-Buttons prominent
 *
 * PandaDoc-inspiriert: Celebration Moment
 * v1.0: Initial implementation
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Download, FileText, FileType2, X, Sparkles } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ExportSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    documentTitle: string;
    exportFormat: "pdf" | "docx";
    onDownloadAgain?: (format: "pdf" | "docx") => void;
    documentsThisMonth?: number;
}

export const ExportSuccessModal = ({
    isOpen,
    onClose,
    documentTitle,
    exportFormat,
    onDownloadAgain,
    documentsThisMonth = 1,
}: ExportSuccessModalProps) => {
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Trigger confetti animation
            setShowConfetti(true);
            const timer = setTimeout(() => setShowConfetti(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="sr-only">
                    <DialogTitle>Export erfolgreich</DialogTitle>
                </DialogHeader>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Schließen</span>
                </button>

                <div className="flex flex-col items-center text-center py-6">
                    {/* Animated Checkmark with Sparkles */}
                    <div className="relative mb-6">
                        <AnimatePresence>
                            {showConfetti && (
                                <>
                                    {/* Sparkles Animation */}
                                    {[...Array(6)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            className="absolute"
                                            initial={{
                                                opacity: 0,
                                                scale: 0,
                                                x: 0,
                                                y: 0,
                                            }}
                                            animate={{
                                                opacity: [0, 1, 0],
                                                scale: [0, 1, 0.5],
                                                x: Math.cos((i * 60 * Math.PI) / 180) * 50,
                                                y: Math.sin((i * 60 * Math.PI) / 180) * 50,
                                            }}
                                            transition={{
                                                duration: 1,
                                                delay: i * 0.1,
                                                ease: "easeOut",
                                            }}
                                        >
                                            <Sparkles className="w-4 h-4 text-yellow-500" />
                                        </motion.div>
                                    ))}
                                </>
                            )}
                        </AnimatePresence>

                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{
                                type: "spring",
                                stiffness: 260,
                                damping: 20,
                                delay: 0.1,
                            }}
                            className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.3, type: "spring" }}
                            >
                                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                            </motion.div>
                        </motion.div>
                    </div>

                    {/* Success Message */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <h2 className="text-xl font-semibold text-foreground mb-2">
                            Export erfolgreich!
                        </h2>
                        <p className="text-sm text-muted-foreground mb-1">
                            <span className="font-medium text-foreground">{documentTitle}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                            wurde als {exportFormat.toUpperCase()} heruntergeladen
                        </p>
                    </motion.div>

                    {/* Stats Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="mt-6 p-4 bg-muted/50 rounded-lg w-full"
                    >
                        <div className="flex items-center justify-center gap-2 text-sm">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <span className="text-muted-foreground">
                                Sie haben diesen Monat{" "}
                                <span className="font-semibold text-foreground">
                                    {documentsThisMonth} {documentsThisMonth === 1 ? "Dokument" : "Dokumente"}
                                </span>{" "}
                                erstellt
                            </span>
                        </div>
                    </motion.div>

                    {/* Action Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                        className="mt-6 w-full space-y-3"
                    >
                        {onDownloadAgain && (
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="outline"
                                    className="gap-2"
                                    onClick={() => onDownloadAgain("pdf")}
                                >
                                    <FileText className="w-4 h-4" />
                                    PDF
                                </Button>
                                <Button
                                    variant="outline"
                                    className="gap-2"
                                    onClick={() => onDownloadAgain("docx")}
                                >
                                    <FileType2 className="w-4 h-4" />
                                    DOCX
                                </Button>
                            </div>
                        )}

                        <Button
                            variant="default"
                            className="w-full gap-2"
                            onClick={onClose}
                        >
                            <Download className="w-4 h-4" />
                            Fertig
                        </Button>
                    </motion.div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ExportSuccessModal;
