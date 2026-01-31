/**
 * StepEmployeeInfo - Schritt 2: Mitarbeiterdaten
 *
 * Sammelt die persönlichen Daten des Mitarbeiters:
 * - Vorname (Pflicht)
 * - Nachname (Pflicht)
 * - Adresse (optional)
 * - Geburtsdatum (optional)
 */

import { User, ArrowRight, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useWizardContext } from "../WizardContext";

export const StepEmployeeInfo = () => {
    const { state, actions } = useWizardContext();
    const { formData, validationErrors } = state;

    const getError = (field: string) =>
        validationErrors.find((e) => e.field === field)?.message;

    const handleChange = (field: keyof typeof formData) => (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        actions.updateFormField(field, e.target.value);
    };

    return (
        <div className="max-w-xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Für wen ist das Dokument?</h2>
                <p className="text-muted-foreground">
                    Geben Sie die persönlichen Daten des Mitarbeiters ein.
                </p>
            </div>

            {/* Formular */}
            <Card>
                <CardContent className="pt-6 space-y-6">
                    {/* Name */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="vorname">
                                Vorname <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="vorname"
                                value={formData.vorname}
                                onChange={handleChange("vorname")}
                                placeholder="Max"
                                className={getError("vorname") ? "border-destructive" : ""}
                            />
                            {getError("vorname") && (
                                <p className="text-xs text-destructive">{getError("vorname")}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nachname">
                                Nachname <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="nachname"
                                value={formData.nachname}
                                onChange={handleChange("nachname")}
                                placeholder="Mustermann"
                                className={getError("nachname") ? "border-destructive" : ""}
                            />
                            {getError("nachname") && (
                                <p className="text-xs text-destructive">{getError("nachname")}</p>
                            )}
                        </div>
                    </div>

                    {/* Adresse */}
                    <div className="space-y-4 pt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                            Adresse (optional)
                        </p>
                        <div className="space-y-2">
                            <Label htmlFor="strasse">Straße und Hausnummer</Label>
                            <Input
                                id="strasse"
                                value={formData.strasse}
                                onChange={handleChange("strasse")}
                                placeholder="Musterstraße 123"
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="plz">PLZ</Label>
                                <Input
                                    id="plz"
                                    value={formData.plz}
                                    onChange={handleChange("plz")}
                                    placeholder="12345"
                                    maxLength={5}
                                />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <Label htmlFor="ort">Ort</Label>
                                <Input
                                    id="ort"
                                    value={formData.ort}
                                    onChange={handleChange("ort")}
                                    placeholder="Musterstadt"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Geburtsdatum */}
                    <div className="space-y-2 pt-4 border-t">
                        <Label htmlFor="geburtsdatum">Geburtsdatum (optional)</Label>
                        <Input
                            id="geburtsdatum"
                            type="date"
                            value={formData.geburtsdatum}
                            onChange={handleChange("geburtsdatum")}
                        />
                        <p className="text-xs text-muted-foreground">
                            Empfohlen für vollständige Unterlagen
                        </p>
                    </div>
                </CardContent>
            </Card>

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
                    Weiter
                    <ArrowRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

export default StepEmployeeInfo;
