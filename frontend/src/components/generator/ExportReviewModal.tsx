/**
 * ExportReviewModal - Zusammenfassung aller Dokumentdaten vor dem Export
 *
 * Zeigt eine kompakte Übersicht aller eingegebenen Daten,
 * bevor der User den Export bestätigt:
 * - Mitarbeiterdaten
 * - Vertragsdaten
 * - Zusatzleistungen (nur aktive)
 * - Unterzeichner
 *
 * UX-Audit Paket 7: Letzte Prüfung vor irreversiblem Export
 */

import { useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    FileText,
    FileType2,
    User,
    Briefcase,
    Gift,
    PenTool,
    Loader2,
    CheckCircle2,
    AlertTriangle,
} from "lucide-react";
import type { FormData } from "./WizardContext";

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

interface ExportReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isExporting: boolean;
    exportFormat: "pdf" | "docx";
    documentTitle: string;
    formData: FormData;
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/** Formatiert einen Geldwert */
const formatCurrency = (value: string): string => {
    const num = parseFloat(value);
    if (isNaN(num)) return value || "—";
    return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
    }).format(num);
};

/** Zeigt einen Datenwert an (oder "—" wenn leer) */
const DataValue = ({ value, format }: { value: string | boolean; format?: "currency" | "date" }) => {
    if (typeof value === "boolean") {
        return value ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
        ) : null;
    }

    if (!value) return <span className="text-muted-foreground/40">—</span>;

    if (format === "currency") {
        return <span>{formatCurrency(value)}</span>;
    }

    if (format === "date" && value) {
        let formattedDate = value;
        try {
            formattedDate = new Intl.DateTimeFormat("de-DE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
            }).format(new Date(value));
        } catch {
            // Fall back to raw value if date parsing fails
        }
        return <span>{formattedDate}</span>;
    }

    return <span>{value}</span>;
};

/** Einzelne Datenzeile */
const DataRow = ({
    label,
    value,
    format,
}: {
    label: string;
    value: string | boolean;
    format?: "currency" | "date";
}) => {
    // Verberge leere Zeilen bei Zusatzleistungen-Checkboxen
    if (typeof value === "boolean" && !value) return null;

    return (
        <div className="flex items-center justify-between py-1 text-sm">
            <span className="text-muted-foreground text-xs">{label}</span>
            <span className="font-medium text-xs text-right max-w-[55%] truncate">
                <DataValue value={value} format={format} />
            </span>
        </div>
    );
};

