import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileText, ChevronRight, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";

interface DocumentType {
    id: number;
    name: string;
    description?: string;
    country_code: string;
    is_active: boolean;
}

interface DocumentWizardDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const DocumentWizardDialog = ({
    open,
    onOpenChange,
}: DocumentWizardDialogProps) => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [types, setTypes] = useState<DocumentType[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (open && types.length === 0) {
            const loadTypes = async () => {
                setIsLoading(true);
                try {
                    const response = await api.get<DocumentType[]>("/api/v1/document-types/");
                    setTypes(response.data.filter((t) => t.is_active));
                } catch (error) {
                    logError("Failed to load document types", { error });
                } finally {
                    setIsLoading(false);
                }
            };
            loadTypes();
        }
    }, [open, types.length]);

    const filteredTypes = types.filter((t) =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelectType = (typeId: number) => {
        // Navigate to Composer with pre-selected type
        // The Composer will handle the actual draft creation / variant selection
        navigate(`/composer?type=${typeId}`);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-sm shadow-2xl border-white/20 p-0 overflow-hidden gap-0">
                <div className="p-6 border-b bg-gray-50/50">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Neues Dokument</DialogTitle>
                        <DialogDescription>
                            Was möchten Sie heute erstellen?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative mt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Suchen (z.B. Arbeitsvertrag, Kündigung)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto bg-white">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {filteredTypes.map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => handleSelectType(type.id)}
                                    className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50/30 hover:bg-primary/5 hover:border-primary/20 text-left transition-all group"
                                >
                                    <div className="p-2.5 bg-white rounded-lg shadow-sm border border-gray-100 group-hover:border-primary/20 group-hover:text-primary transition-colors">
                                        <FileText className="h-5 w-5 text-gray-500 group-hover:text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-gray-900 group-hover:text-primary truncate">
                                            {type.name}
                                        </div>
                                        {type.description && (
                                            <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                                                {type.description}
                                            </p>
                                        )}
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary/50 self-center" />
                                </button>
                            ))}
                            {filteredTypes.length === 0 && (
                                <div className="col-span-2 text-center py-8 text-muted-foreground">
                                    Keine Dokumenttypen gefunden.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-end">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Abbrechen
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
