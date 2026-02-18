/**
 * LeftControlPanel - Linke Seite des Split-Screen Editors
 *
 * Clean Design nach UX-Audit:
 * - Dokumenttitel (editierbar)
 * - Formularfelder (IMMER sichtbar, nicht collapsible)
 * - Textbausteine (kompakter Link mit Modal)
 * - Anlagen (kompakter Link mit Modal)
 * - Export-Buttons
 *
 * v5.0: Aufgeräumtes Design - keine Akkordeons mehr
 */

import { useState } from "react";
import { FileText, Users, Layers, Paperclip, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useWizardContext } from "../WizardContext";
import { FormFieldsSection } from "./FormFieldsSection";
import { ClauseSelectionSection } from "./ClauseSelectionSection";
import { ActionBar } from "./ActionBar";
import { AttachmentSelector } from "../AttachmentSelector";
import { StationeryPicker } from "./StationeryPicker";
import { DocumentStatusBadge, useDocumentStatus } from "@/components/documents/DocumentStatusBadge";

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

    // Modal states für Textbausteine und Anlagen
    const [showClausesModal, setShowClausesModal] = useState(false);
    const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);

    const selectedDocumentType = documentTypes.find(t => t.id === documentTypeId);
    const documentTypeName = selectedDocumentType?.name || "Dokument";
    const documentCountryCode = selectedDocumentType?.country_code || "DE";
    const enabledClausesCount = documentClauses.filter(c => c.is_enabled).length;
    const totalClausesCount = documentClauses.length;

    // Berechne Dokumentstatus für Badge
    const documentStatus = useDocumentStatus({
        documentTypeId,
        formData: state.formData,
        documentTitle,
        hasExported: state.hasExported,
    });

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header mit Dokumenttitel */}
            <div className="p-4 pb-3 border-b border-border/40 bg-background shrink-0">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                        <span className="text-[11px] font-medium text-muted-foreground/80 truncate">{documentTypeName}</span>
                    </div>
                    <DocumentStatusBadge status={documentStatus} size="sm" />
                </div>
                <Input
                    value={documentTitle}
                    onChange={(e) => actions.setDocumentTitle(e.target.value)}
                    placeholder="Dokumenttitel eingeben..."
                    className="font-medium text-sm"
                />
            </div>

            {/* Briefpapier-Auswahl */}
            <div className="px-4 py-3 border-b border-border/30">
                <StationeryPicker
                    value={state.userTemplateId}
                    onChange={(id) => {
                        actions.setUserTemplateId(id);
                        if (id) {
                            actions.loadStationeryZones(id);
                        }
                    }}
                    countryCode={documentCountryCode}
                />
            </div>

            {/* Scrollbarer Bereich für Sektionen */}
            <ScrollArea className="flex-1 overflow-auto">
                <div className="p-4 space-y-4">
                    {/* Formularfelder - IMMER sichtbar (nicht collapsible) */}
                    <div>
                        <div className="flex items-center gap-2 py-1.5 mb-2">
                            <Users className="w-3.5 h-3.5 text-primary/60 shrink-0" />
                            <span className="text-[10px] font-semibold text-muted-foreground/70 tracking-widest uppercase">Formularfelder</span>
                        </div>
                        <FormFieldsSection countryCode={documentCountryCode} />
                    </div>

                    {/* Textbausteine - Kompakter Link mit Modal */}
                    {totalClausesCount > 0 && (
                        <Button
                            variant="ghost"
                            className="w-full justify-between h-auto py-3 px-4 bg-card hover:bg-muted/50 border border-border/40 hover:border-border/60 rounded-xl transition-all"
                            onClick={() => setShowClausesModal(true)}
                        >
                            <div className="flex items-center gap-2">
                                <Layers className="w-3.5 h-3.5 text-primary/60" />
                                <span className="font-medium text-sm">Textbausteine</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-[10px] font-normal">
                                    {enabledClausesCount}/{totalClausesCount}
                                </Badge>
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                            </div>
                        </Button>
                    )}

                    {/* Anlagen - Kompakter Link mit Modal */}
                    {documentTypeId && (
                        <Button
                            variant="ghost"
                            className="w-full justify-between h-auto py-3 px-4 bg-card hover:bg-muted/50 border border-border/40 hover:border-border/60 rounded-xl transition-all"
                            onClick={() => setShowAttachmentsModal(true)}
                        >
                            <div className="flex items-center gap-2">
                                <Paperclip className="w-3.5 h-3.5 text-primary/60" />
                                <span className="font-medium text-sm">Anlagen</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedAttachmentIds.length > 0 && (
                                    <Badge variant="secondary" className="text-[10px] font-normal">
                                        {selectedAttachmentIds.length}
                                    </Badge>
                                )}
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                            </div>
                        </Button>
                    )}
                </div>
            </ScrollArea>

            {/* Action Bar (fixiert unten) */}
            <ActionBar />

            {/* Textbausteine Modal */}
            <Dialog open={showClausesModal} onOpenChange={setShowClausesModal}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Layers className="w-5 h-5 text-primary" />
                            Textbausteine anpassen
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto py-4">
                        <ClauseSelectionSection />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Anlagen Modal */}
            <Dialog open={showAttachmentsModal} onOpenChange={setShowAttachmentsModal}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Paperclip className="w-5 h-5 text-primary" />
                            Anlagen auswählen
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto py-4">
                        {documentTypeId && (
                            <AttachmentSelector
                                documentTypeId={documentTypeId}
                                selectedIds={selectedAttachmentIds}
                                onSelectionChange={(ids) => {
                                    const currentIds = [...selectedAttachmentIds];
                                    const addedIds = ids.filter(id => !currentIds.includes(id));
                                    const removedIds = currentIds.filter(id => !ids.includes(id));
                                    for (const id of addedIds) actions.toggleAttachment(id);
                                    for (const id of removedIds) actions.toggleAttachment(id);
                                }}
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default LeftControlPanel;
