/**
 * SplitScreenEditor - Haupt-Container für den Split-Screen Document Editor
 *
 * Layout wie Microsoft Word / Apple Pages:
 * - Linke Seite (350px min): Formularfelder, Klauseln, Anlagen, Export-Buttons
 * - Rechte Seite (flex): Live WYSIWYG Editor (TinyMCE)
 * - Optional: Kommentar-Seitenleiste (280px)
 *
 * Verwendet CSS Grid für stabiles Layout.
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
            {/* Linke Seite: Steuerung - feste Mindestbreite */}
            <div
                className="bg-background border-r overflow-hidden flex-shrink-0"
                style={{ width: "380px", minWidth: "320px", maxWidth: "450px" }}
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
