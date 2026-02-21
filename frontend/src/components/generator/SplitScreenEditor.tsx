/**
 * SplitScreenEditor - Haupt-Container für den Split-Screen Document Editor
 *
 * Layout nach UX-Audit optimiert (30/70 Split):
 * - Linke Seite (320px): Formularfelder, Textbausteine-Link, Anlagen-Link, Export-Buttons
 * - Rechte Seite (flex): Live WYSIWYG Editor (TinyMCE) - mehr Platz für Dokument
 * - Optional: Kommentar-Seitenleiste (280px)
 *
 * v6.0: Mobile Tab-Umschaltung zwischen Formular und Vorschau
 */

import { useState, useMemo } from "react";
import { FileText, Eye, XOctagon } from "lucide-react";
import { LeftControlPanel } from "./panels/LeftControlPanel";
import { RightEditorPanel } from "./editor/RightEditorPanel";
import { CommentSidebar } from "./comments/CommentSidebar";
import { ChatAssistent } from "@/components/chat/ChatAssistent";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";
import { useWizardContext } from "./WizardContext";
import { useCountry } from "@/hooks/useCountry";
import { useDocumentProjectStore } from "@/store/documentProjectStore";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";


interface DocumentType {
    id: number;
    name: string;
    country_code?: string;
    category?: string;
}

interface SplitScreenEditorProps {
    documentTypes: DocumentType[];
}

export const SplitScreenEditor = ({ documentTypes }: SplitScreenEditorProps) => {
    const { state, actions } = useWizardContext();
    const { showCommentSidebar, showChatSidebar } = state;
    const { country } = useCountry();
    const { abortProject } = useDocumentProjectStore();

    const handleAbort = () => {
        abortProject();
        window.location.href = "/"; // Force reset all context state unmounting WizardProvider safely
    };

    // Mobile tab state: "form" oder "preview"
    const [mobileTab, setMobileTab] = useState<"form" | "preview">("form");

    // Cancel dialog state — shared between desktop breadcrumb button and mobile tab bar
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

    // Breadcrumb: Dashboard > Neues Dokument > [Dokumenttyp] > [Mitarbeitername]
    const breadcrumbItems = useMemo<BreadcrumbItem[]>(() => {
        const items: BreadcrumbItem[] = [
            { label: "Neues Dokument", href: "/generate" },
        ];

        // Dokumenttyp-Name aus der Liste ableiten
        if (state.documentTypeId) {
            const docType = documentTypes.find(dt => dt.id === state.documentTypeId);
            if (docType) {
                items.push({ label: docType.name });
            }
        }

        // Mitarbeitername aus Formulardaten
        const vorname = state.formData.vorname?.trim();
        const nachname = state.formData.nachname?.trim();
        if (vorname || nachname) {
            items.push({ label: [vorname, nachname].filter(Boolean).join(" ") });
        }

        return items;
    }, [state.documentTypeId, state.formData.vorname, state.formData.nachname, documentTypes]);

    return (
        <div className="h-[calc(100vh-64px)] w-full overflow-hidden flex flex-col">
            {/* Breadcrumb-Navigation — Desktop only */}
            <div className="hidden lg:flex items-center justify-between flex-shrink-0 px-4 py-2 border-b bg-background/80 backdrop-blur-sm">
                <Breadcrumb items={breadcrumbItems} />
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
                    onClick={() => setCancelDialogOpen(true)}
                >
                    <XOctagon className="w-4 h-4" />
                    Projekt abbrechen
                </Button>
            </div>

            {/* Cancel confirmation dialog — shared between desktop + mobile triggers */}
            <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Projekt wirklich abbrechen?</DialogTitle>
                        <DialogDescription>
                            Alle bisherigen Eingaben und der aktuelle Fortschritt gehen verloren. Diese Aktion kann nicht rückgängig gemacht werden.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Zurück</Button>
                        </DialogClose>
                        <Button variant="destructive" onClick={handleAbort}>
                            Ja, unwiderruflich abbrechen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Mobile Tab-Switcher — nur auf kleinen Screens */}
            <div className="flex lg:hidden border-b bg-background flex-shrink-0">
                <button
                    onClick={() => setMobileTab("form")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${mobileTab === "form"
                        ? "text-primary border-b-2 border-primary bg-primary/5"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    <FileText className="w-4 h-4" />
                    Formular
                </button>
                <button
                    onClick={() => setMobileTab("preview")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${mobileTab === "preview"
                        ? "text-primary border-b-2 border-primary bg-primary/5"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    <Eye className="w-4 h-4" />
                    Vorschau
                </button>
                {/* Mobile Cancel — compact destructive icon-button */}
                <button
                    onClick={() => setCancelDialogOpen(true)}
                    className="px-4 flex items-center justify-center text-destructive/70 hover:text-destructive transition-colors border-l border-border/40"
                    title="Projekt abbrechen"
                >
                    <XOctagon className="w-4 h-4" />
                </button>
            </div>

            {/* Content-Area: Split-Screen Layout */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
                {/* Linke Seite: Glass Panel Steuerung */}
                <div
                    className={`w-full lg:w-[360px] lg:min-w-[360px] lg:max-w-[360px] glass-panel overflow-hidden flex-shrink-0 lg:block ${mobileTab === "form" ? "flex-1" : "hidden"
                        } lg:flex-initial lg:max-h-none`}
                >
                    <LeftControlPanel documentTypes={documentTypes} />
                </div>

                {/* Rechte Seite: Editor */}
                <div
                    className={`flex-1 canvas-desk overflow-hidden min-w-0 min-h-0 lg:block ${mobileTab === "preview" ? "block" : "hidden lg:block"
                        }`}
                >
                    <RightEditorPanel />
                </div>

                {/* Kommentar-Seitenleiste (Apple Pages Style) */}
                {showCommentSidebar && (
                    <div
                        className={`w-full lg:w-[280px] bg-background border-t lg:border-t-0 lg:border-l overflow-hidden flex-shrink-0 max-h-[40vh] lg:max-h-none ${mobileTab === "preview" ? "block" : "hidden lg:block"
                            }`}
                    >
                        <CommentSidebar />
                    </div>
                )}

                {/* Chat-Assistent Seitenleiste */}
                {showChatSidebar && (
                    <div
                        className={`w-full lg:w-[340px] bg-background border-t lg:border-t-0 lg:border-l overflow-hidden flex-shrink-0 max-h-[40vh] lg:max-h-none ${mobileTab === "preview" ? "block" : "hidden lg:block"
                            }`}
                    >
                        <ChatAssistent
                            countryCode={country}
                            context={{
                                documentTitle: state.documentTitle,
                                documentTypeId: state.documentTypeId,
                                formData: state.formData,
                            }}
                            onInsertText={(text) => {
                                actions.setEditorContent(
                                    state.editorContent + text,
                                    true
                                );
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default SplitScreenEditor;
