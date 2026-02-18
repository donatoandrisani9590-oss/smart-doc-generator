/**
 * Bulk Upload Page - Massen-Generierung
 *
 * UX-Refactoring: Vereinfachter Wizard-Ansatz
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useDocumentTypes, type DocumentType } from "@/hooks/useApi";
import { BulkUploadValidator } from "@/components/bulk/BulkUploadValidator";
import { Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";

export const BulkUploadPage = () => {
    const [selectedDocTypeId, setSelectedDocTypeId] = useState<number | null>(null);
    const { data: documentTypes, isLoading } = useDocumentTypes();

    const selectedDocType = documentTypes?.find((dt: DocumentType) => dt.id === selectedDocTypeId);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header - Modern */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Massen-Generierung</h1>
                    <p className="text-muted-foreground text-lg">
                        Mehrere Dokumente auf einmal erstellen
                    </p>
                </div>
                <Link to="/generate">
                    <Button variant="ghost">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Zurück
                    </Button>
                </Link>
            </div>

            {/* Schritt 1: Dokumenttyp */}
            <Card className={selectedDocTypeId ? "border-primary/30" : ""}>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-3">
                        <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                            selectedDocTypeId
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                        }`}>
                            1
                        </span>
                        Dokumenttyp wählen
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Select
                        value={selectedDocTypeId?.toString() || ""}
                        onValueChange={(value) => setSelectedDocTypeId(parseInt(value))}
                        disabled={isLoading}
                    >
                        <SelectTrigger className="w-full h-12 text-base">
                            <SelectValue placeholder="Dokumenttyp auswählen..." />
                        </SelectTrigger>
                        <SelectContent>
                            {documentTypes?.map((dt: DocumentType) => (
                                <SelectItem key={dt.id} value={String(dt.id)}>
                                    {dt.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {/* Schritt 2: Datei hochladen */}
            {selectedDocTypeId && selectedDocType ? (
                <Card className="border-primary/30">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-3">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                                2
                            </span>
                            Datei hochladen
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <BulkUploadValidator
                            documentTypeId={selectedDocTypeId}
                            documentTypeName={selectedDocType.name}
                        />
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-dashed bg-muted/20">
                    <CardContent className="py-16 text-center">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                            <FileSpreadsheet className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-medium mb-2">Dokumenttyp wählen</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto">
                            Wählen Sie oben einen Dokumenttyp aus
                        </p>
                        <div className="flex items-center justify-center gap-3 mt-8">
                            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-full text-sm">
                                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">1</span>
                                Typ wählen
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-full text-sm text-muted-foreground">
                                <Upload className="w-4 h-4" />
                                Datei hochladen
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-full text-sm text-muted-foreground">
                                <Sparkles className="w-4 h-4" />
                                Generieren
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default BulkUploadPage;
