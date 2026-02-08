/**
 * ConditionTester - Test/simulate conditions with custom values
 *
 * Provides a UI to enter test values and evaluate whether
 * the condition would be satisfied.
 */

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    CheckCircle2,
    X,
    Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { evaluateCondition } from "./condition-logic";
import { getConditionFields } from "./serialization";
import { getFieldInfo } from "./utils";
import type { ConditionTesterProps, TestValues } from "./types";

export const ConditionTester = ({ condition, fields, onClose }: ConditionTesterProps) => {
    const usedFields = useMemo(() => getConditionFields(condition), [condition]);
    const [testValues, setTestValues] = useState<TestValues>({});
    const [result, setResult] = useState<boolean | null>(null);

    // Initialize test values
    useEffect(() => {
        const initial: TestValues = {};
        usedFields.forEach((fieldName) => {
            const field = getFieldInfo(fieldName, fields);
            if (field) {
                if (field.type === "boolean") initial[fieldName] = false;
                else if (field.type === "number") initial[fieldName] = 0;
                else initial[fieldName] = "";
            }
        });
        setTestValues(initial);
    }, [usedFields, fields]);

    const handleTest = () => {
        const testResult = evaluateCondition(condition, testValues, fields);
        setResult(testResult);
    };

    const handleValueChange = (fieldName: string, value: string | number | boolean) => {
        setTestValues((prev) => ({ ...prev, [fieldName]: value }));
        setResult(null);
    };

    return (
        <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
                Geben Sie Testwerte ein, um zu prüfen, ob die Bedingung erfüllt wird:
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {usedFields.map((fieldName) => {
                    const field = getFieldInfo(fieldName, fields);
                    if (!field) return null;

                    return (
                        <div key={fieldName} className="flex items-center gap-3">
                            <Label className="w-1/3 text-sm truncate">{field.label}:</Label>
                            <div className="flex-1">
                                {field.type === "boolean" ? (
                                    <Select
                                        value={testValues[fieldName] === true ? "true" : "false"}
                                        onValueChange={(v) => handleValueChange(fieldName, v === "true")}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="true">Ja</SelectItem>
                                            <SelectItem value="false">Nein</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : field.type === "select" ? (
                                    <Select
                                        value={String(testValues[fieldName] || "")}
                                        onValueChange={(v) => handleValueChange(fieldName, v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Wählen..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {field.options?.map((opt) => (
                                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : field.type === "number" ? (
                                    <Input
                                        type="number"
                                        value={testValues[fieldName] as number}
                                        onChange={(e) => handleValueChange(fieldName, Number(e.target.value))}
                                        placeholder="0"
                                    />
                                ) : (
                                    <Input
                                        type="text"
                                        value={testValues[fieldName] as string}
                                        onChange={(e) => handleValueChange(fieldName, e.target.value)}
                                        placeholder="..."
                                    />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {usedFields.length === 0 && (
                <div className="text-center text-muted-foreground py-4">
                    Keine Felder in der Bedingung definiert.
                </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="outline" onClick={onClose}>
                    Schließen
                </Button>
                <Button onClick={handleTest} disabled={usedFields.length === 0}>
                    <Play className="w-4 h-4 mr-2" />
                    Testen
                </Button>
            </div>

            {result !== null && (
                <div className={cn(
                    "p-4 rounded-lg border-2 flex items-center gap-3",
                    result
                        ? "bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-700"
                        : "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-700"
                )}>
                    {result ? (
                        <>
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                            <div>
                                <p className="font-medium text-green-800 dark:text-green-200">Bedingung erfüllt!</p>
                                <p className="text-sm text-green-700 dark:text-green-300">Die Klausel wird angezeigt.</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <X className="w-6 h-6 text-red-600" />
                            <div>
                                <p className="font-medium text-red-800 dark:text-red-200">Bedingung nicht erfüllt</p>
                                <p className="text-sm text-red-700 dark:text-red-300">Die Klausel wird ausgeblendet.</p>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
