/**
 * FormFieldsSection - Formularfelder für den Split-Screen Editor
 *
 * Zeigt alle Eingabefelder für Mitarbeiter- und Vertragsdaten
 * in einer kompakten, scrollbaren Ansicht.
 *
 * v4.2.1: Fortschrittsanzeige für Pflichtfelder
 * v4.2.2: i18n-Unterstützung für DE/IT Dokumenttypen
 */

import { useMemo, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Info, AlertCircle } from "lucide-react";
import { useWizardContext } from "../WizardContext";

// ══════════════════════════════════════════════════════════════════════════════
// KONTEXTUELLE HILFETEXTE (PACTA-inspiriert)
// Juristisch relevante Felder erhalten Erklärungen + Beispiele
// ══════════════════════════════════════════════════════════════════════════════

const FIELD_HINTS: Record<string, { de: string; it: string }> = {
    probezeit: {
        de: "Maximal 6 Monate zulässig (§ 622 Abs. 3 BGB). Während der Probezeit gilt eine verkürzte Kündigungsfrist von 2 Wochen.",
        it: "Massimo 6 mesi consentiti (§ 622 comma 3 BGB). Durante il periodo di prova si applica un preavviso ridotto di 2 settimane.",
    },
    kuendigungsfrist: {
        de: "Gesetzliches Minimum: 4 Wochen zum 15. oder Monatsende (§ 622 BGB). Die Frist verlängert sich mit der Betriebszugehörigkeit.",
        it: "Minimo legale: 4 settimane al 15 o a fine mese (§ 622 BGB). Il termine si allunga con l'anzianità aziendale.",
    },
    gehalt: {
        de: "Bruttogehalt pro Monat. Beachten Sie den geltenden Mindestlohn (2025: 12,82 €/h) und eventuelle Tarifverträge.",
        it: "Retribuzione lorda mensile. Rispettare il salario minimo vigente (2025: 12,82 €/h) e eventuali contratti collettivi.",
    },
    wochenstunden: {
        de: "Reguläre Arbeitszeit. Vollzeit i.d.R. 35–40 Std. Teilzeit unter 35 Std. Maximum 48 Std/Woche (§ 3 ArbZG).",
        it: "Orario di lavoro regolare. Tempo pieno: 35–40 ore. Part-time: sotto 35 ore. Massimo 48 ore/settimana (§ 3 ArbZG).",
    },
    urlaubstage: {
        de: "Gesetzliches Minimum: 20 Tage bei 5-Tage-Woche (§ 3 BUrlG). Branchenüblich sind 25–30 Tage.",
        it: "Minimo legale: 20 giorni con settimana di 5 giorni (§ 3 BUrlG). Standard di settore: 25–30 giorni.",
    },
    entgeltgruppe: {
        de: "Tarifliche Eingruppierung, z.B. E9 (TVöD), EG 5 (IG Metall). Nur relevant bei tarifgebundenen Unternehmen.",
        it: "Classificazione tariffaria, es. E9 (TVöD), EG 5 (IG Metall). Rilevante solo per aziende con contratto collettivo.",
    },
    au_frist: {
        de: "Ab wann muss eine Arbeitsunfähigkeitsbescheinigung vorgelegt werden? Gesetzlich ab dem 4. Tag, vertraglich oft ab dem 1. Tag.",
        it: "Da quando è necessario presentare un certificato medico? Per legge dal 4° giorno, contrattualmente spesso dal 1° giorno.",
    },
    vertragsstrafe: {
        de: "Darf maximal ein Bruttomonatsgehalt betragen. Nur bei schuldhafter Vertragsverletzung durchsetzbar.",
        it: "Non può superare uno stipendio lordo mensile. Applicabile solo in caso di violazione contrattuale colposa.",
    },
    vwl_betrag: {
        de: "Vermögenswirksame Leistungen: Arbeitgeberzuschuss zum Vermögensaufbau. Üblich sind 26,59 € bis 40 € monatlich.",
        it: "Prestazioni patrimoniali: contributo del datore per la formazione del patrimonio. Importo comune: 26,59 € – 40 € mensili.",
    },
    signatory_name: {
        de: "Name der vertretungsberechtigten Person (Geschäftsführer, Personalleiter oder Prokurist mit Vollmacht).",
        it: "Nome della persona autorizzata a firmare (amministratore delegato, responsabile del personale o procuratore con delega).",
    },
};

