/**
 * LeftControlPanel - Linke Seite des Split-Screen Editors
 *
 * Enthält alle Steuerungselemente:
 * - Dokumenttitel (editierbar)
 * - Formularfelder (collapsible)
 * - Klauseln (collapsible)
 * - Anlagen (collapsible)
 * - Export-Buttons
 *
 * Der Benutzer "gibt Befehle" und das Dokument rechts reagiert.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, Users, Layers, Paperclip } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useWizardContext } from "../WizardContext";
import { FormFieldsSection } from "./FormFieldsSection";
import { ClauseSelectionSection } from "./ClauseSelectionSection";
import { ActionBar } from "./ActionBar";
import { AttachmentSelector } from "../AttachmentSelector";

interface DocumentType {
    id: number;
    name: string;
    country_code?: string;
    category?: string;
}

interface LeftControlPanelProps {
    documentTypes: DocumentType[];
}

export const LeftControlPanel = ({ documentTypes }: LeftControlPanelProps) => {
    const { state, actions } = useWizardContext();
    const { documentTitle, documentTypeId, documentClauses, selectedAttachmentIds } = state;

    // Collapsible states
    const [formOpen, setFormOpen] = useState(true);
    const [clausesOpen, setClausesOpen] = useState(true);
    const [attachmentsOpen, setAttachmentsOpen] = useState(false);

    const documentTypeName = documentTypes.find(t => t.id === documentTypeId)?.name || "Dokument";
    const enabledClausesCount = documentClauses.filter(c => c.is_enabled).length;
    const totalClausesCount = documentClauses.length;

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header mit Dokumenttitel */}
            <div className="p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
                <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs font-medium text-muted-foreground truncate">{documentTypeName}</span>
                </div>
                <Input
                    value={documentTitle}
                    onChange={(e) => actions.setDocumentTitle(e.target.value)}
                    placeholder="Dokumenttitel eingeben..."
                    className="font-medium text-sm h-9"
                />
            </div>

            {/* Scrollbarer Bereich für Sektionen */}
            <ScrollArea className="flex-1 overflow-auto">
                <div className="p-3 space-y-2">
                    {/* Formularfelder */}
                    <Collapsible open={formOpen} onOpenChange={setFormOpen}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary" />
                                <span className="font-medium text-sm">Formularfelder</span>
                            </div>
                            {formOpen ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3">
                            <FormFieldsSection />
                        </CollapsibleContent>
                    </Collapsible>

                    {/* Klauseln */}
                    <Collapsible open={clausesOpen} onOpenChange={setClausesOpen}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-primary" />
                                <span className="font-medium text-sm">Klauseln</span>
                                <span className="text-xs text-muted-foreground">
                                    ({enabledClausesCount}/{totalClausesCount} aktiv)
                                </span>
                            </div>
                            {clausesOpen ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3">
                            <ClauseSelectionSection />
                        </CollapsibleContent>
                    </Collapsible>

                    {/* Anlagen */}
                    {documentTypeId && (
                        <Collapsible open={attachmentsOpen} onOpenChange={setAttachmentsOpen}>
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                <div className="flex items-center gap-2">
                                    <Paperclip className="w-4 h-4 text-primary" />
                                    <span className="font-medium text-sm">Anlagen</span>
                                    {selectedAttachmentIds.length > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                            ({selectedAttachmentIds.length} ausgewählt)
                                        </span>
                                    )}
                                </div>
                                {attachmentsOpen ? (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                )}
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-3">
                                <AttachmentSelector
                                    documentTypeId={documentTypeId}
                                    selectedIds={selectedAttachmentIds}
                                    onSelectionChange={(ids) => {
                                        // Sync attachment selection
                                        const currentIds = [...selectedAttachmentIds];
                                        const addedIds = ids.filter(id => !currentIds.includes(id));
                                        const removedIds = currentIds.filter(id => !ids.includes(id));
                                        for (const id of addedIds) actions.toggleAttachment(id);
                                        for (const id of removedIds) actions.toggleAttachment(id);
                                    }}
                                />
                            </CollapsibleContent>
                        </Collapsible>
                    )}
                </div>
            </ScrollArea>

            {/* Action Bar (fixiert unten) */}
            <ActionBar />
        </div>
    );
};

export default LeftControlPanel;
