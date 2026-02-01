/**
 * Search Page - Globale Suche
 *
 * UX-Refactoring: Einfache, schnelle Suche
 * - Große Suchleiste
 * - Kompakte Ergebnisse
 * - Minimale Filter
 */

import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useDebounce } from "use-debounce";
import {
    Search as SearchIcon,
    FileCheck,
    Clock,
    ArrowRight,
    X,
    Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useGlobalSearch, useDocumentTypes, type SearchResult } from "@/hooks/useApi";
import { formatDistanceToNow } from "@/lib/dateUtils";

export const SearchPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialQuery = searchParams.get("q") || "";

    const [query, setQuery] = useState(initialQuery);
    const [debouncedQuery] = useDebounce(query, 300);
    const [resultType, setResultType] = useState<"document" | "draft" | undefined>(undefined);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [documentTypeId, setDocumentTypeId] = useState<string>("");
    const [sortBy, setSortBy] = useState<string>("relevance");

    const { data: documentTypes } = useDocumentTypes();

    const {
        data: searchResponse,
        isLoading,
        isFetching,
    } = useGlobalSearch(debouncedQuery, {
        resultType,
        limit: 50,
    });

    // Filter results locally for additional filters
    const filteredResults = searchResponse?.results?.filter((result) => {
        // Document type filter
        if (documentTypeId && result.document_type_name !== documentTypes?.find((dt: any) => dt.id === parseInt(documentTypeId))?.name) {
            return false;
        }

        // Date filters
        const resultDate = result.result_type === "draft" ? result.updated_at : result.created_at;
        if (resultDate) {
            const date = new Date(resultDate);
            if (dateFrom && date < new Date(dateFrom)) return false;
            if (dateTo && date > new Date(dateTo + "T23:59:59")) return false;
        }

        return true;
    }) ?? [];

    // Sort results
    const sortedResults = [...filteredResults].sort((a, b) => {
        if (sortBy === "date_desc") {
            const dateA = new Date(a.result_type === "draft" ? a.updated_at || "" : a.created_at || "");
            const dateB = new Date(b.result_type === "draft" ? b.updated_at || "" : b.created_at || "");
            return dateB.getTime() - dateA.getTime();
        }
        if (sortBy === "date_asc") {
            const dateA = new Date(a.result_type === "draft" ? a.updated_at || "" : a.created_at || "");
            const dateB = new Date(b.result_type === "draft" ? b.updated_at || "" : b.created_at || "");
            return dateA.getTime() - dateB.getTime();
        }
        if (sortBy === "name") {
            return (a.employee_name || "").localeCompare(b.employee_name || "");
        }
        // Default: relevance (original order)
        return 0;
    });

    const handleQueryChange = (value: string) => {
        setQuery(value);
        if (value) {
            setSearchParams({ q: value });
        } else {
            setSearchParams({});
        }
    };

    const clearSearch = () => {
        setQuery("");
        setSearchParams({});
    };

    const clearFilters = () => {
        setResultType(undefined);
        setDateFrom("");
        setDateTo("");
        setDocumentTypeId("");
        setSortBy("relevance");
    };

    const hasActiveFilters = resultType || dateFrom || dateTo || documentTypeId || sortBy !== "relevance";

    const renderResultIcon = (result: SearchResult) => {
        if (result.result_type === "draft") {
            return <Clock className="w-5 h-5 text-amber-500" />;
        }
        return <FileCheck className="w-5 h-5 text-green-500" />;
    };

    const getResultLink = (result: SearchResult) => {
        if (result.result_type === "draft") {
            return `/generate?draft=${result.id}`;
        }
        return `/documents/${result.id}`;
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header - Einfach und klar */}
            <div className="text-center">
                <h1 className="text-3xl font-bold tracking-tight">Suche</h1>
                <p className="text-muted-foreground">
                    Finden Sie Dokumente und Entwürfe
                </p>
            </div>

            {/* Große Suchleiste */}
            <Card className="p-2">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Name, Dokumenttyp, Personalnummer..."
                            value={query}
                            onChange={(e) => handleQueryChange(e.target.value)}
                            className="pl-12 pr-10 h-14 text-lg border-0 focus-visible:ring-0"
                            autoFocus
                        />
                        {query && (
                            <button
                                onClick={clearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
                            >
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        )}
                    </div>

                    {/* Kompakter Filter */}
                    <Select
                        value={resultType || "all"}
                        onValueChange={(v) => setResultType(v === "all" ? undefined : (v as "document" | "draft"))}
                    >
                        <SelectTrigger className="w-[140px] h-14 border-0">
                            <SelectValue placeholder="Alle" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Alle</SelectItem>
                            <SelectItem value="document">Dokumente</SelectItem>
                            <SelectItem value="draft">Entwürfe</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        variant={showAdvanced ? "default" : "ghost"}
                        className="h-14 px-4"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                        <Filter className="w-4 h-4" />
                    </Button>
                </div>
            </Card>

            {/* Advanced Filters */}
            {showAdvanced && (
                <Card>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Document Type */}
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1 block">
                                    Dokumenttyp
                                </label>
                                <Select
                                    value={documentTypeId || "all"}
                                    onValueChange={(v) => setDocumentTypeId(v === "all" ? "" : v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Alle Typen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Alle Typen</SelectItem>
                                        {documentTypes?.map((dt: any) => (
                                            <SelectItem key={dt.id} value={String(dt.id)}>
                                                {dt.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Date From */}
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1 block">
                                    Von Datum
                                </label>
                                <Input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                />
                            </div>

                            {/* Date To */}
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1 block">
                                    Bis Datum
                                </label>
                                <Input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                />
                            </div>

                            {/* Sort */}
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1 block">
                                    Sortierung
                                </label>
                                <Select value={sortBy} onValueChange={setSortBy}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="relevance">Relevanz</SelectItem>
                                        <SelectItem value="date_desc">Neueste zuerst</SelectItem>
                                        <SelectItem value="date_asc">Älteste zuerst</SelectItem>
                                        <SelectItem value="name">Name (A-Z)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Clear Filters */}
                        {hasActiveFilters && (
                            <div className="mt-4 pt-4 border-t flex justify-end">
                                <Button variant="ghost" size="sm" onClick={clearFilters}>
                                    <X className="w-4 h-4 mr-2" />
                                    Filter zurücksetzen
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Ergebnisse */}
            {isLoading || isFetching ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-lg" />
                    ))}
                </div>
            ) : debouncedQuery.length < 2 ? (
                <div className="text-center py-16">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                        <SearchIcon className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-medium mb-2">Was suchen Sie?</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto">
                        Geben Sie mindestens 2 Zeichen ein
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                        <span className="px-4 py-2 bg-muted rounded-full text-sm">Mitarbeitername</span>
                        <span className="px-4 py-2 bg-muted rounded-full text-sm">Dokumenttyp</span>
                        <span className="px-4 py-2 bg-muted rounded-full text-sm">Personalnummer</span>
                    </div>
                </div>
            ) : sortedResults.length === 0 ? (
                <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                        <SearchIcon className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Keine Treffer</h3>
                    <p className="text-muted-foreground mb-4">
                        Für "{debouncedQuery}" wurde nichts gefunden.
                    </p>
                    {hasActiveFilters && (
                        <Button variant="outline" onClick={clearFilters}>
                            Filter zurücksetzen
                        </Button>
                    )}
                </div>
            ) : searchResponse ? (
                <div className="space-y-3">
                    {/* Ergebnis-Header */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground px-2">
                        <span>{sortedResults.length} Ergebnisse</span>
                    </div>

                    {/* Ergebnisliste - Modern & Kompakt */}
                    <div className="space-y-2">
                        {sortedResults.map((result) => (
                            <Link key={`${result.result_type}-${result.id}`} to={getResultLink(result)}>
                                <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 hover:border-primary/30 transition-all group">
                                    {/* Icon */}
                                    <div className={`p-2 rounded-lg ${
                                        result.result_type === "draft"
                                            ? "bg-amber-50 group-hover:bg-amber-100"
                                            : "bg-green-50 group-hover:bg-green-100"
                                    }`}>
                                        {renderResultIcon(result)}
                                    </div>

                                    {/* Inhalt */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium truncate">
                                                {result.document_type_name}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                result.result_type === "draft"
                                                    ? "bg-amber-100 text-amber-700"
                                                    : "bg-green-100 text-green-700"
                                            }`}>
                                                {result.result_type === "draft" ? "Entwurf" : "Dokument"}
                                            </span>
                                        </div>
                                        {result.employee_name && (
                                            <p className="text-sm text-muted-foreground truncate">
                                                {result.employee_name}
                                            </p>
                                        )}
                                    </div>

                                    {/* Datum */}
                                    <span className="text-sm text-muted-foreground">
                                        {result.result_type === "draft" && result.updated_at
                                            ? formatDistanceToNow(result.updated_at)
                                            : result.created_at
                                                ? formatDistanceToNow(result.created_at)
                                                : ""}
                                    </span>

                                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
};
