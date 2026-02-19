/**
 * ClauseVersionDiff - Side-by-Side Versionsvergleich
 *
 * v4.2 Feature (Kapitel 15.5.10):
 * - Zwei Klausel-Versionen nebeneinander vergleichen
 * - Änderungen farblich hervorheben
 * - Hinzugefügter Text: Grün
 * - Entfernter Text: Rot
 */

import { useState, useMemo, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { sanitizeHtml } from "@/utils/sanitize";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    GitCompare,
    Loader2,
    Plus,
    Minus,
    Equal,
    ArrowRight,
    History,
} from "lucide-react";

interface ClauseVersion {
    id: number;
    version: number;
    content_html: string;
    created_at: string;
    created_by: string;
    change_summary?: string;
}

interface DiffLine {
    type: "added" | "removed" | "unchanged";
    content: string;
    lineNumber?: number;
}

interface ClauseVersionDiffProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clauseId: number;
    clauseTitle: string;
    versions?: ClauseVersion[];
}

/**
 * Einfacher Diff-Algorithmus für Text-Vergleich.
 * Für Produktionsumgebung könnte man diff-match-patch verwenden.
 */
function computeLineDiff(oldText: string, newText: string): DiffLine[] {
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");
    const result: DiffLine[] = [];

    // Einfacher zeilenbasierter Diff
    const maxLength = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLength; i++) {
        const oldLine = oldLines[i] || "";
        const newLine = newLines[i] || "";

        if (oldLine === newLine) {
            if (oldLine.trim()) {
                result.push({ type: "unchanged", content: oldLine, lineNumber: i + 1 });
            }
        } else {
            if (oldLine.trim()) {
                result.push({ type: "removed", content: oldLine, lineNumber: i + 1 });
            }
            if (newLine.trim()) {
                result.push({ type: "added", content: newLine, lineNumber: i + 1 });
            }
        }
    }

    return result;
}

/**
 * Entfernt HTML-Tags für sauberen Text-Vergleich.
 */
function stripHtml(html: string): string {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
}

/* Inline-Diff: Hebt geänderte Wörter innerhalb einer Zeile hervor.
   Aktuell nicht verwendet, aber für zukünftige Features behalten.
function highlightWordDiff(oldText: string, newText: string): { oldHtml: string; newHtml: string } {
    const oldWords = oldText.split(/\s+/);
    const newWords = newText.split(/\s+/);

    let oldHtml = "";
    let newHtml = "";

    const maxLen = Math.max(oldWords.length, newWords.length);

    for (let i = 0; i < maxLen; i++) {
        const oldWord = oldWords[i] || "";
        const newWord = newWords[i] || "";

        if (oldWord === newWord) {
            oldHtml += oldWord + " ";
            newHtml += newWord + " ";
        } else {
            if (oldWord) {
                oldHtml += `<mark class="bg-red-200 dark:bg-red-900/50 px-0.5 rounded">${oldWord}</mark> `;
            }
            if (newWord) {
                newHtml += `<mark class="bg-green-200 dark:bg-green-900/50 px-0.5 rounded">${newWord}</mark> `;
            }
        }
    }

    return { oldHtml: oldHtml.trim(), newHtml: newHtml.trim() };
}
*/

