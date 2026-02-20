import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CheckCircle } from "lucide-react";
import type { AssignedClause } from "./types";

/** Simple condition format used by this legacy editor */
interface SimpleConditionValue {
    field: string;
    operator: "=" | "!=" | ">" | "<" | "contains";
    value: string;
}

interface ConditionEditorProps {
    clause: AssignedClause;
    placeholders: string[];
    onSave: (condition: SimpleConditionValue | null) => void;
    onCancel: () => void;
}

// Condition Editor Component
export const ConditionEditor = ({
    clause,
    placeholders,
    onSave,
    onCancel,
}: ConditionEditorProps) => {
    // Cast condition to simple format for this legacy editor
    const simpleCondition = clause.condition as SimpleConditionValue | null | undefined;
    const [enabled, setEnabled] = useState(!!clause.condition);
    const [field, setField] = useState(simpleCondition?.field || "");
    const [operator, setOperator] = useState<SimpleConditionValue["operator"]>(
        simpleCondition?.operator || "="
    );
    const [value, setValue] = useState<string>(
        String(simpleCondition?.value || "")
    );

    const handleSave = () => {
        if (!enabled) {
            onSave(null);
        } else if (field && value) {
            onSave({ field, operator, value });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
                <Label>Bedingung aktivieren</Label>
            </div>

            {enabled && (
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                    <div className="space-y-2">
                        <Label>Zeige Textbaustein wenn Feld...</Label>
                        <Select value={field} onValueChange={setField}>
                            <SelectTrigger>
                                <SelectValue placeholder="Feld wählen" />
                            </SelectTrigger>
                            <SelectContent>
                                {placeholders.map((p) => (
                                    <SelectItem key={p} value={p}>
                                        {p}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Operator</Label>
                        <Select
                            value={operator}
                            onValueChange={(v) => setOperator(v as SimpleConditionValue["operator"])}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="=">ist gleich (=)</SelectItem>
                                <SelectItem value="!=">ist nicht gleich (!=)</SelectItem>
                                <SelectItem value=">">größer als (&gt;)</SelectItem>
                                <SelectItem value="<">kleiner als (&lt;)</SelectItem>
                                <SelectItem value="contains">enthält</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Wert</Label>
                        <Input
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="Vergleichswert eingeben"
                        />
                    </div>

                    <div className="p-3 bg-card rounded border border-border text-sm">
                        <span className="text-muted-foreground">Vorschau: </span>
                        {field ? (
                            <span>
                                Zeige "{clause.title}" wenn{" "}
                                <code className="font-mono text-primary bg-primary/10 px-1 rounded">
                                    {field}
                                </code>{" "}
                                <span className="font-medium">{operator}</span>{" "}
                                <code className="font-mono text-primary bg-primary/10 px-1 rounded">
                                    {value || "..."}
                                </code>
                            </span>
                        ) : (
                            <span className="text-muted-foreground italic">
                                Wähle ein Feld aus
                            </span>
                        )}
                    </div>
                </div>
            )}

            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>
                    Abbrechen
                </Button>
                <Button onClick={handleSave}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Speichern
                </Button>
            </DialogFooter>
        </div>
    );
};
