import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Layers, Plus, Loader2, AlertCircle } from "lucide-react";

const API_BASE = "/api/v1";

interface CreateGroupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    countryCode: string;
    onSuccess: () => void;
}

export const CreateGroupDialog = ({
    open,
    onOpenChange,
    countryCode,
    onSuccess,
}: CreateGroupDialogProps) => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!name.trim()) {
            setError("Name ist erforderlich");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const res = await apiFetch(`${API_BASE}/clause-variants/groups`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    description,
                    category,
                    country_code: countryCode,
                }),
            });

            if (!res.ok) {
                throw new Error("Fehler beim Erstellen der Gruppe");
            }

            setName("");
            setDescription("");
            setCategory("");
            onSuccess();
            onOpenChange(false);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-primary" />
                        Neue Varianten-Gruppe
                    </DialogTitle>
                    <DialogDescription>
                        Gruppiere ähnliche Textbausteine mit unterschiedlichen Ausprägungen
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name der Gruppe *</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="z.B. Kündigungsfristen"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Beschreibung</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Wann werden welche Varianten verwendet?"
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category">Kategorie</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder="Kategorie wählen" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Arbeitsrecht">Arbeitsrecht</SelectItem>
                                <SelectItem value="Vergütung">Vergütung</SelectItem>
                                <SelectItem value="Arbeitszeit">Arbeitszeit</SelectItem>
                                <SelectItem value="Kündigung">Kündigung</SelectItem>
                                <SelectItem value="Benefits">Benefits</SelectItem>
                                <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="bg-primary hover:bg-primary/90"
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4 mr-2" />
                        )}
                        Gruppe erstellen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
