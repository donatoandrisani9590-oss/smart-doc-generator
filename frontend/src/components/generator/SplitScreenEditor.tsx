/**
 * SplitScreenEditor - Haupt-Container für den Split-Screen Document Editor
 *
 * Layout nach UX-Audit optimiert (30/70 Split):
 * - Linke Seite (320px): Formularfelder, Klauseln-Link, Anlagen-Link, Export-Buttons
 * - Rechte Seite (flex): Live WYSIWYG Editor (TinyMCE) - mehr Platz für Dokument
 * - Optional: Kommentar-Seitenleiste (280px)
 *
 * v5.0: Schmaleres Control Panel für mehr Editor-Fläche
 */

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

    return (
        <div className="h-[calc(100vh-64px)] w-full overflow-hidden flex">
            {/* Linke Seite: Steuerung - kompakter (30% statt 40%) */}
            <div
                className="bg-background border-r overflow-hidden flex-shrink-0"
                style={{ width: "320px", minWidth: "280px", maxWidth: "360px" }}
            >
                <LeftControlPanel documentTypes={documentTypes} />
            </div>

            {/* Rechte Seite: Editor - nimmt restlichen Platz */}
            <div className="flex-1 bg-muted/20 overflow-hidden min-w-0">
                <RightEditorPanel />
            </div>

            {/* Kommentar-Seitenleiste (Apple Pages Style) */}
            {showCommentSidebar && (
                <div
                    className="bg-background border-l overflow-hidden flex-shrink-0"
                    style={{ width: "280px" }}
                >
                    <CommentSidebar />
                </div>
            )}
        </div>
    );
};

export default SplitScreenEditor;
