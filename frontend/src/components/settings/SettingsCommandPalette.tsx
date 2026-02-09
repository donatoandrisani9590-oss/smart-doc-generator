/**
 * SettingsCommandPalette - Quick navigation for settings
 *
 * Features:
 * - Opens with Cmd+K (Mac) / Ctrl+K (Windows)
 * - Fuzzy search across all settings options
 * - Grouped by tab names
 * - Direct navigation to found setting
 * - ESC to close
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Building2,
  Palette,
  FileText,
  BookOpen,
  Users,
  Shield,
  Archive,
  Paperclip,
  FormInput,
  UserCheck,
  CheckSquare,
  Layout,
  Eye,
  ToggleRight,
  Image,
  MapPin,
  Type,
  Paintbrush,
  FileType,
  Hash,
  Brain,
  Wand2,
  LayoutDashboard,
  Clock,
  Activity,
  Search,
  Bot,
} from "lucide-react";

// Types for settings items
interface SettingsItem {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  icon: React.ComponentType<{ className?: string }>;
  tab: string;
}

interface SettingsGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: SettingsItem[];
}

// All searchable settings items grouped by category
const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: "general",
    label: "Allgemein",
    icon: Building2,
    items: [
      {
        id: "company-name",
        label: "Firmenname",
        description: "Name des Unternehmens bearbeiten",
        keywords: ["firma", "name", "unternehmen", "company", "titel"],
        icon: Building2,
        tab: "general",
      },
      {
        id: "company-logo",
        label: "Firmenlogo",
        description: "Logo hochladen oder ändern",
        keywords: ["logo", "bild", "image", "branding", "marke"],
        icon: Image,
        tab: "general",
      },
      {
        id: "company-address",
        label: "Firmenadresse",
        description: "Adresse und Kontaktdaten",
        keywords: ["adresse", "strasse", "plz", "ort", "stadt", "kontakt", "address"],
        icon: MapPin,
        tab: "general",
      },
    ],
  },
  {
    id: "features",
    label: "Funktionen",
    icon: ToggleRight,
    items: [
      {
        id: "feature-dashboard",
        label: "Dashboard Features",
        description: "Statistiken, Aktivitäten, Quick Actions",
        keywords: ["dashboard", "statistik", "uebersicht", "home", "start"],
        icon: LayoutDashboard,
        tab: "features",
      },
      {
        id: "feature-documents",
        label: "Dokument Features",
        description: "Dokumentenhistorie, Uploads, Vorschau",
        keywords: ["dokument", "document", "historie", "upload", "vorschau"],
        icon: FileText,
        tab: "features",
      },
      {
        id: "feature-ai",
        label: "KI Features",
        description: "KI-Assistent, Smart Mode, Vorschlaege",
        keywords: ["ki", "ai", "kuenstlich", "intelligent", "assistent", "smart", "vorschlag"],
        icon: Brain,
        tab: "features",
      },
      {
        id: "feature-workflow",
        label: "Workflow Features",
        description: "Genehmigungen, Freigaben, Versionierung",
        keywords: ["workflow", "genehmigung", "freigabe", "version", "approval"],
        icon: Wand2,
        tab: "features",
      },
      {
        id: "feature-sidebar",
        label: "Sidebar anpassen",
        description: "Menüpunkte ein- und ausblenden",
        keywords: ["sidebar", "menu", "navigation", "anpassen"],
        icon: ToggleRight,
        tab: "features",
      },
    ],
  },
  {
    id: "dokumente",
    label: "Dokumente",
    icon: FileText,
    items: [
      {
        id: "templates-types",
        label: "Dokumenttypen",
        description: "Vertraege, Angebote, Rechnungen verwalten",
        keywords: ["dokumenttyp", "type", "vertrag", "angebot", "rechnung", "vorlage", "template"],
        icon: FileType,
        tab: "templates",
      },
      {
        id: "templates-variables",
        label: "Variablen",
        description: "Platzhalter für Dokumenttypen",
        keywords: ["variable", "platzhalter", "placeholder", "feld", "field"],
        icon: Hash,
        tab: "templates",
      },
      {
        id: "clauses-manage",
        label: "Textbausteine verwalten",
        description: "Textbausteine erstellen und bearbeiten",
        keywords: ["klausel", "textbaustein", "clause", "baustein", "text", "absatz"],
        icon: BookOpen,
        tab: "clauses",
      },
      {
        id: "clauses-categories",
        label: "Textbaustein-Kategorien",
        description: "Kategorien für Textbausteine",
        keywords: ["kategorie", "category", "gruppe", "ordner"],
        icon: BookOpen,
        tab: "clauses",
      },
      {
        id: "form-fields",
        label: "Formularfelder",
        description: "Benutzerdefinierte Eingabefelder",
        keywords: ["formular", "feld", "eingabe", "input", "custom"],
        icon: FormInput,
        tab: "form-fields",
      },
      {
        id: "attachments",
        label: "Anlagen",
        description: "Standard-Anlagen verwalten",
        keywords: ["anlage", "attachment", "anhang", "datei", "file"],
        icon: Paperclip,
        tab: "attachments",
      },
    ],
  },
  {
    id: "design-layout",
    label: "Design & Layout",
    icon: Palette,
    items: [
      {
        id: "design-colors",
        label: "Farbschema",
        description: "Primär- und Akzentfarben anpassen",
        keywords: ["farbe", "color", "primaer", "akzent", "theme", "dunkel", "hell", "dark", "light"],
        icon: Paintbrush,
        tab: "design",
      },
      {
        id: "design-fonts",
        label: "Schriftarten",
        description: "Schriftart für Dokumente wählen",
        keywords: ["schrift", "font", "typography", "text", "arial", "times"],
        icon: Type,
        tab: "design",
      },
      {
        id: "design-layout",
        label: "Layout Einstellungen",
        description: "Kopf- und Fusszeilen, Raender",
        keywords: ["layout", "kopfzeile", "fusszeile", "header", "footer", "rand", "margin"],
        icon: Layout,
        tab: "design",
      },
      {
        id: "designer",
        label: "Layout-Editor",
        description: "Visueller Dokumenten-Designer",
        keywords: ["designer", "editor", "layout", "visuell", "drag", "drop"],
        icon: Layout,
        tab: "designer",
      },
      {
        id: "preview",
        label: "Vorschau",
        description: "Vorlagen-Vorschau testen",
        keywords: ["vorschau", "preview", "test", "ansicht"],
        icon: Eye,
        tab: "preview",
      },
    ],
  },
  {
    id: "verwaltung",
    label: "Verwaltung",
    icon: Users,
    items: [
      {
        id: "users",
        label: "Benutzerverwaltung",
        description: "Benutzer hinzufuegen, bearbeiten, loeschen",
        keywords: ["benutzer", "user", "mitarbeiter", "team", "rolle", "rechte"],
        icon: Users,
        tab: "users",
      },
      {
        id: "approvals",
        label: "Freigaben",
        description: "Genehmigungsworkflow und Freigaben",
        keywords: ["freigabe", "genehmigung", "approval", "workflow", "pruefen"],
        icon: CheckSquare,
        tab: "approvals",
      },
      {
        id: "works-council",
        label: "Betriebsrat",
        description: "Betriebsrats-Vorlagen",
        keywords: ["betriebsrat", "works", "council", "mitbestimmung"],
        icon: UserCheck,
        tab: "works-council",
      },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: Shield,
    items: [
      {
        id: "retention",
        label: "Aufbewahrung",
        description: "Aufbewahrungsfristen und -richtlinien",
        keywords: ["aufbewahrung", "retention", "frist", "archiv", "loeschen"],
        icon: Archive,
        tab: "retention",
      },
      {
        id: "audit",
        label: "Audit-Protokoll",
        description: "Aenderungshistorie und Logs",
        keywords: ["audit", "protokoll", "log", "historie", "aenderung", "tracking"],
        icon: Shield,
        tab: "audit",
      },
    ],
  },
  {
    id: "integrationen",
    label: "Integrationen",
    icon: Bot,
    items: [
      {
        id: "integrations",
        label: "Copilot Studio",
        description: "Microsoft Copilot Studio Integration",
        keywords: ["copilot", "microsoft", "integration", "bot", "ki", "ai"],
        icon: Bot,
        tab: "integrations",
      },
    ],
  },
];

// Quick actions that are always shown
const QUICK_ACTIONS = [
  {
    id: "search-all",
    label: "Alle Einstellungen durchsuchen",
    description: "Tippen Sie, um zu suchen...",
    icon: Search,
  },
  {
    id: "recent-documents",
    label: "Letzte Dokumente",
    description: "Kürzlich bearbeitete Dokumente",
    icon: Clock,
  },
  {
    id: "activity-log",
    label: "Aktivitäten",
    description: "Letzte Änderungen anzeigen",
    icon: Activity,
  },
];

interface SettingsCommandPaletteProps {
  /** Externally controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

export function SettingsCommandPalette({
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: SettingsCommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const navigate = useNavigate();

  // Use external control if provided, otherwise use internal state
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? externalOnOpenChange! : setInternalOpen;

  // Handle keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Cmd+K on Mac, Ctrl+K on Windows/Linux
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

  // Navigate to a settings item
  const handleSelect = useCallback(
    (item: SettingsItem) => {
      setOpen(false);
      navigate(`/settings?tab=${item.tab}`);
    },
    [navigate, setOpen]
  );

  // Handle quick action selection
  const handleQuickAction = useCallback(
    (actionId: string) => {
      setOpen(false);

      switch (actionId) {
        case "recent-documents":
          navigate("/documents");
          break;
        case "activity-log":
          navigate("/settings?tab=audit");
          break;
        default:
          // For search-all, just keep the palette open
          break;
      }
    },
    [navigate, setOpen]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Einstellung suchen... (z.B. Firmenname, Farben, Benutzer)" />
      <CommandList>
        <CommandEmpty>
          <div className="py-4 text-center">
            <p className="text-muted-foreground">Keine Einstellungen gefunden.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Versuchen Sie andere Suchbegriffe.
            </p>
          </div>
        </CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Schnellaktionen">
          {QUICK_ACTIONS.map((action) => (
            <CommandItem
              key={action.id}
              value={`${action.label} ${action.description}`}
              onSelect={() => handleQuickAction(action.id)}
            >
              <action.icon className="mr-2 h-4 w-4" />
              <div className="flex flex-col">
                <span>{action.label}</span>
                <span className="text-xs text-muted-foreground">
                  {action.description}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Settings Groups */}
        {SETTINGS_GROUPS.map((group) => (
          <CommandGroup key={group.id} heading={group.label}>
            {group.items.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.label} ${item.description} ${item.keywords.join(" ")}`}
                onSelect={() => handleSelect(item)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <div className="flex flex-col flex-1">
                  <span>{item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground capitalize">
                  {group.label}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>

      {/* Footer with keyboard hints */}
      <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
              <span className="text-xs">Enter</span>
            </kbd>
            <span>Öffnen</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
              <span className="text-xs">Esc</span>
            </kbd>
            <span>Schließen</span>
          </span>
        </div>
        <span className="flex items-center gap-1">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
            {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+K
          </kbd>
          <span>Öffnen</span>
        </span>
      </div>
    </CommandDialog>
  );
}

export default SettingsCommandPalette;
