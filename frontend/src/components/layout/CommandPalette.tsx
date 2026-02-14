/**
 * CommandPalette - Globale Cmd+K Befehlspalette
 *
 * Schnellnavigation, Dokumentensuche und Aktionen über eine einzige Palette.
 * Nutzt shadcn/ui Command (cmdk) und den bestehenden useGlobalSearch Hook.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandShortcut,
    CommandSeparator,
} from "@/components/ui/command";
import { useGlobalSearch } from "@/hooks/api/useDashboardQueries";
import { useCountry } from "@/hooks/useCountry";
import {
    FileText,
    Search,
    Settings,
    PlusCircle,
    FolderOpen,
    Globe,
    LayoutTemplate,
    Users,
    Calendar,
    Bell,
    Upload,
} from "lucide-react";

interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const CommandPalette = ({ open, onOpenChange }: CommandPaletteProps) => {
    const navigate = useNavigate();
    const { country } = useCountry();
    const [query, setQuery] = useState("");

    const { data: searchResponse } = useGlobalSearch(query, {
        countryCode: country,
        limit: 5,
    });

    // Reset query when dialog opens
    useEffect(() => {
        if (open) setQuery("");
    }, [open]);

    const runCommand = (callback: () => void) => {
        onOpenChange(false);
        callback();
    };

    const isMac = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");
    const mod = isMac ? "⌘" : "Ctrl+";

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput
                placeholder="Seite, Dokument oder Aktion suchen..."
                value={query}
                onValueChange={setQuery}
            />
            <CommandList>
                <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>

                {/* Search Results */}
                {searchResponse?.results && searchResponse.results.length > 0 && (
                    <>
                        <CommandGroup heading="Suchergebnisse">
                            {searchResponse.results.map((result) => (
                                <CommandItem
                                    key={`${result.result_type}-${result.id}`}
                                    onSelect={() =>
                                        runCommand(() =>
                                            navigate(
                                                result.result_type === "draft"
                                                    ? `/generate?draft=${result.id}`
                                                    : `/documents/${result.id}`
                                            )
                                        )
                                    }
                                >
                                    <FileText className="mr-2 h-4 w-4" />
                                    <span className="flex-1 truncate">
                                        {result.document_type_name}
                                    </span>
                                    {result.employee_name && (
                                        <span className="ml-2 text-muted-foreground text-xs truncate">
                                            {result.employee_name}
                                        </span>
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                    </>
                )}

                {/* Navigation */}
                <CommandGroup heading="Navigation">
                    <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
                        <Globe className="mr-2 h-4 w-4" />
                        <span>Übersicht</span>
                        <CommandShortcut>{mod}H</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/documents"))}>
                        <FolderOpen className="mr-2 h-4 w-4" />
                        <span>Dokumente</span>
                        <CommandShortcut>{mod}D</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/search"))}>
                        <Search className="mr-2 h-4 w-4" />
                        <span>Erweiterte Suche</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/teams"))}>
                        <Users className="mr-2 h-4 w-4" />
                        <span>Teams</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/deadlines"))}>
                        <Calendar className="mr-2 h-4 w-4" />
                        <span>Fristen</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/notifications"))}>
                        <Bell className="mr-2 h-4 w-4" />
                        <span>Benachrichtigungen</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                {/* Actions */}
                <CommandGroup heading="Aktionen">
                    <CommandItem onSelect={() => runCommand(() => navigate("/generate"))}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        <span>Neues Dokument erstellen</span>
                        <CommandShortcut>{mod}N</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/bulk"))}>
                        <Upload className="mr-2 h-4 w-4" />
                        <span>Massen-Import</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                {/* Settings */}
                <CommandGroup heading="Einstellungen">
                    <CommandItem onSelect={() => runCommand(() => navigate("/settings?tab=templates"))}>
                        <LayoutTemplate className="mr-2 h-4 w-4" />
                        <span>Vorlagen verwalten</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/settings?tab=general"))}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Einstellungen</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
};
