/**
 * StepContractDetails - Schritt 3: Vertragsdetails
 *
 * Sammelt die wichtigsten Vertragsdaten:
 * - Position (Pflicht)
 * - Gehalt (Pflicht)
 * - Eintrittsdatum (Pflicht)
 * - Wochenstunden (mit Default)
 * - Probezeit (mit Default)
 * - Zusatzleistungen (optional)
 */

import { Briefcase, ArrowRight, ArrowLeft, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useWizardContext } from "../WizardContext";

const PROBEZEIT_OPTIONS = [
    { value: "keine", label: "Keine Probezeit" },
    { value: "3 Monate", label: "3 Monate" },
    { value: "6 Monate", label: "6 Monate" },
];

export const StepContractDetails = () => {
    const { state, actions } = useWizardContext();
    const { formData, validationErrors, showClausesStep } = state;

    const getError = (field: string) =>
        validationErrors.find((e) => e.field === field)?.message;

    const handleChange = (field: keyof typeof formData) => (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        actions.updateFormField(field, e.target.value);
    };

    const handleCheckboxChange = (field: "firmenwagen" | "homeoffice") => (
        checked: boolean
    ) => {
        actions.updateFormField(field, checked);
    };

    const handleProbezeitChange = (value: string) => {
        actions.updateFormField("probezeit", value);
    };

    return (
        <div className="max-w-xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                    <Briefcase className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Vertragsdetails</h2>
                <p className="text-muted-foreground">
                    Die wichtigsten Angaben zum Arbeitsverhältnis.
                </p>
            </div>

            {/* Formular */}
            <Card>
                <CardContent className="pt-6 space-y-6">
                    {/* Position & Gehalt */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="position">
                                Position <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="position"
                                value={formData.position}
                                onChange={handleChange("position")}
                                placeholder="Software-Entwickler"
                                className={getError("position") ? "border-destructive" : ""}
                            />
                            {getError("position") && (
                                <p className="text-xs text-destructive">{getError("position")}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="gehalt">
                                Monatsgehalt (brutto) <span className="text-destructive">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    id="gehalt"
                                    type="number"
                                    value={formData.gehalt}
                                    onChange={handleChange("gehalt")}
                                    placeholder="5000"
                                    className={`pr-8 ${getError("gehalt") ? "border-destructive" : ""}`}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">

                                </span>
                            </div>
                            {getError("gehalt") && (
                                <p className="text-xs text-destructive">{getError("gehalt")}</p>
                            )}
                        </div>
                    </div>

                    {/* Eintrittsdatum & Wochenstunden */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="eintrittsdatum">
                                Eintrittsdatum <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="eintrittsdatum"
                                type="date"
                                value={formData.eintrittsdatum}
                                onChange={handleChange("eintrittsdatum")}
                                className={getError("eintrittsdatum") ? "border-destructive" : ""}
                            />
                            {getError("eintrittsdatum") && (
                                <p className="text-xs text-destructive">{getError("eintrittsdatum")}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="wochenstunden">Wochenstunden</Label>
                            <Input
                                id="wochenstunden"
                                type="number"
                                value={formData.wochenstunden}
                                onChange={handleChange("wochenstunden")}
                                placeholder="40"
                            />
                        </div>
                    </div>

                    {/* Probezeit */}
                    <div className="space-y-2">
                        <Label htmlFor="probezeit">Probezeit</Label>
                        <Select
                            value={formData.probezeit}
                            onValueChange={handleProbezeitChange}
                        >
                            <SelectTrigger id="probezeit">
                                <SelectValue placeholder="Probezeit wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                                {PROBEZEIT_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Zusatzleistungen */}
                    <div className="space-y-4 pt-4 border-t">
                        <p className="text-sm font-medium">Zusatzleistungen</p>
                        <div className="flex flex-wrap gap-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                    id="firmenwagen"
                                    checked={formData.firmenwagen}
                                    onCheckedChange={handleCheckboxChange("firmenwagen")}
                                />
                                <span className="text-sm">Firmenwagen</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                    id="homeoffice"
                                    checked={formData.homeoffice}
                                    onCheckedChange={handleCheckboxChange("homeoffice")}
                                />
                                <span className="text-sm">Homeoffice-Option</span>
                            </label>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Textbausteine anpassen Link */}
            {!showClausesStep && (
                <Card className="bg-muted/30 border-dashed">
                    <CardContent className="py-4">
                        <button
                            type="button"
                            onClick={() => actions.toggleClausesStep()}
                            className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                            <FileText className="w-4 h-4" />
                            Textbausteine anpassen (optional)
                        </button>
                    </CardContent>
                </Card>
            )}

            {/* Navigation */}
            <div className="flex justify-between">
                <Button
                    variant="outline"
                    size="lg"
                    onClick={() => actions.prevStep()}
                    className="gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Zurück
                </Button>
                <Button
                    size="lg"
                    onClick={() => actions.nextStep()}
                    className="gap-2"
                >
                    {showClausesStep ? "Weiter" : "Zur Vorschau"}
                    <ArrowRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

export default StepContractDetails;