export function ClauseVersionDiff({
    open,
    onOpenChange,
    clauseId,
    clauseTitle,
    versions: propVersions,
}: ClauseVersionDiffProps) {
    const [leftVersion, setLeftVersion] = useState<number | null>(null);
    const [rightVersion, setRightVersion] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadedVersions, setLoadedVersions] = useState<ClauseVersion[]>([]);

    // Fetch versions when dialog opens
    useEffect(() => {
        if (open && clauseId && !propVersions?.length) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: initialize loading state when fetching versions
            setIsLoading(true);
            apiFetch(`/api/v1/clauses/${clauseId}/versions`)
                .then((res) => res.json())
                .then((data) => {
                    setLoadedVersions(data || []);
                    setIsLoading(false);
                })
                .catch(() => {
                    setLoadedVersions([]);
                    setIsLoading(false);
                });
        }
    }, [open, clauseId, propVersions]);

    // Use prop versions if provided, otherwise use loaded versions
    const versions = propVersions?.length ? propVersions : loadedVersions;

    // Auto-select latest two versions
    useEffect(() => {
        if (versions.length >= 2) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: auto-select latest two versions when version list changes
            setLeftVersion(versions[versions.length - 2].version);
            setRightVersion(versions[versions.length - 1].version);
        } else if (versions.length === 1) {
            setLeftVersion(versions[0].version);
            setRightVersion(versions[0].version);
        }
    }, [versions]);

    const leftData = useMemo(
        () => versions.find((v) => v.version === leftVersion),
        [versions, leftVersion]
    );

    const rightData = useMemo(
        () => versions.find((v) => v.version === rightVersion),
        [versions, rightVersion]
    );

    // Compute diff
    const diff = useMemo(() => {
        if (!leftData || !rightData) return null;

        const leftText = stripHtml(leftData.content_html);
        const rightText = stripHtml(rightData.content_html);

        return computeLineDiff(leftText, rightText);
    }, [leftData, rightData]);

    // Statistics
    const stats = useMemo(() => {
        if (!diff) return { added: 0, removed: 0, unchanged: 0 };
        return {
            added: diff.filter((d) => d.type === "added").length,
            removed: diff.filter((d) => d.type === "removed").length,
            unchanged: diff.filter((d) => d.type === "unchanged").length,
        };
    }, [diff]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <GitCompare className="w-5 h-5" />
                        Versionsvergleich: {clauseTitle}
                    </DialogTitle>
                    <DialogDescription>
                        Vergleiche zwei Versionen dieses Textbausteins
                    </DialogDescription>
                </DialogHeader>

                {/* Version Selectors */}
                <div className="flex items-center gap-4 py-4 border-b">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Alte Version:</span>
                        <Select
                            value={String(leftVersion)}
                            onValueChange={(v) => setLeftVersion(parseInt(v))}
                        >
                            <SelectTrigger className="w-[200px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {versions.map((v) => (
                                    <SelectItem key={v.version} value={String(v.version)}>
                                        v{v.version} - {formatDate(v.created_at)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <ArrowRight className="w-5 h-5 text-muted-foreground" />

                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Neue Version:</span>
                        <Select
                            value={String(rightVersion)}
                            onValueChange={(v) => setRightVersion(parseInt(v))}
                        >
                            <SelectTrigger className="w-[200px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {versions.map((v) => (
                                    <SelectItem key={v.version} value={String(v.version)}>
                                        v{v.version} - {formatDate(v.created_at)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex-1" />

                    {/* Statistics */}
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-green-600 border-green-300">
                            <Plus className="w-3 h-3 mr-1" />
                            {stats.added} hinzugefügt
                        </Badge>
                        <Badge variant="outline" className="text-red-600 border-red-300">
                            <Minus className="w-3 h-3 mr-1" />
                            {stats.removed} entfernt
                        </Badge>
                        <Badge variant="outline" className="text-muted-foreground">
                            <Equal className="w-3 h-3 mr-1" />
                            {stats.unchanged} unverändert
                        </Badge>
                    </div>
                </div>

                {/* Diff View */}
                <div className="flex-1 overflow-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-0 border rounded-lg overflow-hidden">
                            {/* Left Panel (Old) */}
                            <div className="border-r">
                                <div className="bg-red-50 dark:bg-red-900/20 px-4 py-2 border-b font-medium text-sm">
                                    Version {leftVersion} (Alt)
                                    {leftData && (
                                        <span className="text-muted-foreground ml-2">
                                            von {leftData.created_by}
                                        </span>
                                    )}
                                </div>
                                <div className="p-4 space-y-1 font-mono text-sm">
                                    {leftData && (
                                        <div
                                            className="prose prose-sm dark:prose-invert max-w-none"
                                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(leftData.content_html) }}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Right Panel (New) */}
                            <div>
                                <div className="bg-green-50 dark:bg-green-900/20 px-4 py-2 border-b font-medium text-sm">
                                    Version {rightVersion} (Neu)
                                    {rightData && (
                                        <span className="text-muted-foreground ml-2">
                                            von {rightData.created_by}
                                        </span>
                                    )}
                                </div>
                                <div className="p-4 space-y-1 font-mono text-sm">
                                    {rightData && (
                                        <div
                                            className="prose prose-sm dark:prose-invert max-w-none"
                                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(rightData.content_html) }}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Unified Diff View (Line by Line) */}
                    {diff && diff.length > 0 && (
                        <div className="mt-4 border rounded-lg overflow-hidden">
                            <div className="bg-muted px-4 py-2 border-b font-medium text-sm flex items-center gap-2">
                                <History className="w-4 h-4" />
                                Änderungen (zeilenweise)
                            </div>
                            <div className="divide-y font-mono text-sm">
                                {diff.map((line, idx) => (
                                    <div
                                        key={idx}
                                        className={`px-4 py-1 flex items-start gap-3 ${
                                            line.type === "added"
                                                ? "bg-green-50 dark:bg-green-900/20"
                                                : line.type === "removed"
                                                    ? "bg-red-50 dark:bg-red-900/20"
                                                    : ""
                                        }`}
                                    >
                                        <span className="w-6 text-muted-foreground text-right flex-shrink-0">
                                            {line.lineNumber}
                                        </span>
                                        <span
                                            className={`w-4 flex-shrink-0 font-bold ${
                                                line.type === "added"
                                                    ? "text-green-600"
                                                    : line.type === "removed"
                                                        ? "text-red-600"
                                                        : "text-muted-foreground"
                                            }`}
                                        >
                                            {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                                        </span>
                                        <span className="flex-1 whitespace-pre-wrap">{line.content}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer with Change Summary */}
                {rightData?.change_summary && (
                    <div className="border-t pt-4">
                        <div className="text-sm">
                            <span className="font-medium">Änderungsbeschreibung:</span>{" "}
                            {rightData.change_summary}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
