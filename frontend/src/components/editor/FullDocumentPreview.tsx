/**
 * FullDocumentPreview — wraps the TinyMCE editor (or read-only content)
 * with static header and footer zones from DesignSettings, creating a
 * complete A4 document view with company logo + address + footer.
 *
 * The header/footer zones are non-interactive (pointer-events-none) and
 * only the children (editor area) remain editable.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DocumentZones {
    logoUrl?: string | null;
    logoPosition?: "left" | "center" | "right";
    logoWidthCm?: string;
    companyName?: string;
    headerLines: (string | null | undefined)[];
    footerLines: (string | null | undefined)[];
    primaryColor?: string;
}

interface FullDocumentPreviewProps {
    zones: DocumentZones;
    children: ReactNode;
    className?: string;
    readOnly?: boolean;
}

export function FullDocumentPreview({ zones, children, className }: FullDocumentPreviewProps) {
    const hasHeader = zones.logoUrl || zones.headerLines.some(Boolean);
    const hasFooter = zones.footerLines.some(Boolean);

    return (
        <div
            className={cn(
                "mx-auto bg-[var(--canvas-paper)] rounded shadow-[var(--shadow-canvas-paper)] overflow-hidden",
                className
            )}
            style={{ maxWidth: "min(210mm, 100%)" }}
        >
            {/* Header Zone — not editable */}
            {hasHeader && (
                <div className="px-[25mm] pt-[15mm] pb-[5mm] border-b border-warm-100 select-none pointer-events-none">
                    <div className={cn(
                        "flex items-start gap-4",
                        zones.logoPosition === "right" && "flex-row-reverse",
                        zones.logoPosition === "center" && "flex-col items-center"
                    )}>
                        {zones.logoUrl ? (
                            <img
                                src={zones.logoUrl}
                                alt="Firmenlogo"
                                className="object-contain"
                                style={{
                                    width: `${zones.logoWidthCm || "5"}cm`,
                                    maxHeight: "2.5cm",
                                }}
                            />
                        ) : (
                            <div className="logo-skeleton" aria-label="Logo-Platzhalter">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                     strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                                     className="text-muted-foreground/30">
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <circle cx="9" cy="9" r="2" />
                                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                                </svg>
                            </div>
                        )}
                        <div className={cn(
                            "flex-1 text-xs text-muted-foreground/60 leading-relaxed",
                            zones.logoPosition === "center" && "text-center"
                        )}>
                            {zones.companyName && (
                                <p
                                    className="font-semibold text-sm"
                                    style={{ color: zones.primaryColor || "#243186" }}
                                >
                                    {zones.companyName}
                                </p>
                            )}
                            {zones.headerLines.filter(Boolean).map((line, i) => (
                                <p key={i}>{line}</p>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Content Zone — TinyMCE editor or read-only HTML */}
            <div className="min-h-[200mm]">
                {children}
            </div>

            {/* Footer Zone — not editable */}
            {hasFooter && (
                <div className="px-[25mm] py-[10mm] border-t border-warm-100 select-none pointer-events-none">
                    <div className="text-[9px] text-muted-foreground/40 leading-relaxed text-center space-y-0.5">
                        {zones.footerLines.filter(Boolean).map((line, i) => (
                            <p key={i}>{line}</p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
