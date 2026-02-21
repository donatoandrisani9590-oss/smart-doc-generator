/* eslint-disable react-hooks/static-components -- Icon is a stable Lucide component reference from lookup table */
import { useState, useEffect, useCallback } from "react";
import { ArrowRight, Sparkles, LayoutTemplate, ChevronDown, FileText } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { getCategoryIcon, translateCategory } from "./categoryIcons";

interface DocumentType {
    id: number;
    name: string;
    category?: string;
    description?: string | null;
    updated_at?: string | null;
}

interface UserTemplateOption {
    id: number;
    name: string;
    has_logo: boolean;
    has_header: boolean;
    has_footer: boolean;
    scope: string;
    category: string | null;
    is_own: boolean;
}

interface CreateDocumentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedType: DocumentType | null;
    onCreateManual: (title: string, templateId: number | null) => void;
    onCreateWithAI: (title: string, templateId: number | null) => void;
}

export function CreateDocumentDialog({
    open,
    onOpenChange,
    selectedType,
    onCreateManual,
    onCreateWithAI,
}: CreateDocumentDialogProps) {
    const [title, setTitle] = useState("");
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [userTemplates, setUserTemplates] = useState<UserTemplateOption[]>([]);
    const [templateSectionOpen, setTemplateSectionOpen] = useState(false);

    // Reset state when dialog opens with a new type
    useEffect(() => {
        if (open) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset form state when dialog opens
            setTitle("");
            setSelectedTemplateId(null);
            setTemplateSectionOpen(false);
        }
    }, [open]);

    // Fetch user templates once
    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const response = await apiFetch("/api/v1/user-templates");
                if (response.ok) {
                    const data = await response.json();
                    setUserTemplates(data.items || []);
                }
            } catch {
                // Templates are optional
            }
        };
        fetchTemplates();
    }, []);

    const handleCreate = useCallback(() => {
        if (!title.trim()) return;
        onCreateManual(title.trim(), selectedTemplateId);
    }, [title, selectedTemplateId, onCreateManual]);

    const handleCreateWithAI = useCallback(() => {
        if (!title.trim()) return;
        onCreateWithAI(title.trim(), selectedTemplateId);
    }, [title, selectedTemplateId, onCreateWithAI]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && title.trim()) {
                e.preventDefault();
                handleCreate();
            }
        },
        [handleCreate, title]
    );

    if (!selectedType) return null;

    const Icon = getCategoryIcon(selectedType.category);
    const ownTemplates = userTemplates.filter((t) => t.is_own);
    const sharedTemplates = userTemplates.filter((t) => !t.is_own);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-warm-50 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-[var(--text-tertiary)]" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-semibold text-[var(--text-primary)]">
                                {selectedType.name}
                            </DialogTitle>
                            {selectedType.category && (
                                <DialogDescription className="mt-0.5">
                                    <Badge
                                        variant="outline"
                                        className="text-[11px] font-normal text-[var(--text-tertiary)] border-warm-200"
                                    >
                                        {translateCategory(selectedType.category)}
                                    </Badge>
                                </DialogDescription>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                <Separator className="my-1" />

                <div className="space-y-4 py-2">
                    {/* Document Name Input */}
                    <div className="space-y-2">
                        <Label
                            htmlFor="dialog-document-title"
                            className="text-sm font-medium text-[var(--text-primary)]"
                        >
                            Dokumentname
                        </Label>
                        <Input
                            id="dialog-document-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="z.B. Arbeitsvertrag Max Müller"
                            className="h-11 rounded-xl"
                            autoFocus
                        />
                        <p className="text-xs text-[var(--text-tertiary)]">
                            Dieser Name erscheint in deiner Dokumentübersicht.
                        </p>
                    </div>

                    {/* Optional Template Selection */}
                    {userTemplates.length > 0 && (
                        <Collapsible
                            open={templateSectionOpen || !!selectedTemplateId}
                            onOpenChange={setTemplateSectionOpen}
                        >
                            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors group w-full">
                                <LayoutTemplate className="w-4 h-4" />
                                <span>Vorlage verwenden (optional)</span>
                                <ChevronDown
                                    className={cn(
                                        "w-3.5 h-3.5 transition-transform ml-auto",
                                        (templateSectionOpen || !!selectedTemplateId) &&
                                            "rotate-180"
                                    )}
                                />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-3 space-y-2">
                                <p className="text-xs text-[var(--text-tertiary)]">
                                    Verwende eine DOCX-Vorlage als Layout-Basis (mit Logo,
                                    Kopf-/Fußzeile).
                                </p>
                                <div className="grid gap-2">
                                    {/* No template option */}
                                    <button
                                        onClick={() => setSelectedTemplateId(null)}
                                        className={cn(
                                            "w-full text-left px-3 py-2.5 rounded-xl border transition-all text-sm",
                                            !selectedTemplateId
                                                ? "ring-2 ring-primary/30 bg-primary/5 border-primary/20 font-medium text-[var(--text-primary)]"
                                                : "border-warm-100 hover:border-warm-200 text-[var(--text-tertiary)]"
                                        )}
                                    >
                                        Standard-Layout (ohne Vorlage)
                                    </button>

                                    {/* Own templates */}
                                    {ownTemplates.length > 0 && (
                                        <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider pt-1">
                                            Eigene Vorlagen
                                        </div>
                                    )}
                                    {ownTemplates.map((template) => (
                                        <TemplateOptionButton
                                            key={template.id}
                                            template={template}
                                            isSelected={selectedTemplateId === template.id}
                                            onClick={() => setSelectedTemplateId(template.id)}
                                        />
                                    ))}

                                    {/* Shared templates */}
                                    {sharedTemplates.length > 0 && (
                                        <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider pt-1">
                                            Geteilte Vorlagen
                                        </div>
                                    )}
                                    {sharedTemplates.map((template) => (
                                        <TemplateOptionButton
                                            key={template.id}
                                            template={template}
                                            isSelected={selectedTemplateId === template.id}
                                            onClick={() => setSelectedTemplateId(template.id)}
                                        />
                                    ))}
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    )}
                </div>

                <DialogFooter className="flex-row gap-2 sm:justify-end">
                    <Button
                        onClick={handleCreate}
                        disabled={!title.trim()}
                        className="h-10 px-5 rounded-xl"
                    >
                        Erstellen
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleCreateWithAI}
                        disabled={!title.trim()}
                        className="h-10 px-5 rounded-xl text-primary/70 border-primary/20 hover:bg-primary/5"
                    >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Mit KI erstellen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// --- Internal sub-component ---

function TemplateOptionButton({
    template,
    isSelected,
    onClick,
}: {
    template: UserTemplateOption;
    isSelected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full text-left px-3 py-2.5 rounded-xl border transition-all",
                isSelected
                    ? "ring-2 ring-primary/30 bg-primary/5 border-primary/20"
                    : "border-warm-100 hover:border-warm-200"
            )}
        >
            <div className="flex items-center gap-2">
                <FileText
                    className={cn(
                        "w-4 h-4 shrink-0",
                        isSelected ? "text-primary" : "text-warm-400"
                    )}
                />
                <span
                    className={cn(
                        "text-sm truncate",
                        isSelected ? "font-medium text-[var(--text-primary)]" : "text-[var(--text-primary)]"
                    )}
                >
                    {template.name}
                </span>
                <div className="flex gap-1 ml-auto shrink-0">
                    {template.has_logo && (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1">
                            Logo
                        </Badge>
                    )}
                    {template.has_header && (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1">
                            Kopf
                        </Badge>
                    )}
                    {template.has_footer && (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1">
                            Fuß
                        </Badge>
                    )}
                    {template.category && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1">
                            {template.category}
                        </Badge>
                    )}
                </div>
            </div>
        </button>
    );
}
