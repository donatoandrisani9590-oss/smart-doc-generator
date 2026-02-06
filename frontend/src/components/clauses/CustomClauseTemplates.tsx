import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, BookOpen, Plus, Star, Trash2 } from "lucide-react";
import { useCustomClauseTemplates, useCreateCustomTemplate } from "@/hooks/useApi";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface CustomClauseTemplatesProps {
    countryCode: string;
    onInsert?: (content: string) => void;
}

export const CustomClauseTemplates = ({ countryCode, onInsert }: CustomClauseTemplatesProps) => {
    const { data, isLoading, refetch } = useCustomClauseTemplates(countryCode);
    const createTemplate = useCreateCustomTemplate();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newTemplate, setNewTemplate] = useState({
        title: "",
        content: "",
        category: "Individualvereinbarung",
    });

    const handleCreate = async () => {
        if (!newTemplate.title || !newTemplate.content) return;

        await createTemplate.mutateAsync({
            ...newTemplate,
            country_code: countryCode,
        });

        setNewTemplate({ title: "", content: "", category: "Individualvereinbarung" });
        setIsDialogOpen(false);
        refetch();
    };

    const handleUse = async (template: { id: number; content: string }) => {
        // Increment usage count
        await apiFetch(`/api/v1/custom-clauses/templates/${template.id}/use`, {
            method: "POST",
        });

        if (onInsert) {
            onInsert(template.content);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Vorlage wirklich löschen?")) return;

        await apiFetch(`/api/v1/custom-clauses/templates/${id}`, {
            method: "DELETE",
        });

        refetch();
    };

    const templates = data?.items || [];

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <BookOpen className="w-4 h-4" />
                        Meine Vorlagen
                    </CardTitle>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                                <Plus className="w-4 h-4 mr-1" />
                                Neu
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Neue Vorlage erstellen</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label>Titel</Label>
                                    <Input
                                        value={newTemplate.title}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })}
                                        placeholder="z.B. Homeoffice-Vereinbarung"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Kategorie</Label>
                                    <Input
                                        value={newTemplate.category}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                                        placeholder="Individualvereinbarung"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Inhalt</Label>
                                    <Textarea
                                        value={newTemplate.content}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                                        placeholder="Vertragstext hier eingeben..."
                                        rows={8}
                                    />
                                </div>
                                <Button
                                    onClick={handleCreate}
                                    disabled={createTemplate.isPending || !newTemplate.title || !newTemplate.content}
                                    className="w-full"
                                >
                                    {createTemplate.isPending ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Plus className="w-4 h-4 mr-2" />
                                    )}
                                    Vorlage speichern
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                ) : templates.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Noch keine eigenen Vorlagen gespeichert
                    </p>
                ) : (
                    <div className="space-y-2">
                        {templates.map((template: {
                            id: number;
                            title: string;
                            content: string;
                            category: string;
                            usage_count: number;
                        }) => (
                            <div
                                key={template.id}
                                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                            >
                                <div
                                    className="flex-1 cursor-pointer"
                                    onClick={() => handleUse(template)}
                                >
                                    <p className="font-medium text-sm">{template.title}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span>{template.category}</span>
                                        {template.usage_count > 0 && (
                                            <span className="flex items-center gap-1">
                                                <Star className="w-3 h-3" />
                                                {template.usage_count}x verwendet
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        handleDelete(template.id);
                                    }}
                                >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
