"use client";

import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDebounce } from "./hooks";
import type { PreviewPanelProps, Clause } from "./types";
import { sanitizeHtml } from "@/utils/sanitize";

export const PreviewPanel = ({ sections, availableClauses }: PreviewPanelProps) => {
    // Create a map for quick clause content lookup
    const clauseContentMap = useMemo(() => {
        const map = new Map<string, Clause>();
        availableClauses.forEach((clause) => {
            map.set(clause.id, clause);
        });
        return map;
    }, [availableClauses]);

    // Collect all clauses from all sections
    const allClauses = useMemo(() => {
        return sections.flatMap((section) => section.clauses);
    }, [sections]);

    // Debounce the preview content for performance
    const debouncedClauses = useDebounce(allClauses, 300);

    // Generate preview HTML
    const previewHtml = useMemo(() => {
        if (debouncedClauses.length === 0) {
            return '<p class="text-muted">Keine Textbausteine ausgewählt. Ziehe Textbausteine auf den Canvas, um eine Vorschau zu sehen.</p>';
        }

        return sections
            .map((section) => {
                if (section.clauses.length === 0) return "";

                const sectionContent = section.clauses
                    .map((selectedClause) => {
                        const originalClause = clauseContentMap.get(selectedClause.clauseId);
                        const content =
                            selectedClause.content ||
                            originalClause?.content ||
                            `<p><strong>${selectedClause.title}</strong></p><p>{{inhalt_${selectedClause.clauseId}}}</p>`;
                        return `<div class="clause">${content}</div>`;
                    })
                    .join("\n");

                return `
                    <div class="section">
                        <h2 class="section-title">${section.title}</h2>
                        ${sectionContent}
                    </div>
                `;
            })
            .filter(Boolean)
            .join("\n<hr class=\"section-divider\" />\n");
    }, [sections, debouncedClauses, clauseContentMap]);

    return (
        <div className="w-[300px] flex-shrink-0 border-l bg-white flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b bg-white">
                <h2 className="font-semibold text-lg">Vorschau</h2>
                <p className="text-sm text-muted-foreground">
                    Live-Rendering des Templates
                </p>
            </div>

            {/* Preview Content */}
            <ScrollArea className="flex-1">
                <div className="p-6">
                    <style>{`
                        .preview-content {
                            font-family: 'Georgia', 'Times New Roman', serif;
                            font-size: 12px;
                            line-height: 1.6;
                            color: #1a1a1a;
                        }
                        .preview-content .section {
                            margin-bottom: 1.5rem;
                        }
                        .preview-content .section-title {
                            font-size: 14px;
                            font-weight: 600;
                            margin-bottom: 0.75rem;
                            padding-bottom: 0.25rem;
                            border-bottom: 1px solid #e5e5e5;
                        }
                        .preview-content .clause {
                            margin-bottom: 1rem;
                        }
                        .preview-content .clause p {
                            margin: 0 0 0.5rem 0;
                        }
                        .preview-content .section-divider {
                            border: none;
                            border-top: 1px dashed #d4d4d4;
                            margin: 1.5rem 0;
                        }
                        .preview-content .text-muted {
                            color: #9ca3af;
                            font-style: italic;
                        }
                        /* Placeholder styling */
                        .preview-content code,
                        .preview-content .placeholder {
                            background-color: #fef3c7;
                            padding: 1px 4px;
                            border-radius: 2px;
                            font-family: 'Consolas', monospace;
                            font-size: 11px;
                        }
                    `}</style>
                    <div
                        className="preview-content bg-white border rounded-lg p-6 shadow-sm"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml) }}
                    />
                </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-3 border-t bg-muted/30 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Platzhalter werden gelb markiert</span>
                </div>
            </div>
        </div>
    );
};
