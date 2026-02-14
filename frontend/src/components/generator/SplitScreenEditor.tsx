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

import { useState } from "react";
import { FileText, Eye } from "lucide-react";
import { LeftControlPanel } from "./panels/LeftControlPanel";
import { RightEditorPanel } from "./editor/RightEditorPanel";
import { CommentSidebar } from "./comments/CommentSidebar";
import { useWizardContext } from "./WizardContext";

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
    const { state } = useWizardContext();
    const { showCommentSidebar } = state;

    // Mobile tab state: "form" oder "preview"
    const [mobileTab, setMobileTab] = useState<"form" | "preview">("form");

    return (
        <div className="h-[calc(100vh-64px)] w-full overflow-hidden flex flex-col lg:flex-row">
            {/* Mobile Tab-Switcher - nur auf kleinen Screens */}
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

            {/* Linke Seite: Steuerung - mobile: toggle via tab, desktop: always visible */}
            <div
                className={`w-full lg:w-[320px] lg:min-w-[280px] lg:max-w-[360px] bg-background lg:border-r overflow-hidden flex-shrink-0 lg:block ${
                    mobileTab === "form" ? "flex-1" : "hidden"
                } lg:flex-initial lg:max-h-none`}
            >
                <LeftControlPanel documentTypes={documentTypes} />
            </div>

            {/* Rechte Seite: Editor - mobile: toggle via tab, desktop: always visible */}
            <div
                className={`flex-1 bg-muted/20 overflow-hidden min-w-0 min-h-0 lg:block ${
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
        </div>
    );
};

export default SplitScreenEditor;
