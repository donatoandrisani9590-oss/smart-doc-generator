/**
 * StationeryCanvas - Wrapper für den TinyMCE Editor mit Briefpapier-Zonen
 *
 * Rendert Header/Footer-Zonen aus dem ausgewählten Blanko-Template
 * um den editierbaren Dokumentinhalt herum. Die Zonen sind gesperrt
 * und nur in den Einstellungen änderbar.
 */

import { DocumentEditor } from "@/components/editor/DocumentEditor";
import type { Editor as TinyMCEEditor } from "tinymce";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider,
} from "@/components/ui/tooltip";

interface StationeryZones {
    headerImages: Array<{ data: string; filename: string }>;
    footerImages: Array<{ data: string; filename: string }>;
    headerText: string;
    footerText: string;
    pageMargins: { top: number; bottom: number; left: number; right: number };
}

interface StationeryCanvasProps {
    zones: StationeryZones;
    value: string;
    onChange: (html: string) => void;
    onUserEdit?: (html: string) => void;
    isLoading?: boolean;
    onEditorInit?: (editor: TinyMCEEditor) => void;
}

export const StationeryCanvas = ({
    zones,
    value,
    onChange,
    onUserEdit,
    isLoading,
    onEditorInit,
}: StationeryCanvasProps) => {
    // Defensive: Ensure arrays exist even if API returns malformed data
    const headerImages = Array.isArray(zones.headerImages) ? zones.headerImages : [];
    const footerImages = Array.isArray(zones.footerImages) ? zones.footerImages : [];

    return (
        <div className="bg-[var(--canvas-paper)] rounded shadow-[var(--shadow-canvas-paper)]">
            {/* Header Zone - Gesperrt, aus Blanko-Vorlage */}
            {(headerImages.length > 0 || zones.headerText) && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div
                                className="relative border-b border-warm-100 pointer-events-none select-none"
                                style={{
                                    padding: `${zones.pageMargins.top * 10}px ${zones.pageMargins.right * 10}px 12px ${zones.pageMargins.left * 10}px`,
                                }}
                            >
                                <div className="opacity-85 transition-opacity hover:opacity-100">
                                    {headerImages.map((img, i) => (
                                        <img
                                            key={i}
                                            src={img.data}
                                            alt="Briefpapier-Header"
                                            className="max-h-24 object-contain"
                                        />
                                    ))}
                                    {zones.headerText && (
                                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                                            {zones.headerText}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Briefpapier-Element — in Einstellungen änderbar</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}

            {/* Editierbarer Inhaltsbereich - TinyMCE Editor */}
            <DocumentEditor
                value={value}
                onChange={onChange}
                onUserEdit={onUserEdit}
                onEditorInit={onEditorInit}
                isLoading={isLoading}
                className="split-screen-editor"
                compact
            />

            {/* Footer Zone - Gesperrt, aus Blanko-Vorlage */}
            {(footerImages.length > 0 || zones.footerText) && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div
                                className="relative border-t border-warm-100 pointer-events-none select-none"
                                style={{
                                    padding: `12px ${zones.pageMargins.right * 10}px ${zones.pageMargins.bottom * 10}px ${zones.pageMargins.left * 10}px`,
                                }}
                            >
                                <div className="opacity-85 transition-opacity hover:opacity-100">
                                    {footerImages.map((img, i) => (
                                        <img
                                            key={i}
                                            src={img.data}
                                            alt="Briefpapier-Footer"
                                            className="max-h-16 object-contain"
                                        />
                                    ))}
                                    {zones.footerText && (
                                        <p className="text-xs text-muted-foreground whitespace-pre-line text-center">
                                            {zones.footerText}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Briefpapier-Element — in Einstellungen änderbar</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    );
};

export default StationeryCanvas;
