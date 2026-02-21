/**
 * Skeleton Components - Loading Placeholders
 *
 * Provides visual placeholders while content is loading.
 * Improves perceived performance and prevents layout shifts.
 */

import { cn } from "@/lib/utils";

interface SkeletonProps {
    className?: string;
}

/**
 * Basic skeleton element with pulse animation
 */
export function Skeleton({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                "skeleton-shimmer rounded-md",
                className
            )}
            aria-hidden="true"
        />
    );
}

/**
 * Skeleton for text lines
 */
export function SkeletonText({ className, lines = 1 }: SkeletonProps & { lines?: number }) {
    return (
        <div className={cn("space-y-2", className)} aria-hidden="true">
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    className={cn(
                        "h-4",
                        i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"
                    )}
                />
            ))}
        </div>
    );
}

/**
 * Skeleton for avatar/profile images
 */
export function SkeletonAvatar({ className, size = "md" }: SkeletonProps & { size?: "sm" | "md" | "lg" }) {
    const sizeClasses = {
        sm: "w-8 h-8",
        md: "w-10 h-10",
        lg: "w-12 h-12",
    };

    return (
        <Skeleton
            className={cn("rounded-full", sizeClasses[size], className)}
        />
    );
}

/**
 * Skeleton for cards
 */
export function SkeletonCard({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                "rounded-lg border bg-card p-4 space-y-3",
                className
            )}
            aria-hidden="true"
        >
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
        </div>
    );
}

/**
 * Skeleton for stat cards (Dashboard)
 */
export function SkeletonStatCard({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                "rounded-lg border bg-card p-4",
                className
            )}
            aria-hidden="true"
        >
            <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
            </div>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
        </div>
    );
}

/**
 * Skeleton for table rows
 */
export function SkeletonTableRow({ columns = 5, className }: SkeletonProps & { columns?: number }) {
    return (
        <tr className={cn("border-b", className)} aria-hidden="true">
            {Array.from({ length: columns }).map((_, i) => (
                <td key={i} className="p-3">
                    <Skeleton className={cn("h-4", i === 0 ? "w-8" : "w-full")} />
                </td>
            ))}
        </tr>
    );
}

/**
 * Skeleton for document list items
 */
export function SkeletonDocumentRow({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                "flex items-center gap-4 p-4 border-b",
                className
            )}
            aria-hidden="true"
        >
            <Skeleton className="w-4 h-4" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-6 w-12 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-8" />
        </div>
    );
}

/**
 * Skeleton for team list items
 */
export function SkeletonTeamItem({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                "p-3 rounded-lg border",
                className
            )}
            aria-hidden="true"
        >
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-4" />
            </div>
        </div>
    );
}

/**
 * Skeleton for deadline items
 */
export function SkeletonDeadlineItem({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                "rounded-lg border p-4",
                className
            )}
            aria-hidden="true"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right space-y-1">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                    <div className="flex gap-1">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Skeleton for search results
 */
export function SkeletonSearchResult({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                "flex items-center gap-4 p-4 rounded-lg border",
                className
            )}
            aria-hidden="true"
        >
            <Skeleton className="w-5 h-5 rounded" />
            <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-24" />
            </div>
            <div className="text-right space-y-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="w-4 h-4" />
        </div>
    );
}

/**
 * Compound skeleton for Dashboard stats grid
 */
export function SkeletonDashboardStats() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Lade Statistiken...">
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <span className="sr-only">Statistiken werden geladen...</span>
        </div>
    );
}

/**
 * Compound skeleton for Repository table
 */
export function SkeletonRepositoryTable({ rows = 5 }: { rows?: number }) {
    return (
        <div role="status" aria-label="Lade Dokumente...">
            <div className="space-y-0">
                {Array.from({ length: rows }).map((_, i) => (
                    <SkeletonDocumentRow key={i} />
                ))}
            </div>
            <span className="sr-only">Dokumente werden geladen...</span>
        </div>
    );
}

/**
 * Compound skeleton for Teams list
 */
export function SkeletonTeamsList({ items = 3 }: { items?: number }) {
    return (
        <div className="space-y-2" role="status" aria-label="Lade Teams...">
            {Array.from({ length: items }).map((_, i) => (
                <SkeletonTeamItem key={i} />
            ))}
            <span className="sr-only">Teams werden geladen...</span>
        </div>
    );
}

/**
 * Compound skeleton for Deadlines list
 */
export function SkeletonDeadlinesList({ items = 3 }: { items?: number }) {
    return (
        <div className="space-y-3" role="status" aria-label="Lade Fristen...">
            {Array.from({ length: items }).map((_, i) => (
                <SkeletonDeadlineItem key={i} />
            ))}
            <span className="sr-only">Fristen werden geladen...</span>
        </div>
    );
}

/**
 * Compound skeleton for Search results
 */
export function SkeletonSearchResults({ items = 5 }: { items?: number }) {
    return (
        <div className="space-y-2" role="status" aria-label="Lade Suchergebnisse...">
            {Array.from({ length: items }).map((_, i) => (
                <SkeletonSearchResult key={i} />
            ))}
            <span className="sr-only">Suchergebnisse werden geladen...</span>
        </div>
    );
}
