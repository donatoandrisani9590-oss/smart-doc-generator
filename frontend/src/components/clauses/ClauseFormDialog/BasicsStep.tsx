import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertCircle, X, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES, COUNTRIES } from "./constants";

interface BasicsStepProps {
    title: string;
    setTitle: (value: string) => void;
    category: string;
    setCategory: (value: string) => void;
    customCategory: string;
    setCustomCategory: (value: string) => void;
    countryCode: string;
    setCountryCode: (value: string) => void;
    description: string;
    setDescription: (value: string) => void;
    tags: string[];
    setTags: (value: string[]) => void;
    tagInput: string;
    setTagInput: (value: string) => void;
    tone: string;
    setTone: (value: string) => void;
    errors: Record<string, string>;
    touched: Record<string, boolean>;
    setTouched: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    /** Compact mode: nur Titel + Kategorie, ohne AI-Metadaten, Land, Tipps */
    compact?: boolean;
}

export const BasicsStep = ({
    title,
    setTitle,
    category,
    setCategory,
    customCategory,
    setCustomCategory,
    countryCode,
    setCountryCode,
    description,
    setDescription,
    tags,
    setTags,
    tagInput,
    setTagInput,
    tone,
    setTone,
    errors,
    touched,
    setTouched,
    compact = false,
}: BasicsStepProps) => (
    <div className={compact ? "space-y-3" : "space-y-6"}>
        {/* Title */}
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label htmlFor="title" className="text-sm font-medium">
                    Titel des Textbausteins <span className="text-red-500">*</span>
                </Label>
                <span className={cn(
                    "text-xs",
                    title.length > 180 ? "text-amber-600 font-medium" : "text-muted-foreground",
                    title.length > 200 && "text-red-500 font-medium"
                )}>
                    {title.length}/200
                </span>
            </div>
            <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 200))}
                onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
                placeholder="z.B. Arbeitszeit Vollzeit 40h"
                className={cn(
                    "text-base",
                    touched.title && errors.title && "border-red-500 focus-visible:ring-red-500"
                )}
                autoFocus
                maxLength={200}
            />
            {touched.title && errors.title && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.title}
                </p>
            )}
            {!compact && (
            <p className="text-xs text-muted-foreground">
                Wählen Sie einen eindeutigen, beschreibenden Titel
            </p>
            )}
        </div>

        {/* Category */}
        <div className="space-y-2">
            <Label className="text-sm font-medium">
                Kategorie <span className="text-red-500">*</span>
            </Label>
            <Select
                value={category}
                onValueChange={(value) => {
                    setCategory(value);
                    if (value !== "custom") setCustomCategory("");
                }}
            >
                <SelectTrigger className={cn(
                    "w-full",
                    touched.category && errors.category && "border-red-500 focus:ring-red-500"
                )}>
                    <SelectValue placeholder="Kategorie auswählen..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectLabel className="text-xs text-muted-foreground px-2">Arbeitsvertrag</SelectLabel>
                        {CATEGORIES.filter(c => c.group === "Arbeitsvertrag").map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                                <div className="flex items-center gap-2">
                                    <span>{cat.label}</span>
                                    <span className="text-xs text-muted-foreground">- {cat.description}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectGroup>
                    <SelectGroup>
                        <SelectLabel className="text-xs text-muted-foreground px-2">HR-Korrespondenz</SelectLabel>
                        {CATEGORIES.filter(c => c.group === "HR-Korrespondenz").map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                                <div className="flex items-center gap-2">
                                    <span>{cat.label}</span>
                                    <span className="text-xs text-muted-foreground">- {cat.description}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectGroup>
                    <SelectGroup>
                        <SelectLabel className="text-xs text-muted-foreground px-2">Allgemein</SelectLabel>
                        {CATEGORIES.filter(c => c.group === "Allgemein").map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                                <div className="flex items-center gap-2">
                                    <span>{cat.label}</span>
                                    <span className="text-xs text-muted-foreground">- {cat.description}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectGroup>
                    <SelectGroup>
                        <SelectLabel className="text-xs text-muted-foreground px-2">Eigene</SelectLabel>
                        <SelectItem value="custom">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-3 h-3" />
                                <span>Eigene Kategorie anlegen</span>
                            </div>
                        </SelectItem>
                    </SelectGroup>
                </SelectContent>
            </Select>

            {category === "custom" && (
                <Input
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, customCategory: true }))}
                    placeholder="Name der neuen Kategorie"
                    className={cn(
                        "mt-2",
                        touched.customCategory && errors.customCategory && "border-red-500"
                    )}
                    autoFocus
                />
            )}

            {touched.category && errors.category && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.category}
                </p>
            )}
        </div>

        {/* Country - hidden in compact mode */}
        {!compact && (
        <div className="space-y-2">
            <Label className="text-sm font-medium">
                Land <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
                {COUNTRIES.map((country) => (
                    <button
                        key={country.value}
                        type="button"
                        onClick={() => setCountryCode(country.value)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                            countryCode === country.value
                                ? "border-primary bg-primary/5 ring-1 ring-[#243186]"
                                : "border-border hover:border-primary/50"
                        )}
                    >
                        <span className="text-lg">{country.flag}</span>
                        <span className="font-medium text-sm">{country.label}</span>
                    </button>
                ))}
            </div>
        </div>
        )}

        {/* AI Metadata Section (v4.3) - hidden in compact mode */}
        {!compact && (
        <div className="space-y-4 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Sparkles className="w-4 h-4" />
                KI-Metadaten (optional)
            </div>

            {/* Description for AI */}
            <div className="space-y-2">
                <Label htmlFor="description" className="text-sm">
                    Beschreibung (für KI-Auswahl)
                </Label>
                <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                    placeholder="z.B. Strenge Kündigungsklausel mit kurzer Frist für Führungskräfte"
                    className="text-sm"
                    maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                    Beschreiben Sie kurz den Zweck des Textbausteins. Die KI nutzt diese Beschreibung, um den richtigen Textbaustein auszuwählen.
                </p>
            </div>

            {/* Tags for semantic matching */}
            <div className="space-y-2">
                <Label className="text-sm">Tags</Label>
                <div className="flex gap-2">
                    <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                                e.preventDefault();
                                const newTag = tagInput.trim().toLowerCase();
                                if (newTag && !tags.includes(newTag) && tags.length < 20) {
                                    setTags([...tags, newTag]);
                                    setTagInput("");
                                }
                            }
                        }}
                        placeholder="Tag eingeben + Enter"
                        className="text-sm flex-1"
                    />
                </div>
                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {tags.map((tag) => (
                            <Badge
                                key={tag}
                                variant="secondary"
                                className="text-xs cursor-pointer hover:bg-destructive/20"
                                onClick={() => setTags(tags.filter(t => t !== tag))}
                            >
                                {tag}
                                <X className="w-3 h-3 ml-1" />
                            </Badge>
                        ))}
                    </div>
                )}
                <p className="text-xs text-muted-foreground">
                    Tags helfen der KI, diese Klausel zu finden. z.B. "kuendigung", "streng", "fristlos"
                </p>
            </div>

            {/* Tone selector */}
            <div className="space-y-2">
                <Label className="text-sm">Ton des Textbausteins</Label>
                <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="neutral">Neutral (Standard)</SelectItem>
                        <SelectItem value="streng">Streng (arbeitgeberfreundlich)</SelectItem>
                        <SelectItem value="arbeitnehmerfreundlich">Arbeitnehmerfreundlich</SelectItem>
                        <SelectItem value="moderat">Moderat (ausgewogen)</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                    Bestimmt, wann die KI diese Klausel bevorzugt. "Wasserdicht" = streng, "Fair" = arbeitnehmerfreundlich.
                </p>
            </div>
        </div>
        )}

        {/* Tips - hidden in compact mode */}
        {!compact && (
        <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-3 px-4">
                <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-foreground">
                        <strong>Tipp:</strong> Verwenden Sie eindeutige Titel, die den Inhalt
                        des Textbausteins beschreiben. Das erleichtert das spätere Auffinden.
                        Die KI-Metadaten (Tags, Beschreibung, Ton) sind optional, verbessern
                        aber die automatische Textbaustein-Auswahl erheblich.
                    </div>
                </div>
            </CardContent>
        </Card>
        )}
    </div>
);
