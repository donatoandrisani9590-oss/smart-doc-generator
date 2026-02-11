/**
 * FormFieldsSection - Formularfelder für den Split-Screen Editor
 *
 * Zeigt alle Eingabefelder für Mitarbeiter- und Vertragsdaten
 * in einer kompakten, scrollbaren Ansicht.
 *
 * v4.2.1: Fortschrittsanzeige für Pflichtfelder
 * v4.2.2: i18n-Unterstützung für DE/IT Dokumenttypen
 */

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";
import { useWizardContext } from "../WizardContext";

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
    const { formData, validationErrors } = state;

    // Ermittle Sprache aus countryCode (IT → it, sonst de)
    const lang: LanguageCode = countryCode?.toUpperCase() === "IT" ? "it" : "de";
    const labels = FIELD_LABELS[lang];

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

    const getError = (field: string) =>
        validationErrors.find((e) => e.field === field)?.message;

    return (
        <div className="space-y-4 p-3 bg-background rounded-lg border">
            {/* Fortschrittsanzeige für Pflichtfelder */}
            <div className="space-y-2 pb-3 border-b">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                        {requiredFieldsProgress.percentage === 100 && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        )}
                        <span>
                            <span className="font-medium text-foreground">
                                {requiredFieldsProgress.filled}
                            </span>{" "}
                            {labels.progress_filled} {requiredFieldsProgress.total} {labels.progress_suffix}
                        </span>
                    </span>
                    <span className="text-muted-foreground/60">
                        <span className="text-destructive">*</span> = {labels.required}
                    </span>
                </div>
                <Progress
                    value={requiredFieldsProgress.percentage}
                    className="h-1.5"
                />
            </div>

            {/* Mitarbeiterdaten */}
            <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {labels.section_employee}
                </h4>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label htmlFor="vorname" className="text-xs">
                            {labels.vorname} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="vorname"
                            value={formData.vorname}
                            onChange={(e) => actions.updateFormField("vorname", e.target.value)}
                            className={`h-8 text-sm ${getError("vorname") ? "border-destructive" : ""}`}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="nachname" className="text-xs">
                            {labels.nachname} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="nachname"
                            value={formData.nachname}
                            onChange={(e) => actions.updateFormField("nachname", e.target.value)}
                            className={`h-8 text-sm ${getError("nachname") ? "border-destructive" : ""}`}
                        />
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

                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <Label htmlFor="plz" className="text-xs">{labels.plz}</Label>
                        <Input
                            id="plz"
                            value={formData.plz}
                            onChange={(e) => actions.updateFormField("plz", e.target.value)}
                            className="h-8 text-sm"
                        />
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
            <div className="space-y-3 pt-3 border-t">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {labels.section_contract}
                </h4>

                <div className="space-y-1">
                    <Label htmlFor="position" className="text-xs">
                        {labels.position} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="position"
                        value={formData.position}
                        onChange={(e) => actions.updateFormField("position", e.target.value)}
                        placeholder={labels.position_placeholder}
                        className={`h-8 text-sm ${getError("position") ? "border-destructive" : ""}`}
                    />
                </div>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label htmlFor="gehalt" className="text-xs">
                            {labels.gehalt} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="gehalt"
                            type="number"
                            value={formData.gehalt}
                            onChange={(e) => actions.updateFormField("gehalt", e.target.value)}
                            placeholder={labels.gehalt_placeholder}
                            className={`h-8 text-sm ${getError("gehalt") ? "border-destructive" : ""}`}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="eintrittsdatum" className="text-xs">
                            {labels.eintrittsdatum} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="eintrittsdatum"
                            type="date"
                            value={formData.eintrittsdatum}
                            onChange={(e) => actions.updateFormField("eintrittsdatum", e.target.value)}
                            className={`h-8 text-sm ${getError("eintrittsdatum") ? "border-destructive" : ""}`}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <Label htmlFor="wochenstunden" className="text-xs">{labels.wochenstunden}</Label>
                        <Input
                            id="wochenstunden"
                            type="number"
                            value={formData.wochenstunden}
                            onChange={(e) => actions.updateFormField("wochenstunden", e.target.value)}
                            className="h-8 text-sm"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="urlaubstage" className="text-xs">{labels.urlaubstage}</Label>
                        <Input
                            id="urlaubstage"
                            type="number"
                            value={formData.urlaubstage}
                            onChange={(e) => actions.updateFormField("urlaubstage", e.target.value)}
                            className="h-8 text-sm"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <Label htmlFor="probezeit" className="text-xs">{labels.probezeit}</Label>
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
            </div>

            {/* Zusatzleistungen */}
            <div className="space-y-3 pt-3 border-t">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {labels.section_benefits}
                </h4>

                <div className="space-y-2">
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

            {/* Unterzeichner */}
            <div className="space-y-3 pt-3 border-t">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {labels.section_signatory}
                </h4>

                <div className="space-y-1">
                    <Label htmlFor="signatory_name" className="text-xs">
                        {labels.signatory_name} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="signatory_name"
                        value={formData.signatory_name}
                        onChange={(e) => actions.updateFormField("signatory_name", e.target.value)}
                        placeholder={labels.signatory_placeholder}
                        className={`h-8 text-sm ${getError("signatory_name") ? "border-destructive" : ""}`}
                    />
                </div>
            </div>
        </div>
    );
};

export default FormFieldsSection;
