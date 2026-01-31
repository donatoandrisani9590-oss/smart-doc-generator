/**
 * FormFieldsSection - Formularfelder für den Split-Screen Editor
 *
 * Zeigt alle Eingabefelder für Mitarbeiter- und Vertragsdaten
 * in einer kompakten, scrollbaren Ansicht.
 * 
 * v4.2.1: Fortschrittsanzeige für Pflichtfelder
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

export const FormFieldsSection = () => {
    const { state, actions } = useWizardContext();
    const { formData, validationErrors } = state;

    // Berechne ausgefüllte Pflichtfelder
    const requiredFieldsProgress = useMemo(() => {
        const filled = REQUIRED_FIELDS.filter((field) => {
            const value = formData[field];
            return value !== undefined && value !== null && value !== "";
        }).length;
        const total = REQUIRED_FIELDS.length;
        const percentage = Math.round((filled / total) * 100);
        return { filled, total, percentage };
    }, [formData]);

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
                            von {requiredFieldsProgress.total} Pflichtfeldern ausgefüllt
                        </span>
                    </span>
                    <span className="text-muted-foreground/60">
                        <span className="text-destructive">*</span> = Pflichtfeld
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
                    Mitarbeiterdaten
                </h4>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label htmlFor="vorname" className="text-xs">
                            Vorname <span className="text-destructive">*</span>
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
                            Nachname <span className="text-destructive">*</span>
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
                    <Label htmlFor="strasse" className="text-xs">Adresse</Label>
                    <Input
                        id="strasse"
                        value={formData.strasse}
                        onChange={(e) => actions.updateFormField("strasse", e.target.value)}
                        placeholder="Straße und Hausnummer"
                        className="h-8 text-sm"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <Label htmlFor="plz" className="text-xs">PLZ</Label>
                        <Input
                            id="plz"
                            value={formData.plz}
                            onChange={(e) => actions.updateFormField("plz", e.target.value)}
                            className="h-8 text-sm"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="ort" className="text-xs">Ort</Label>
                        <Input
                            id="ort"
                            value={formData.ort}
                            onChange={(e) => actions.updateFormField("ort", e.target.value)}
                            className="h-8 text-sm"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <Label htmlFor="geburtsdatum" className="text-xs">Geburtsdatum</Label>
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
                    Vertragsdaten
                </h4>

                <div className="space-y-1">
                    <Label htmlFor="position" className="text-xs">
                        Position <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="position"
                        value={formData.position}
                        onChange={(e) => actions.updateFormField("position", e.target.value)}
                        placeholder="Berufsbezeichnung"
                        className={`h-8 text-sm ${getError("position") ? "border-destructive" : ""}`}
                    />
                </div>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label htmlFor="gehalt" className="text-xs">
                            Gehalt (EUR) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="gehalt"
                            type="number"
                            value={formData.gehalt}
                            onChange={(e) => actions.updateFormField("gehalt", e.target.value)}
                            placeholder="Brutto pro Monat"
                            className={`h-8 text-sm ${getError("gehalt") ? "border-destructive" : ""}`}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="eintrittsdatum" className="text-xs">
                            Eintrittsdatum <span className="text-destructive">*</span>
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
                        <Label htmlFor="wochenstunden" className="text-xs">Std/Woche</Label>
                        <Input
                            id="wochenstunden"
                            type="number"
                            value={formData.wochenstunden}
                            onChange={(e) => actions.updateFormField("wochenstunden", e.target.value)}
                            className="h-8 text-sm"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="urlaubstage" className="text-xs">Urlaubstage</Label>
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
                    <Label htmlFor="probezeit" className="text-xs">Probezeit</Label>
                    <Select
                        value={formData.probezeit}
                        onValueChange={(v) => actions.updateFormField("probezeit", v)}
                    >
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Probezeit wählen" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Keine">Keine</SelectItem>
                            <SelectItem value="3 Monate">3 Monate</SelectItem>
                            <SelectItem value="6 Monate">6 Monate</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Zusatzleistungen */}
            <div className="space-y-3 pt-3 border-t">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Zusatzleistungen
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
                            Firmenwagen
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
                            Home Office
                        </Label>
                    </div>
                </div>
            </div>

            {/* Unterzeichner */}
            <div className="space-y-3 pt-3 border-t">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Unterzeichner
                </h4>

                <div className="space-y-1">
                    <Label htmlFor="signatory_name" className="text-xs">
                        Name (Arbeitgeber) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="signatory_name"
                        value={formData.signatory_name}
                        onChange={(e) => actions.updateFormField("signatory_name", e.target.value)}
                        placeholder="Unterzeichnende Person"
                        className={`h-8 text-sm ${getError("signatory_name") ? "border-destructive" : ""}`}
                    />
                </div>
            </div>
        </div>
    );
};

export default FormFieldsSection;
