/**
 * FavoriteButton - Star/Heart button to toggle favorites.
 *
 * Can be used on document types and documents to add/remove from favorites.
 */

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToggleFavorite, useCheckFavorite } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
    favoriteType: "document_type" | "document";
    itemId: number;
    displayName?: string;
    size?: "sm" | "md" | "lg";
    className?: string;
}

export const FavoriteButton = ({
    favoriteType,
    itemId,
    displayName,
    size = "md",
    className,
}: FavoriteButtonProps) => {
    const { data: checkResult, isLoading: checking } = useCheckFavorite(favoriteType, itemId);
    const toggleMutation = useToggleFavorite();

    const isFavorite = checkResult?.is_favorite ?? false;
    const isLoading = checking || toggleMutation.isPending;

    const sizeClasses = {
        sm: "h-6 w-6 p-0",
        md: "h-8 w-8 p-0",
        lg: "h-10 w-10 p-0",
    };

    const iconSizes = {
        sm: "w-3 h-3",
        md: "w-4 h-4",
        lg: "w-5 h-5",
    };

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        await toggleMutation.mutateAsync({
            favorite_type: favoriteType,
            document_type_id: favoriteType === "document_type" ? itemId : undefined,
            document_id: favoriteType === "document" ? itemId : undefined,
            display_name: displayName,
        });
    };

    return (
        <Button
            variant="ghost"
            size="sm"
            className={cn(
                sizeClasses[size],
                "hover:bg-amber-50 dark:hover:bg-amber-950/30",
                className
            )}
            onClick={handleClick}
            disabled={isLoading}
            title={isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
        >
            <Star
                className={cn(
                    iconSizes[size],
                    "transition-all",
                    isFavorite
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground hover:text-amber-400"
                )}
            />
        </Button>
    );
};
