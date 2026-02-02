/**
 * GlobalSearchDropdown - Live Search with Dropdown Results
 *
 * Features:
 * - Live search with debounce
 * - Dropdown with recent searches and results
 * - Keyboard navigation
 * - Document type filtering
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "use-debounce";
import {
    Search,
    FileCheck,
    Clock,
    ArrowRight,
    Loader2,
    History,
    X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useGlobalSearch, type SearchResult } from "@/hooks/useApi";

// =============================================================================
// Types
// =============================================================================

interface GlobalSearchDropdownProps {
    placeholder?: string;
    className?: string;
    inputClassName?: string;
}

// =============================================================================
// Constants
// =============================================================================

const RECENT_SEARCHES_KEY = "recent_searches";
const MAX_RECENT_SEARCHES = 5;
const MAX_RESULTS = 6;

// =============================================================================
// Helper Functions
// =============================================================================

const getRecentSearches = (): string[] => {
    try {
        const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

const addRecentSearch = (query: string): void => {
    try {
        const recent = getRecentSearches();
        const filtered = recent.filter((q) => q.toLowerCase() !== query.toLowerCase());
        const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
        // Ignore localStorage errors
    }
};

const removeRecentSearch = (query: string): void => {
    try {
        const recent = getRecentSearches();
        const filtered = recent.filter((q) => q !== query);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(filtered));
    } catch {
        // Ignore localStorage errors
    }
};

// =============================================================================
// Component
// =============================================================================

export function GlobalSearchDropdown({
    placeholder = "Suchen Sie nach etwas?",
    className,
    inputClassName,
}: GlobalSearchDropdownProps) {
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [query, setQuery] = useState("");
    const [debouncedQuery] = useDebounce(query, 300);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    // Fetch search results
    const {
        data: searchResponse,
        isLoading,
        isFetching,
    } = useGlobalSearch(debouncedQuery, {
        limit: MAX_RESULTS,
        enabled: debouncedQuery.length >= 2,
    });

    const results = searchResponse?.results ?? [];
    const hasResults = results.length > 0;
    const showLoading = isFetching && debouncedQuery.length >= 2;

    // Load recent searches on mount
    useEffect(() => {
        setRecentSearches(getRecentSearches());
    }, []);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Reset selected index when results change
    useEffect(() => {
        setSelectedIndex(-1);
    }, [results]);

    // Navigate to result
    const navigateToResult = useCallback(
        (result: SearchResult) => {
            const path =
                result.result_type === "draft"
                    ? `/generate?draft=${result.id}`
                    : `/documents/${result.id}`;
            navigate(path);
            setIsOpen(false);
            setQuery("");
        },
        [navigate]
    );

    // Navigate to search page
    const navigateToSearchPage = useCallback(
        (searchQuery: string) => {
            if (searchQuery.trim()) {
                addRecentSearch(searchQuery.trim());
                setRecentSearches(getRecentSearches());
                navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                setIsOpen(false);
                setQuery("");
            }
        },
        [navigate]
    );

    // Handle recent search click
    const handleRecentSearchClick = useCallback(
        (searchQuery: string) => {
            setQuery(searchQuery);
            navigateToSearchPage(searchQuery);
        },
        [navigateToSearchPage]
    );

    // Remove recent search
    const handleRemoveRecentSearch = useCallback(
        (e: React.MouseEvent, searchQuery: string) => {
            e.stopPropagation();
            removeRecentSearch(searchQuery);
            setRecentSearches(getRecentSearches());
        },
        []
    );

    // Handle keyboard navigation
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (!isOpen) {
                if (e.key === "ArrowDown" || e.key === "Enter") {
                    setIsOpen(true);
                }
                return;
            }

            const totalItems = hasResults
                ? results.length + 1 // Results + "Alle anzeigen"
                : recentSearches.length;

            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    setSelectedIndex((prev) =>
                        prev < totalItems - 1 ? prev + 1 : 0
                    );
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    setSelectedIndex((prev) =>
                        prev > 0 ? prev - 1 : totalItems - 1
                    );
                    break;
                case "Enter":
                    e.preventDefault();
                    if (hasResults) {
                        if (selectedIndex >= 0 && selectedIndex < results.length) {
                            navigateToResult(results[selectedIndex]);
                        } else if (selectedIndex === results.length || selectedIndex === -1) {
                            navigateToSearchPage(query);
                        }
                    } else if (recentSearches.length > 0 && selectedIndex >= 0) {
                        handleRecentSearchClick(recentSearches[selectedIndex]);
                    } else {
                        navigateToSearchPage(query);
                    }
                    break;
                case "Escape":
                    setIsOpen(false);
                    setSelectedIndex(-1);
                    inputRef.current?.blur();
                    break;
            }
        },
        [
            isOpen,
            hasResults,
            results,
            recentSearches,
            selectedIndex,
            query,
            navigateToResult,
            navigateToSearchPage,
            handleRecentSearchClick,
        ]
    );

    // Handle input focus
    const handleFocus = () => {
        setIsOpen(true);
    };

    // Handle input change
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        if (!isOpen) setIsOpen(true);
    };

    // Get result icon
    const getResultIcon = (result: SearchResult) => {
        if (result.result_type === "draft") {
            return <Clock className="w-4 h-4 text-amber-500" />;
        }
        return <FileCheck className="w-4 h-4 text-green-500" />;
    };

    // Get result label
    const getResultLabel = (result: SearchResult) => {
        if (result.result_type === "draft") {
            return "Entwurf";
        }
        return "Dokument";
    };

    const showDropdown = isOpen && (query.length >= 1 || recentSearches.length > 0);

    return (
        <div className={cn("relative", className)}>
            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    value={query}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    onKeyDown={handleKeyDown}
                    className={cn("pl-12 h-12 text-base pr-10", inputClassName)}
                    data-global-search
                />
                {showLoading && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
            </div>

            {/* Dropdown */}
            {showDropdown && (
                <div
                    ref={dropdownRef}
                    className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border shadow-lg z-50 overflow-hidden"
                >
                    {/* Results */}
                    {hasResults ? (
                        <div className="p-2">
                            <p className="px-3 py-1.5 text-xs text-muted-foreground font-medium">
                                Ergebnisse
                            </p>
                            <div className="space-y-1">
                                {results.map((result, index) => (
                                    <button
                                        key={`${result.result_type}-${result.id}`}
                                        onClick={() => navigateToResult(result)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                                            selectedIndex === index
                                                ? "bg-gray-100"
                                                : "hover:bg-gray-50"
                                        )}
                                    >
                                        <div className="p-2 bg-gray-50 rounded-lg">
                                            {getResultIcon(result)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">
                                                {result.document_type_name}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {result.employee_name && (
                                                    <span>{result.employee_name} • </span>
                                                )}
                                                <span>{getResultLabel(result)}</span>
                                            </p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-gray-300" />
                                    </button>
                                ))}
                            </div>

                            {/* Show all results link */}
                            <button
                                onClick={() => navigateToSearchPage(query)}
                                className={cn(
                                    "w-full flex items-center justify-between px-3 py-2.5 mt-1 rounded-lg transition-colors text-sm font-medium text-primary",
                                    selectedIndex === results.length
                                        ? "bg-primary/5"
                                        : "hover:bg-primary/5"
                                )}
                            >
                                <span>Alle Ergebnisse anzeigen</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    ) : query.length >= 2 && !isLoading ? (
                        /* No results */
                        <div className="p-6 text-center text-muted-foreground">
                            <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">Keine Ergebnisse gefunden</p>
                            <p className="text-xs mt-1">
                                Versuchen Sie andere Suchbegriffe
                            </p>
                        </div>
                    ) : recentSearches.length > 0 && query.length < 2 ? (
                        /* Recent searches */
                        <div className="p-2">
                            <p className="px-3 py-1.5 text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                                <History className="w-3 h-3" />
                                Letzte Suchen
                            </p>
                            <div className="space-y-0.5">
                                {recentSearches.map((search, index) => (
                                    <button
                                        key={search}
                                        onClick={() => handleRecentSearchClick(search)}
                                        className={cn(
                                            "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-colors text-left group",
                                            selectedIndex === index
                                                ? "bg-gray-100"
                                                : "hover:bg-gray-50"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Search className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm truncate">{search}</span>
                                        </div>
                                        <button
                                            onClick={(e) => handleRemoveRecentSearch(e, search)}
                                            className="p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                                            aria-label="Entfernen"
                                        >
                                            <X className="w-3 h-3 text-gray-400" />
                                        </button>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {/* Keyboard hint */}
                    {(hasResults || recentSearches.length > 0) && (
                        <div className="px-3 py-2 border-t bg-gray-50 text-[10px] text-muted-foreground flex items-center gap-3">
                            <span>
                                <kbd className="px-1.5 py-0.5 bg-white rounded border text-[10px]">↑↓</kbd> Navigieren
                            </span>
                            <span>
                                <kbd className="px-1.5 py-0.5 bg-white rounded border text-[10px]">Enter</kbd> Auswählen
                            </span>
                            <span>
                                <kbd className="px-1.5 py-0.5 bg-white rounded border text-[10px]">Esc</kbd> Schließen
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default GlobalSearchDropdown;
