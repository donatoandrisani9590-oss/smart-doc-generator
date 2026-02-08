import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
    ChevronDown,
    Briefcase,
    Clock,
    Calendar,
} from "lucide-react";
import { CATEGORIES } from "./constants";

interface BasicsStepProps {
    name: string;
    setName: (value: string) => void;
    description: string;
    setDescription: (value: string) => void;
    category: string;
    setCategory: (value: string) => void;
    countryCode: string;
    setCountryCode: (value: string) => void;
    isActive: boolean;
    setIsActive: (value: boolean) => void;
    showAdvancedSettings: boolean;
    setShowAdvancedSettings: (value: boolean) => void;
    defaultProbationMonths: number;
    setDefaultProbationMonths: (value: number) => void;
    defaultNoticePeriod: string;
    setDefaultNoticePeriod: (value: string) => void;
    defaultVacationDays: number;
    setDefaultVacationDays: (value: number) => void;
    defaultWeeklyHours: number;
    setDefaultWeeklyHours: (value: number) => void;
    errors: Record<string, string>;
}

export const BasicsStep = ({
    name,
    setName,
    description,
    setDescription,
    category,
    setCategory,
    countryCode,
    setCountryCode,
    isActive,
    setIsActive,
    showAdvancedSettings,
    setShowAdvancedSettings,
    defaultProbationMonths,
    setDefaultProbationMonths,
    defaultNoticePeriod,
    setDefaultNoticePeriod,
    defaultVacationDays,
    setDefaultVacationDays,
    defaultWeeklyHours,
    setDefaultWeeklyHours,
    errors,
}: BasicsStepProps) => {
    return (
        <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <div className="grid gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Name des Dokumenttyps *</Label>
                    <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="z.B. Arbeitsvertrag Vollzeit"
                        className={errors.name ? "border-red-500" : ""}
                    />
                    {errors.name && (
                        <p className="text-sm text-red-500">{errors.name}</p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Kategorie *</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger className={errors.category ? "border-red-500" : ""}>
                                <SelectValue placeholder="Kategorie wählen" />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORIES.map((cat) => (
                                    <SelectItem key={cat.value} value={cat.value}>
                                        {cat.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.category && (
                            <p className="text-sm text-red-500">{errors.category}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Land</Label>
                        <Select value={countryCode} onValueChange={setCountryCode}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DE">Deutschland</SelectItem>
                                <SelectItem value="IT">Italien</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="description">Beschreibung</Label>
                    <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Kurze Beschreibung des Dokumenttyps..."
                        rows={2}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Checkbox
                        id="active"
                        checked={isActive}
                        onCheckedChange={(checked) => setIsActive(checked === true)}
                    />
                    <Label htmlFor="active" className="font-normal">
                        Dokumenttyp ist aktiv
                    </Label>
                </div>
            </div>

            {/* Erweiterte Einstellungen (Collapsible) */}
            <Collapsible
                open={showAdvancedSettings}
                onOpenChange={setShowAdvancedSettings}
                className="mt-6"
            >
                <CollapsibleTrigger asChild>
                    <button
                        type="button"
                        className="flex items-center gap-2 w-full p-3 rounded-lg border border-blue-200 bg-blue-50/30 hover:bg-blue-50 transition-colors text-left group"
                    >
                        <ChevronDown className={cn(
                            "w-4 h-4 text-blue-600 transition-transform duration-200",
                            showAdvancedSettings && "rotate-180"
                        )} />
                        <Briefcase className="w-4 h-4 text-blue-600" />
                        <div className="flex-1">
                            <span className="font-medium text-sm text-blue-800">
                                Erweiterte Einstellungen
                            </span>
                            <span className="text-xs text-blue-600 ml-2">
                                (optional)
                            </span>
                        </div>
                        {!showAdvancedSettings && (defaultProbationMonths !== 6 || defaultVacationDays !== 30 || defaultWeeklyHours !== 40) && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                Angepasst
                            </span>
                        )}
                    </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                    <Card className="border-blue-200 bg-blue-50/30">
                        <CardHeader className="pb-3">
                            <p className="text-xs text-blue-600">
                                Diese Werte werden beim Erstellen eines Dokuments dieses Typs vorausgefüllt
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-blue-600" />
                                        Probezeit
                                    </Label>
                                    <Select
                                        value={String(defaultProbationMonths)}
                                        onValueChange={(v) => setDefaultProbationMonths(parseInt(v))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">Keine Probezeit</SelectItem>
                                            <SelectItem value="3">3 Monate</SelectItem>
                                            <SelectItem value="6">6 Monate</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        In DE max. 6 Monate erlaubt.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label>Kündigungsfrist</Label>
                                    <Input
                                        value={defaultNoticePeriod}
                                        onChange={(e) => setDefaultNoticePeriod(e.target.value)}
                                        placeholder="4 Wochen zum Monatsende"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Gesetzliches Minimum: 4 Wochen.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-blue-600" />
                                        Urlaubstage/Jahr
                                    </Label>
                                    <Input
                                        type="number"
                                        value={defaultVacationDays}
                                        onChange={(e) => setDefaultVacationDays(parseInt(e.target.value) || 30)}
                                        min={20}
                                        max={40}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Minimum: 20 Tage. Üblich: 25-30.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label>Wochenstunden</Label>
                                    <Input
                                        type="number"
                                        value={defaultWeeklyHours}
                                        onChange={(e) => setDefaultWeeklyHours(parseInt(e.target.value) || 40)}
                                        min={10}
                                        max={48}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Vollzeit: 40h. Max: 48h/Woche.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </CollapsibleContent>
            </Collapsible>
        </motion.div>
    );
};
