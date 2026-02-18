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
import { FileText, Eye } from "lucide-react";
import { LeftControlPanel } from "./panels/LeftControlPanel";
import { RightEditorPanel } from "./editor/RightEditorPanel";
import { CommentSidebar } from "./comments/CommentSidebar";
import { ChatAssistent } from "@/components/chat/ChatAssistent";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";
import { useWizardContext } from "./WizardContext";
import { useCountry } from "@/hooks/useCountry";

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

    // Mobile tab state: "form" oder "preview"
    const [mobileTab, setMobileTab] = useState<"form" | "preview">("form");

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
            <div className="hidden lg:flex items-center flex-shrink-0 px-4 py-2 border-b bg-background/80 backdrop-blur-sm">
                <Breadcrumb items={breadcrumbItems} />
            </div>

            {/* Mobile Tab-Switcher — nur auf kleinen Screens */}
            <div className="flex lg:hidden border-b bg-background flex-shrink-0">
                <button
                    onClick={() => setMobileTab("form")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                        mobileTab === "form"
                            ? "text-primary border-b-2 border-primary bg-primary/5"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <FileText className="w-4 h-4" />
                    Formular
                </button>
                <button
                    onClick={() => setMobileTab("preview")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                        mobileTab === "preview"
                            ? "text-primary border-b-2 border-primary bg-primary/5"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <Eye className="w-4 h-4" />
                    Vorschau
                </button>
            </div>

            {/* Content-Area: Split-Screen Layout */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
                {/* Linke Seite: Steuerung */}
                <div
                    className={`w-full lg:w-[340px] xl:w-[380px] lg:min-w-[300px] lg:max-w-[420px] bg-background lg:border-r lg:border-border/40 overflow-hidden flex-shrink-0 lg:block ${
                        mobileTab === "form" ? "flex-1" : "hidden"
                    } lg:flex-initial lg:max-h-none`}
                >
                    <LeftControlPanel documentTypes={documentTypes} />
                </div>

                {/* Rechte Seite: Editor */}
                <div
                    className={`flex-1 bg-muted/30 overflow-hidden min-w-0 min-h-0 lg:block ${
                        mobileTab === "preview" ? "block" : "hidden lg:block"
                    }`}
                >
                    <RightEditorPanel />
                </div>

                {/* Kommentar-Seitenleiste (Apple Pages Style) */}
                {showCommentSidebar && (
                    <div
                        className={`w-full lg:w-[280px] bg-background border-t lg:border-t-0 lg:border-l overflow-hidden flex-shrink-0 max-h-[40vh] lg:max-h-none ${
                            mobileTab === "preview" ? "block" : "hidden lg:block"
                        }`}
                    >
                        <CommentSidebar />
                    </div>
                )}

                {/* Chat-Assistent Seitenleiste */}
                {showChatSidebar && (
                    <div
                        className={`w-full lg:w-[340px] bg-background border-t lg:border-t-0 lg:border-l overflow-hidden flex-shrink-0 max-h-[40vh] lg:max-h-none ${
                            mobileTab === "preview" ? "block" : "hidden lg:block"
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
