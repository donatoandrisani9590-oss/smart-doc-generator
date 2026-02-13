/**
 * SplitScreenEditor - Haupt-Container für den Split-Screen Document Editor
 *
 * Layout nach UX-Audit optimiert (30/70 Split):
 * - Linke Seite (320px): Formularfelder, Textbausteine-Link, Anlagen-Link, Export-Buttons
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
        <div className="h-[calc(100vh-64px)] w-full overflow-hidden flex flex-col lg:flex-row">
            {/* Linke Seite: Steuerung - full-width auf mobil, fixed-width auf Desktop */}
            <div
                className="w-full lg:w-[320px] lg:min-w-[280px] lg:max-w-[360px] bg-background border-b lg:border-b-0 lg:border-r overflow-hidden flex-shrink-0 max-h-[50vh] lg:max-h-none"
            >
                <LeftControlPanel documentTypes={documentTypes} />
            </div>

            {/* Rechte Seite: Editor - nimmt restlichen Platz */}
            <div className="flex-1 bg-muted/20 overflow-hidden min-w-0 min-h-0">
                <RightEditorPanel />
            </div>

            {/* Kommentar-Seitenleiste (Apple Pages Style) */}
            {showCommentSidebar && (
                <div
                    className="w-full lg:w-[280px] bg-background border-t lg:border-t-0 lg:border-l overflow-hidden flex-shrink-0 max-h-[40vh] lg:max-h-none"
                >
                    <CommentSidebar />
                </div>
            )}
        </div>
    );
};

export default SplitScreenEditor;
