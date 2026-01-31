import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Variable, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Placeholder {
    name: string;
    label: string;
    type: string;
    category?: string;
}

interface PlaceholderDropdownProps {
    onInsert: (placeholder: string) => void;
    placeholders?: Placeholder[];
}

const DEFAULT_PLACEHOLDERS: Placeholder[] = [
    // Mitarbeiterdaten
    { name: "mitarbeiter_vorname", label: "Vorname", type: "text", category: "Mitarbeiter" },
    { name: "mitarbeiter_nachname", label: "Nachname", type: "text", category: "Mitarbeiter" },
    { name: "mitarbeiter_name", label: "Voller Name", type: "text", category: "Mitarbeiter" },
    { name: "mitarbeiter_adresse", label: "Adresse", type: "text", category: "Mitarbeiter" },
    { name: "mitarbeiter_geburtsdatum", label: "Geburtsdatum", type: "date", category: "Mitarbeiter" },

    // Vertragsdaten
    { name: "eintrittsdatum", label: "Eintrittsdatum", type: "date", category: "Vertrag" },
    { name: "austrittsdatum", label: "Austrittsdatum", type: "date", category: "Vertrag" },
    { name: "position", label: "Position/Stelle", type: "text", category: "Vertrag" },
    { name: "abteilung", label: "Abteilung", type: "text", category: "Vertrag" },
    { name: "wochenstunden", label: "Wochenstunden", type: "number", category: "Vertrag" },
    { name: "probezeit_monate", label: "Probezeit (Monate)", type: "number", category: "Vertrag" },

    // Vergütung
    { name: "gehalt_brutto", label: "Bruttogehalt", type: "currency", category: "Vergütung" },
    { name: "gehalt_netto", label: "Nettogehalt", type: "currency", category: "Vergütung" },
    { name: "bonus_hoehe", label: "Bonushöhe", type: "currency", category: "Vergütung" },
    { name: "urlaubstage", label: "Urlaubstage", type: "number", category: "Vergütung" },

    // Benefits
    { name: "firmenwagen_kategorie", label: "Firmenwagen Kategorie", type: "select", category: "Benefits" },
    { name: "homeoffice_tage", label: "Homeoffice Tage/Woche", type: "number", category: "Benefits" },

    // Datum/Unterschrift
    { name: "datum_heute", label: "Heutiges Datum", type: "date", category: "Dokument" },
    { name: "ort_unterschrift", label: "Ort der Unterschrift", type: "text", category: "Dokument" },
];

export const PlaceholderDropdown = ({ onInsert, placeholders = DEFAULT_PLACEHOLDERS }: PlaceholderDropdownProps) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [isOpen, setIsOpen] = useState(false);

    const filteredPlaceholders = placeholders.filter(
        (p) =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groupedPlaceholders = filteredPlaceholders.reduce((acc, p) => {
        const category = p.category || "Andere";
        if (!acc[category]) acc[category] = [];
        acc[category].push(p);
        return acc;
    }, {} as Record<string, Placeholder[]>);

    const handleInsert = (name: string) => {
        onInsert(`{{ ${name} }}`);
        setIsOpen(false);
        setSearchTerm("");
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "date": return "📅";
            case "currency": return "💰";
            case "number": return "🔢";
            case "select": return "📋";
            default: return "📝";
        }
    };

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Variable className="w-4 h-4" />
                    Platzhalter
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto">
                <div className="p-2 sticky top-0 bg-popover">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Suchen..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 h-9"
                        />
                    </div>
                </div>
                <DropdownMenuSeparator />

                {Object.entries(groupedPlaceholders).map(([category, items]) => (
                    <div key={category}>
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                            {category}
                        </DropdownMenuLabel>
                        {items.map((p) => (
                            <DropdownMenuItem
                                key={p.name}
                                onClick={() => handleInsert(p.name)}
                                className="cursor-pointer"
                            >
                                <span className="mr-2">{getTypeIcon(p.type)}</span>
                                <span className="flex-1">{p.label}</span>
                                <code className="text-xs text-muted-foreground">{`{{${p.name}}}`}</code>
                            </DropdownMenuItem>
                        ))}
                    </div>
                ))}

                {filteredPlaceholders.length === 0 && (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                        Keine Platzhalter gefunden
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
