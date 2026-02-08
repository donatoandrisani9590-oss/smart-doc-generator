import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClauseEditor } from "@/components/admin/ClauseEditor";
import { AlertCircle, Info, Maximize2, Minimize2 } from "lucide-react";

interface ContentStepProps {
    content: string;
    setContent: (value: string) => void;
    countryCode: string;
    errors: Record<string, string>;
    touched: Record<string, boolean>;
}

export const ContentStep = ({
    content,
    setContent,
    countryCode,
    errors,
    touched,
}: ContentStepProps) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-medium text-foreground">Klauseltext bearbeiten</h3>
                    <p className="text-sm text-muted-foreground">
                        Verwenden Sie Platzhalter wie {"{{mitarbeiter_name}}"} für variable Felder
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpanded(!expanded)}
                        className="gap-1 text-xs"
                        title={expanded ? "Verkleinern" : "Vergrößern"}
                    >
                        {expanded ? (
                            <>
                                <Minimize2 className="w-3.5 h-3.5" />
                                Kompakt
                            </>
                        ) : (
                            <>
                                <Maximize2 className="w-3.5 h-3.5" />
                                Erweitern
                            </>
                        )}
                    </Button>
                    <Badge variant="outline" className="bg-primary/5">
                        {countryCode === "DE" ? "\u{1F1E9}\u{1F1EA} Deutsch" : "\u{1F1EE}\u{1F1F9} Italienisch"}
                    </Badge>
                </div>
            </div>

            <div style={{ minHeight: expanded ? "500px" : undefined }}>
                <ClauseEditor
                    content={content}
                    onChange={setContent}
                    countryCode={countryCode}
                    strictMode={true}
                />
            </div>

            {touched.content && errors.content && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.content}
                </p>
            )}

            {!expanded && (
                <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="py-3 px-4">
                        <div className="flex items-start gap-2">
                            <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-amber-800">
                                <strong>Hinweis:</strong> Die Platzhalter-Validierung erfolgt automatisch
                                beim Speichern. Tippfehler werden erkannt und Korrekturvorschläge angezeigt.
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