/**
 * FieldHint - Info-Icon mit Tooltip für kontextuelle Hilfetexte
 */
const FieldHint = ({ fieldKey, lang }: { fieldKey: string; lang: "de" | "it" }) => {
    const hint = FIELD_HINTS[fieldKey];
    if (!hint) return null;

    return (
        <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center justify-center w-3.5 h-3.5 ml-1 text-muted-foreground/50 hover:text-primary transition-colors rounded-full"
                    aria-label="Hilfe"
                    tabIndex={-1}
                >
                    <Info className="w-3 h-3" />
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
                {hint[lang]}
            </TooltipContent>
        </Tooltip>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// INLINE-FELD-VALIDIERUNG
// Fachliche Regeln werden nach onBlur angezeigt (touched-Tracking)
// ══════════════════════════════════════════════════════════════════════════════

type ValidationRule = {
    /** Prüft ob der Wert ungültig ist — gibt Fehlermeldung zurück oder null */
    validate: (value: string) => { de: string; it: string } | null;
};

const FIELD_VALIDATIONS: Record<string, ValidationRule> = {
    gehalt: {
        validate: (v) => {
            const num = parseFloat(v);
            if (v && !isNaN(num) && num < 0) {
                return {
                    de: "Gehalt darf nicht negativ sein.",
                    it: "La retribuzione non può essere negativa.",
                };
            }
            // Mindestlohn-Warnung: 12,82 €/h × 173,33 Std ≈ 2.222 €/Monat
            if (v && !isNaN(num) && num > 0 && num < 2222) {
                return {
                    de: "Liegt unter dem Mindestlohn (ca. 2.222 €/Monat bei Vollzeit).",
                    it: "Inferiore al salario minimo (ca. 2.222 €/mese a tempo pieno).",
                };
            }
            return null;
        },
    },
    wochenstunden: {
        validate: (v) => {
            const num = parseFloat(v);
            if (v && !isNaN(num) && num > 48) {
                return {
                    de: "Maximum 48 Std/Woche (§ 3 ArbZG).",
                    it: "Massimo 48 ore/settimana (§ 3 ArbZG).",
                };
            }
            if (v && !isNaN(num) && num < 1) {
                return {
                    de: "Wochenstunden müssen mindestens 1 betragen.",
                    it: "Le ore settimanali devono essere almeno 1.",
                };
            }
            return null;
        },
    },
    urlaubstage: {
        validate: (v) => {
            const num = parseInt(v, 10);
            if (v && !isNaN(num) && num < 20) {
                return {
                    de: "Gesetzliches Minimum: 20 Tage (§ 3 BUrlG).",
                    it: "Minimo legale: 20 giorni (§ 3 BUrlG).",
                };
            }
            if (v && !isNaN(num) && num > 45) {
                return {
                    de: "Ungewöhnlich hoch — bitte überprüfen.",
                    it: "Insolitamente alto — si prega di verificare.",
                };
            }
            return null;
        },
    },
    plz: {
        validate: (v) => {
            if (v && !/^\d{4,5}$/.test(v.trim())) {
                return {
                    de: "PLZ muss 4–5 Ziffern haben.",
                    it: "Il CAP deve avere 4–5 cifre.",
                };
            }
            return null;
        },
    },
};

/**
 * FieldError - Inline-Fehlermeldung unter dem Input
 */
const FieldError = ({ message }: { message: string }) => (
    <p className="flex items-center gap-1 text-[11px] text-destructive mt-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
        <AlertCircle className="w-3 h-3 shrink-0" />
        {message}
    </p>
);

// Definition der Pflichtfelder für die Fortschrittsanzeige
const REQUIRED_FIELDS = [
    "vorname",
    "nachname",
    "position",
    "gehalt",
    "eintrittsdatum",
    "signatory_name",
] as const;

// Übersetzungen für Formularfelder basierend auf Dokumentsprache
const FIELD_LABELS = {
    de: {
        section_employee: "Mitarbeiterdaten",
        section_contract: "Vertragsdaten",
        section_benefits: "Zusatzleistungen",
        section_signatory: "Unterzeichner",
        vorname: "Vorname",
        nachname: "Nachname",
        adresse: "Adresse",
        strasse_placeholder: "Straße und Hausnummer",
        plz: "PLZ",
        ort: "Ort",
        geburtsdatum: "Geburtsdatum",
        position: "Position",
        position_placeholder: "Berufsbezeichnung",
        gehalt: "Gehalt (EUR)",
        gehalt_placeholder: "Brutto pro Monat",
        eintrittsdatum: "Eintrittsdatum",
        wochenstunden: "Std/Woche",
        urlaubstage: "Urlaubstage",
        probezeit: "Probezeit",
        probezeit_placeholder: "Probezeit wählen",
        probezeit_none: "Keine",
        probezeit_3: "3 Monate",
        probezeit_6: "6 Monate",
        entgeltgruppe: "Entgeltgruppe",
        entgeltgruppe_placeholder: "z.B. P7, K5",
        kuendigungsfrist: "Kündigungsfrist",
        kuendigungsfrist_placeholder: "Frist wählen",
        kuendigungsfrist_4w: "4 Wochen zum 15./Monatsende",
        kuendigungsfrist_3m: "3 Monate zum Monatsende",
        kuendigungsfrist_622: "Gesetzlich nach § 622 BGB",
        au_frist: "AU-Bescheinigung ab",
        au_frist_placeholder: "Frist wählen",
        au_frist_1: "am ersten Kalendertag",
        au_frist_3: "am dritten Kalendertag",
        vertragsart: "Vertragsart",
        vertragsart_tarif: "Tarifgebunden",
        vertragsart_at: "AT-Angestellter",
        vertragsart_hint: "AT = Außertariflich (oberhalb der höchsten Tarifgruppe)",
        section_at: "AT-Optionen",
        zielbonus: "Zielbonus / Variable Vergütung",
        freistellung: "Freistellungsklausel (Garden Leave)",
        spesen: "Spesen & Reisekosten",
        renteneintritt: "Renteneintrittsklausel",
        gehalt_at: "Jahresgehalt (EUR)",
        gehalt_at_placeholder: "Brutto pro Jahr",
        jahressonderzahlung: "Jahressonderzahlung (13. Gehalt)",
        urlaubsgeld_pro_tag: "Urlaubsgeld (€/Tag)",
        urlaubsgeld_placeholder: "€ pro Urlaubstag",
        vwl_betrag: "VWL (€/Monat)",
        vwl_placeholder: "€ monatlich brutto",
        schichtzuschlaege: "Zuschläge (Nacht/Sonn-/Feiertag)",
        arbeitszeitkonto: "Arbeitszeitkonto",
        vertragsstrafe: "Vertragsstrafe",
        firmenwagen: "Firmenwagen",
        homeoffice: "Home Office",
        signatory_name: "Name (Arbeitgeber)",
        signatory_placeholder: "Unterzeichnende Person",
        progress_filled: "von",
        progress_suffix: "Pflichtfeldern ausgefüllt",
        required: "Pflichtfeld",
    },
    it: {
        section_employee: "Dati del Dipendente",
        section_contract: "Dati Contrattuali",
        section_benefits: "Benefit Aggiuntivi",
        section_signatory: "Firmatario",
        vorname: "Nome",
        nachname: "Cognome",
        adresse: "Indirizzo",
        strasse_placeholder: "Via e numero civico",
        plz: "CAP",
        ort: "Città",
        geburtsdatum: "Data di Nascita",
        position: "Posizione",
        position_placeholder: "Qualifica professionale",
        gehalt: "Retribuzione (EUR)",
        gehalt_placeholder: "Lordo mensile",
        eintrittsdatum: "Data di Inizio",
        wochenstunden: "Ore/Settimana",
        urlaubstage: "Giorni Ferie",
        probezeit: "Periodo di Prova",
        probezeit_placeholder: "Seleziona periodo",
        probezeit_none: "Nessuno",
        probezeit_3: "3 mesi",
        probezeit_6: "6 mesi",
        entgeltgruppe: "Gruppo Retributivo",
        entgeltgruppe_placeholder: "es. P7, K5",
        kuendigungsfrist: "Preavviso",
        kuendigungsfrist_placeholder: "Seleziona periodo",
        kuendigungsfrist_4w: "4 settimane al 15/fine mese",
        kuendigungsfrist_3m: "3 mesi a fine mese",
        kuendigungsfrist_622: "Legale secondo § 622 BGB",
        au_frist: "Certificato medico da",
        au_frist_placeholder: "Seleziona termine",
        au_frist_1: "dal primo giorno",
        au_frist_3: "dal terzo giorno",
        vertragsart: "Tipo di Contratto",
        vertragsart_tarif: "Con contratto collettivo",
        vertragsart_at: "Dirigente fuori contratto",
        vertragsart_hint: "AT = Fuori contratto collettivo (al di sopra del gruppo tariffario più alto)",
        section_at: "Opzioni AT",
        zielbonus: "Bonus obiettivo / Retribuzione variabile",
        freistellung: "Clausola di esonero (Garden Leave)",
        spesen: "Spese & Rimborsi viaggio",
        renteneintritt: "Clausola di pensionamento",
        gehalt_at: "Retribuzione Annua (EUR)",
        gehalt_at_placeholder: "Lordo annuo",
        jahressonderzahlung: "Tredicesima mensilità",
        urlaubsgeld_pro_tag: "Indennità ferie (€/giorno)",
        urlaubsgeld_placeholder: "€ per giorno di ferie",
        vwl_betrag: "VWL (€/mese)",
        vwl_placeholder: "€ mensile lordo",
        schichtzuschlaege: "Maggiorazioni (notte/festivi)",
        arbeitszeitkonto: "Conto ore",
        vertragsstrafe: "Penale contrattuale",
        firmenwagen: "Auto Aziendale",
        homeoffice: "Lavoro da Remoto",
        signatory_name: "Nome (Datore di Lavoro)",
        signatory_placeholder: "Persona firmataria",
        progress_filled: "di",
        progress_suffix: "campi obbligatori compilati",
        required: "Campo obbligatorio",
    },
} as const;

type LanguageCode = keyof typeof FIELD_LABELS;

interface FormFieldsSectionProps {
    countryCode?: string;
}

export const FormFieldsSection = ({ countryCode }: FormFieldsSectionProps = {}) => {
    const { state, actions } = useWizardContext();
    const { formData } = state;

    // Ermittle Sprache aus countryCode (IT → it, sonst de)
    const lang: LanguageCode = countryCode?.toUpperCase() === "IT" ? "it" : "de";
    const labels = FIELD_LABELS[lang];

    // ── Touched-Tracking für Inline-Validierung ─────────────────────────
    const [touched, setTouched] = useState<Set<string>>(new Set());

    const markTouched = useCallback((field: string) => {
        setTouched(prev => {
            if (prev.has(field)) return prev;
            const next = new Set(prev);
            next.add(field);
            return next;
        });
    }, []);

    /** Gibt Inline-Fehler für ein Feld zurück (nur wenn touched) */
    const getInlineError = useCallback((field: string, value: string): string | null => {
        if (!touched.has(field)) return null;

        // 1. Pflichtfeld-Prüfung
        if (REQUIRED_FIELDS.includes(field as typeof REQUIRED_FIELDS[number]) && !value.trim()) {
            return lang === "de" ? "Pflichtfeld" : "Campo obbligatorio";
        }

        // 2. Fachliche Validierung
        const rule = FIELD_VALIDATIONS[field];
        if (rule) {
            const result = rule.validate(value);
            if (result) return result[lang];
        }

        return null;
    }, [touched, lang]);

    /** CSS-Klasse für ein validiertes Input-Feld */
    const fieldClass = useCallback((field: string, value: string, extra?: string): string => {
        const error = getInlineError(field, value);
        const baseClass = "h-8 text-sm";
        const errorClass = error ? "border-red-500 focus-visible:ring-red-500/30" : "";
        return [baseClass, errorClass, extra].filter(Boolean).join(" ");
    }, [getInlineError]);

    // Berechne ausgefüllte Pflichtfelder (inkl. Dokumenttitel für konsistente Zählung)
    const requiredFieldsProgress = useMemo(() => {
        const filledFormFields = REQUIRED_FIELDS.filter((field) => {
            const value = formData[field];
            return value !== undefined && value !== null && value !== "";
        }).length;
        const titleFilled = state.documentTitle?.trim() ? 1 : 0;
        const filled = filledFormFields + titleFilled;
        const total = REQUIRED_FIELDS.length + 1; // +1 für Dokumenttitel
        const percentage = Math.round((filled / total) * 100);
        return { filled, total, percentage };
    }, [formData, state.documentTitle]);

    return (
        <TooltipProvider>
        <div className="space-y-5 px-0.5">
            {/* Fortschrittsanzeige für Pflichtfelder */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground/60 pb-3">
                <span>
                    {requiredFieldsProgress.filled} {labels.progress_filled} {requiredFieldsProgress.total} {labels.progress_suffix}
                </span>
                <span>
                    <span className="text-foreground/30">*</span> = {labels.required}
                </span>
            </div>

            {/* Mitarbeiterdaten */}
            <div className="space-y-3">
                <h4 className="text-[11px] font-medium text-foreground/40 tracking-wide">
                    {labels.section_employee}
                </h4>

                <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                        <Label htmlFor="vorname" className="text-xs">
                            {labels.vorname} <span className="text-destructive/70">*</span>
                        </Label>
                        <Input
                            id="vorname"
                            value={formData.vorname}
                            onChange={(e) => actions.updateFormField("vorname", e.target.value)}
                            onBlur={() => markTouched("vorname")}
                            className={fieldClass("vorname", formData.vorname)}
                        />
                        {getInlineError("vorname", formData.vorname) && (
                            <FieldError message={getInlineError("vorname", formData.vorname)!} />
                        )}
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="nachname" className="text-xs">
                            {labels.nachname} <span className="text-destructive/70">*</span>
                        </Label>
                        <Input
                            id="nachname"
                            value={formData.nachname}
                            onChange={(e) => actions.updateFormField("nachname", e.target.value)}
                            onBlur={() => markTouched("nachname")}
                            className={fieldClass("nachname", formData.nachname)}
                        />
                        {getInlineError("nachname", formData.nachname) && (
                            <FieldError message={getInlineError("nachname", formData.nachname)!} />
                        )}
                    </div>
                </div>

                <div className="space-y-1">
                    <Label htmlFor="strasse" className="text-xs">{labels.adresse}</Label>
                    <Input
                        id="strasse"
                        value={formData.strasse}
                        onChange={(e) => actions.updateFormField("strasse", e.target.value)}
                        placeholder={labels.strasse_placeholder}
                        className="h-8 text-sm"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                        <Label htmlFor="plz" className="text-xs">{labels.plz}</Label>
                        <Input
                            id="plz"
                            value={formData.plz}
                            onChange={(e) => actions.updateFormField("plz", e.target.value)}
                            onBlur={() => markTouched("plz")}
                            className={fieldClass("plz", formData.plz)}
                        />
                        {getInlineError("plz", formData.plz) && (
                            <FieldError message={getInlineError("plz", formData.plz)!} />
                        )}
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="ort" className="text-xs">{labels.ort}</Label>
                        <Input
                            id="ort"
                            value={formData.ort}
                            onChange={(e) => actions.updateFormField("ort", e.target.value)}
                            className="h-8 text-sm"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <Label htmlFor="geburtsdatum" className="text-xs">{labels.geburtsdatum}</Label>
                    <Input
                        id="geburtsdatum"
                        type="date"
                        value={formData.geburtsdatum}
                        onChange={(e) => actions.updateFormField("geburtsdatum", e.target.value)}
                        className="h-8 text-sm"
                    />
                </div>
            </div>

            {/* Vertragsdaten */}
            <div className="space-y-3 pt-5 border-t border-border/30">
                <h4 className="text-[11px] font-medium text-foreground/40 tracking-wide">
                    {labels.section_contract}
                </h4>

                <div className="space-y-1">
                    <Label htmlFor="vertragsart" className="text-xs">
                        {labels.vertragsart}
                    </Label>
                    <Select
                        value={formData.vertragsart}
                        onValueChange={(v) => actions.updateFormField("vertragsart", v)}
                    >
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="tarifgebunden">{labels.vertragsart_tarif}</SelectItem>
                            <SelectItem value="at_angestellter">{labels.vertragsart_at}</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">{labels.vertragsart_hint}</p>
                </div>

                <div className="space-y-1">
                    <Label htmlFor="position" className="text-xs">
                        {labels.position} <span className="text-destructive/70">*</span>
                    </Label>
                    <Input
                        id="position"
                        value={formData.position}
                        onChange={(e) => actions.updateFormField("position", e.target.value)}
                        onBlur={() => markTouched("position")}
                        placeholder={labels.position_placeholder}
                        className={fieldClass("position", formData.position)}
                    />
                    {getInlineError("position", formData.position) && (
                        <FieldError message={getInlineError("position", formData.position)!} />
                    )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                        <Label htmlFor="gehalt" className="text-xs flex items-center">
                            {formData.vertragsart === "at_angestellter" ? labels.gehalt_at : labels.gehalt} <span className="text-destructive/70">*</span>
                            <FieldHint fieldKey="gehalt" lang={lang} />
                        </Label>
                        <Input
                            id="gehalt"
                            type="number"
                            value={formData.gehalt}
                            onChange={(e) => actions.updateFormField("gehalt", e.target.value)}
                            onBlur={() => markTouched("gehalt")}
                            placeholder={formData.vertragsart === "at_angestellter" ? labels.gehalt_at_placeholder : labels.gehalt_placeholder}
                            className={fieldClass("gehalt", formData.gehalt)}
                        />
                        {getInlineError("gehalt", formData.gehalt) && (
                            <FieldError message={getInlineError("gehalt", formData.gehalt)!} />
                        )}
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="eintrittsdatum" className="text-xs">
                            {labels.eintrittsdatum} <span className="text-destructive/70">*</span>
                        </Label>
                        <Input
                            id="eintrittsdatum"
                            type="date"
                            value={formData.eintrittsdatum}
                            onChange={(e) => actions.updateFormField("eintrittsdatum", e.target.value)}
                            onBlur={() => markTouched("eintrittsdatum")}
                            className={fieldClass("eintrittsdatum", formData.eintrittsdatum)}
                        />
                        {getInlineError("eintrittsdatum", formData.eintrittsdatum) && (
                            <FieldError message={getInlineError("eintrittsdatum", formData.eintrittsdatum)!} />
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                        <Label htmlFor="wochenstunden" className="text-xs flex items-center">
                            {labels.wochenstunden}
                            <FieldHint fieldKey="wochenstunden" lang={lang} />
                        </Label>
                        <Input
                            id="wochenstunden"
                            type="number"
                            value={formData.wochenstunden}
                            onChange={(e) => actions.updateFormField("wochenstunden", e.target.value)}
                            onBlur={() => markTouched("wochenstunden")}
                            className={fieldClass("wochenstunden", formData.wochenstunden)}
                        />
                        {getInlineError("wochenstunden", formData.wochenstunden) && (
                            <FieldError message={getInlineError("wochenstunden", formData.wochenstunden)!} />
                        )}
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="urlaubstage" className="text-xs flex items-center">
                            {labels.urlaubstage}
                            <FieldHint fieldKey="urlaubstage" lang={lang} />
                        </Label>
                        <Input
                            id="urlaubstage"
                            type="number"
                            value={formData.urlaubstage}
                            onChange={(e) => actions.updateFormField("urlaubstage", e.target.value)}
                            onBlur={() => markTouched("urlaubstage")}
                            className={fieldClass("urlaubstage", formData.urlaubstage)}
                        />
                        {getInlineError("urlaubstage", formData.urlaubstage) && (
                            <FieldError message={getInlineError("urlaubstage", formData.urlaubstage)!} />
                        )}
                    </div>
                </div>

                <div className="space-y-1">
                    <Label htmlFor="probezeit" className="text-xs flex items-center">
                        {labels.probezeit}
                        <FieldHint fieldKey="probezeit" lang={lang} />
                    </Label>
                    <Select
                        value={formData.probezeit}
                        onValueChange={(v) => actions.updateFormField("probezeit", v)}
                    >
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder={labels.probezeit_placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Keine">{labels.probezeit_none}</SelectItem>
                            <SelectItem value="3 Monate">{labels.probezeit_3}</SelectItem>
                            <SelectItem value="6 Monate">{labels.probezeit_6}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {formData.vertragsart !== "at_angestellter" && (
                    <div className="space-y-1">
                        <Label htmlFor="entgeltgruppe" className="text-xs flex items-center">
                            {labels.entgeltgruppe}
                            <FieldHint fieldKey="entgeltgruppe" lang={lang} />
                        </Label>
                        <Input
                            id="entgeltgruppe"
                            value={formData.entgeltgruppe}
                            onChange={(e) => actions.updateFormField("entgeltgruppe", e.target.value)}
                            placeholder={labels.entgeltgruppe_placeholder}
                            className="h-8 text-sm"
                        />
                    </div>
                )}

                <div className="space-y-1">
                    <Label htmlFor="kuendigungsfrist" className="text-xs flex items-center">
                        {labels.kuendigungsfrist}
                        <FieldHint fieldKey="kuendigungsfrist" lang={lang} />
                    </Label>
                    <Select
                        value={formData.kuendigungsfrist}
                        onValueChange={(v) => actions.updateFormField("kuendigungsfrist", v)}
                    >
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder={labels.kuendigungsfrist_placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="4 Wochen zum 15./Monatsende">{labels.kuendigungsfrist_4w}</SelectItem>
                            <SelectItem value="3 Monate zum Monatsende">{labels.kuendigungsfrist_3m}</SelectItem>
                            <SelectItem value="Gesetzlich nach § 622 BGB">{labels.kuendigungsfrist_622}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label htmlFor="au_frist" className="text-xs flex items-center">
                        {labels.au_frist}
                        <FieldHint fieldKey="au_frist" lang={lang} />
                    </Label>
                    <Select
                        value={formData.au_frist}
                        onValueChange={(v) => actions.updateFormField("au_frist", v)}
                    >
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder={labels.au_frist_placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="am ersten Kalendertag">{labels.au_frist_1}</SelectItem>
                            <SelectItem value="am dritten Kalendertag">{labels.au_frist_3}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Zusatzleistungen */}
            <div className="space-y-3 pt-5 border-t border-border/30">
                <h4 className="text-[11px] font-medium text-foreground/40 tracking-wide">
                    {labels.section_benefits}
                </h4>

                <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="jahressonderzahlung"
                            checked={formData.jahressonderzahlung}
                            onCheckedChange={(checked) =>
                                actions.updateFormField("jahressonderzahlung", checked === true)
                            }
                        />
                        <Label htmlFor="jahressonderzahlung" className="text-sm cursor-pointer">
                            {labels.jahressonderzahlung}
                        </Label>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                            <Label htmlFor="urlaubsgeld_pro_tag" className="text-xs">{labels.urlaubsgeld_pro_tag}</Label>
                            <Input
                                id="urlaubsgeld_pro_tag"
                                type="number"
                                value={formData.urlaubsgeld_pro_tag}
                                onChange={(e) => actions.updateFormField("urlaubsgeld_pro_tag", e.target.value)}
                                placeholder={labels.urlaubsgeld_placeholder}
                                className="h-8 text-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="vwl_betrag" className="text-xs flex items-center">
                                {labels.vwl_betrag}
                                <FieldHint fieldKey="vwl_betrag" lang={lang} />
                            </Label>
                            <Input
                                id="vwl_betrag"
                                value={formData.vwl_betrag}
                                onChange={(e) => actions.updateFormField("vwl_betrag", e.target.value)}
                                placeholder={labels.vwl_placeholder}
                                className="h-8 text-sm"
                            />
                        </div>
                    </div>

                    {formData.vertragsart !== "at_angestellter" && (
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="schichtzuschlaege"
                                checked={formData.schichtzuschlaege}
                                onCheckedChange={(checked) =>
                                    actions.updateFormField("schichtzuschlaege", checked === true)
                                }
                            />
                            <Label htmlFor="schichtzuschlaege" className="text-sm cursor-pointer">
                                {labels.schichtzuschlaege}
                            </Label>
                        </div>
                    )}
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="arbeitszeitkonto"
                            checked={formData.arbeitszeitkonto}
                            onCheckedChange={(checked) =>
                                actions.updateFormField("arbeitszeitkonto", checked === true)
                            }
                        />
                        <Label htmlFor="arbeitszeitkonto" className="text-sm cursor-pointer">
                            {labels.arbeitszeitkonto}
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="vertragsstrafe"
                            checked={formData.vertragsstrafe}
                            onCheckedChange={(checked) =>
                                actions.updateFormField("vertragsstrafe", checked === true)
                            }
                        />
                        <Label htmlFor="vertragsstrafe" className="text-sm cursor-pointer flex items-center">
                            {labels.vertragsstrafe}
                            <FieldHint fieldKey="vertragsstrafe" lang={lang} />
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="firmenwagen"
                            checked={formData.firmenwagen}
                            onCheckedChange={(checked) =>
                                actions.updateFormField("firmenwagen", checked === true)
                            }
                        />
                        <Label htmlFor="firmenwagen" className="text-sm cursor-pointer">
                            {labels.firmenwagen}
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="homeoffice"
                            checked={formData.homeoffice}
                            onCheckedChange={(checked) =>
                                actions.updateFormField("homeoffice", checked === true)
                            }
                        />
                        <Label htmlFor="homeoffice" className="text-sm cursor-pointer">
                            {labels.homeoffice}
                        </Label>
                    </div>
                </div>
            </div>

            {/* AT-Optionen (nur bei AT-Angestellter) */}
            {formData.vertragsart === "at_angestellter" && (
                <div className="space-y-3 pt-5 border-t border-border/30">
                    <h4 className="text-[11px] font-medium text-foreground/40 tracking-wide">
                        {labels.section_at}
                    </h4>
                    <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="zielbonus"
                                checked={formData.zielbonus}
                                onCheckedChange={(checked) => actions.updateFormField("zielbonus", checked === true)}
                            />
                            <Label htmlFor="zielbonus" className="text-sm cursor-pointer">{labels.zielbonus}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="freistellung"
                                checked={formData.freistellung}
                                onCheckedChange={(checked) => actions.updateFormField("freistellung", checked === true)}
                            />
                            <Label htmlFor="freistellung" className="text-sm cursor-pointer">{labels.freistellung}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="spesen"
                                checked={formData.spesen}
                                onCheckedChange={(checked) => actions.updateFormField("spesen", checked === true)}
                            />
                            <Label htmlFor="spesen" className="text-sm cursor-pointer">{labels.spesen}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="renteneintritt"
                                checked={formData.renteneintritt}
                                onCheckedChange={(checked) => actions.updateFormField("renteneintritt", checked === true)}
                            />
                            <Label htmlFor="renteneintritt" className="text-sm cursor-pointer">{labels.renteneintritt}</Label>
                        </div>
                    </div>
                </div>
            )}

            {/* Unterzeichner */}
            <div className="space-y-3 pt-5 border-t border-border/30">
                <h4 className="text-[11px] font-medium text-foreground/40 tracking-wide">
                    {labels.section_signatory}
                </h4>

                <div className="space-y-1">
                    <Label htmlFor="signatory_name" className="text-xs flex items-center">
                        {labels.signatory_name} <span className="text-destructive/70">*</span>
                        <FieldHint fieldKey="signatory_name" lang={lang} />
                    </Label>
                    <Input
                        id="signatory_name"
                        value={formData.signatory_name}
                        onChange={(e) => actions.updateFormField("signatory_name", e.target.value)}
                        onBlur={() => markTouched("signatory_name")}
                        placeholder={labels.signatory_placeholder}
                        className={fieldClass("signatory_name", formData.signatory_name)}
                    />
                    {getInlineError("signatory_name", formData.signatory_name) && (
                        <FieldError message={getInlineError("signatory_name", formData.signatory_name)!} />
                    )}
                </div>
            </div>
        </div>
        </TooltipProvider>
    );
};

export default FormFieldsSection;