/** Sektion mit Icon + Titel */
const Section = ({
    icon: Icon,
    title,
    children,
}: {
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
}) => (
    <div>
        <div className="flex items-center gap-2 mb-1.5">
            <Icon className="w-3.5 h-3.5 text-primary" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {title}
            </h4>
        </div>
        <div className="pl-5.5 space-y-0">{children}</div>
    </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export const ExportReviewModal = ({
    isOpen,
    onClose,
    onConfirm,
    isExporting,
    exportFormat,
    documentTitle,
    formData,
}: ExportReviewModalProps) => {
    const FormatIcon = exportFormat === "pdf" ? FileText : FileType2;
    const formatLabel = exportFormat.toUpperCase();
    const formatColor = exportFormat === "pdf" ? "text-red-500" : "text-blue-500";

    // Zähle aktive Zusatzleistungen
    const activeBenefits = useMemo(() => {
        const benefits: Array<{ label: string; active: boolean }> = [
            { label: "13. Gehalt", active: formData.jahressonderzahlung },
            { label: "Firmenwagen", active: formData.firmenwagen },
            { label: "Home Office", active: formData.homeoffice },
            { label: "Schichtzuschläge", active: formData.schichtzuschlaege },
            { label: "Arbeitszeitkonto", active: formData.arbeitszeitkonto },
            { label: "Vertragsstrafe", active: formData.vertragsstrafe },
        ];
        return benefits.filter((b) => b.active);
    }, [formData]);

    // Prüfe ob Adresse vollständig ist
    const hasAddress = formData.strasse || formData.plz || formData.ort;
    const addressLine = [formData.strasse, [formData.plz, formData.ort].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ");

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && !isExporting && onClose()}>
            <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <FormatIcon className={`w-5 h-5 ${formatColor}`} />
                        Export-Zusammenfassung
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Bitte überprüfen Sie die Daten vor dem {formatLabel}-Export.
                    </DialogDescription>
                </DialogHeader>

                {/* Dokumenttitel */}
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
                    <FormatIcon className={`w-4 h-4 ${formatColor} shrink-0`} />
                    <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{documentTitle || "Unbenannt"}</p>
                        <p className="text-xs text-muted-foreground">
                            Wird als {formatLabel} exportiert
                        </p>
                    </div>
                    <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
                        {formatLabel}
                    </Badge>
                </div>

                <div className="space-y-3">
                    {/* Mitarbeiterdaten */}
                    <Section icon={User} title="Mitarbeiterdaten">
                        <DataRow label="Name" value={[formData.vorname, formData.nachname].filter(Boolean).join(" ")} />
                        {hasAddress && <DataRow label="Adresse" value={addressLine} />}
                        {formData.geburtsdatum && (
                            <DataRow label="Geburtsdatum" value={formData.geburtsdatum} format="date" />
                        )}
                    </Section>

                    <Separator />

                    {/* Vertragsdaten */}
                    <Section icon={Briefcase} title="Vertragsdaten">
                        <DataRow label="Position" value={formData.position} />
                        <DataRow label="Gehalt" value={formData.gehalt} format="currency" />
                        <DataRow label="Eintrittsdatum" value={formData.eintrittsdatum} format="date" />
                        <DataRow label="Wochenstunden" value={formData.wochenstunden ? `${formData.wochenstunden} Std` : ""} />
                        <DataRow label="Urlaubstage" value={formData.urlaubstage ? `${formData.urlaubstage} Tage` : ""} />
                        <DataRow label="Probezeit" value={formData.probezeit} />
                        {formData.entgeltgruppe && (
                            <DataRow label="Entgeltgruppe" value={formData.entgeltgruppe} />
                        )}
                        <DataRow label="Kündigungsfrist" value={formData.kuendigungsfrist} />
                        <DataRow label="AU-Bescheinigung" value={formData.au_frist} />
                    </Section>

                    {/* Zusatzleistungen (nur wenn mindestens eine aktiv) */}
                    {(activeBenefits.length > 0 || formData.urlaubsgeld_pro_tag || formData.vwl_betrag) && (
                        <>
                            <Separator />
                            <Section icon={Gift} title="Zusatzleistungen">
                                {activeBenefits.length > 0 && (
                                    <div className="flex flex-wrap gap-1 py-1">
                                        {activeBenefits.map((b) => (
                                            <Badge
                                                key={b.label}
                                                variant="secondary"
                                                className="text-[10px] font-normal"
                                            >
                                                {b.label}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                                {formData.urlaubsgeld_pro_tag && (
                                    <DataRow label="Urlaubsgeld" value={`${formData.urlaubsgeld_pro_tag} €/Tag`} />
                                )}
                                {formData.vwl_betrag && (
                                    <DataRow label="VWL" value={`${formData.vwl_betrag} €/Monat`} />
                                )}
                            </Section>
                        </>
                    )}

                    <Separator />

                    {/* Unterzeichner */}
                    <Section icon={PenTool} title="Unterzeichner">
                        <DataRow label="Name" value={formData.signatory_name} />
                    </Section>
                </div>

                {/* Hinweis */}
                <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                        Nach dem Export wird das Dokument unter <strong>Meine Dokumente</strong> gespeichert.
                        Bitte überprüfen Sie die Daten sorgfältig.
                    </p>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isExporting}
                        className="sm:flex-1"
                    >
                        Zurück
                    </Button>
                    <Button
                        variant="default"
                        onClick={onConfirm}
                        disabled={isExporting}
                        className="sm:flex-1 gap-2"
                    >
                        {isExporting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <FormatIcon className={`w-4 h-4`} />
                        )}
                        {isExporting ? `Exportiert ${formatLabel}…` : `Als ${formatLabel} exportieren`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ExportReviewModal;
