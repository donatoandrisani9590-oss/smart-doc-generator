/**
 * ClausePreviewDialog
 *
 * Read-only preview dialog for a clause, showing rendered HTML content,
 * metadata badges, and placeholder variables.
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Eye } from "lucide-react";
import { sanitizeHtml } from "@/utils/sanitize";
import type { ClausePreviewDialogProps } from "./types";

export const ClausePreviewDialog = ({
    open,
    onOpenChange,
    clause,
}: ClausePreviewDialogProps) => {
    if (!clause) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5 text-primary" />
                        {clause.title}
                    </DialogTitle>
                    <DialogDescription>
                        <div className="flex gap-2 mt-2">
                            <Badge className="bg-primary/10 text-primary">
                                {clause.category || "Allgemein"}
                            </Badge>
                            <Badge className="bg-secondary/10 text-secondary">
                                {clause.country_code === "DE" ? "\u{1F1E9}\u{1F1EA} Deutschland" : "\u{1F1EE}\u{1F1F9} Italien"}
                            </Badge>
                            <Badge variant="outline">v{clause.version || "1.0"}</Badge>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 overflow-y-auto max-h-[50vh]">
                    <div className="p-4 bg-background rounded-lg">
                        <div
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(clause.content || "") }}
                        />
                    </div>

                    {clause.placeholders && clause.placeholders.length > 0 && (
                        <div className="mt-4">
                            <p className="text-sm font-medium text-foreground mb-2">
                                Verwendete Platzhalter:
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {clause.placeholders.map((ph: string) => (
                                    <Badge
                                        key={ph}
                                        variant="outline"
                                        className="font-mono text-xs"
                                    >
                                        {`{{${ph}}}`}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Schließen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
