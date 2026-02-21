/**
 * QuickAccessTiles Component (16.2)
 *
 * Quick access tiles for common actions:
 * - Create new document (by type)
 * - Access favorites
 * - Recent document types
 */

import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDocumentTypes, useFavorites, type DocumentType, type Favorite } from "@/hooks/useApi";
import {
    FileText,
    Star,
    Clock,
    ArrowRight,
    Loader2,
    PlusCircle,
    Briefcase,
    FileCheck,
    Users,
    Zap,
    FileUp,
} from "lucide-react";

// Icon map for document type categories
const categoryIcons: Record<string, React.ElementType> = {
    "Arbeitsverträge": Briefcase,
    "Bescheinigungen": FileCheck,
    "Formulare": FileText,
    "Personal": Users,
    default: FileText,
};

export const QuickAccessTiles = () => {
    const { data: documentTypes, isLoading: loadingTypes } = useDocumentTypes();
    const { data: favorites, isLoading: loadingFavorites } = useFavorites("document_type");

    const topTypes = (documentTypes || []).slice(0, 4);
    const hasFavorites = favorites && favorites.length > 0;

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Schnellzugriff
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Favorites Section */}
                {loadingFavorites ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Lade Favoriten...</span>
                    </div>
                ) : hasFavorites ? (
                    <div>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            Favoriten
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            {favorites.slice(0, 4).map((fav: Favorite) => {
                                return (
                                    <Link
                                        key={fav.id}
                                        to={`/generate?type=${fav.document_type_id}`}
                                        className="flex items-center gap-2 p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors group"
                                        title={fav.resolved_name}
                                    >
                                        <div className="p-1.5 bg-yellow-100 rounded group-hover:bg-yellow-200 transition-colors flex-shrink-0">
                                            <Star className="w-3 h-3 text-yellow-600" />
                                        </div>
                                        <span className="text-sm font-medium truncate">
                                            {fav.resolved_name}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ) : null}

                {/* Document Types */}
                <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        Dokument erstellen
                    </h4>
                    {loadingTypes ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {topTypes.map((type: DocumentType) => {
                                const Icon = categoryIcons[type.category || ""] || categoryIcons.default;
                                return (
                                    <Link
                                        key={type.id}
                                        to={`/generate?type=${type.id}`}
                                        className="flex items-center gap-2 p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors group"
                                        title={type.name}
                                    >
                                        <div className="p-1.5 bg-primary/10 rounded group-hover:bg-primary/20 transition-colors flex-shrink-0">
                                            <Icon className="w-3 h-3 text-primary" />
                                        </div>
                                        <span className="text-sm font-medium truncate">
                                            {type.name}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="pt-2 border-t">
                    <div className="flex flex-wrap gap-2">
                        <Link to="/generate">
                            <Button variant="outline" size="sm" className="gap-2">
                                <PlusCircle className="w-4 h-4" />
                                Neu
                            </Button>
                        </Link>
                        <Link to="/templates">
                            <Button variant="outline" size="sm" className="gap-2 text-primary border-primary/30 hover:bg-primary/5">
                                <FileUp className="w-4 h-4" />
                                Word importieren
                            </Button>
                        </Link>
                        <Link to="/documents">
                            <Button variant="outline" size="sm" className="gap-2">
                                <Clock className="w-4 h-4" />
                                Archiv
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* All Types Link */}
                <Link
                    to="/generate"
                    className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors pt-2"
                >
                    Alle Dokumenttypen anzeigen
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </CardContent>
        </Card>
    );
};
