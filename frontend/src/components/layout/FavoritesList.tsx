/**
 * FavoritesList - Sidebar component showing user's favorite document types.
 *
 * Displays a collapsible list of favorites with quick links to create documents.
 */

import { Star, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useFavorites } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

export const FavoritesList = () => {
    const [isExpanded, setIsExpanded] = useState(true);
    const { data: favorites, isLoading } = useFavorites("document_type");

    // Only show if there are favorites
    if (!isLoading && (!favorites || favorites.length === 0)) {
        return null;
    }

    return (
        <div className="px-3 py-2">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
                <span className="flex items-center gap-2">
                    <Star className="w-3 h-3" />
                    Favoriten
                </span>
                {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                ) : (
                    <ChevronRight className="w-3 h-3" />
                )}
            </button>

            {/* Favorites List */}
            {isExpanded && (
                <div className="mt-1 space-y-0.5">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-2">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        favorites?.map((fav) => (
                            <Link
                                key={fav.id}
                                to={`/generate?document_type=${fav.document_type_id}`}
                                className={cn(
                                    "flex items-center gap-2 px-2 py-1.5 text-sm rounded-md",
                                    "text-muted-foreground hover:text-foreground",
                                    "hover:bg-muted/50 transition-colors"
                                )}
                            >
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                <span className="truncate">{fav.resolved_name}</span>
                            </Link>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
