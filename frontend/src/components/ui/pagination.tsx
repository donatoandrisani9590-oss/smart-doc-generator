import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface PaginationProps {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
    className?: string
}

function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
    if (totalPages <= 1) return null

    return (
        <div className={cn("flex items-center justify-center gap-2", className)}>
            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                disableMotion
            >
                <ChevronLeft className="h-4 w-4" />
                Zurück
            </Button>
            <span className="text-sm text-muted-foreground px-2">
                Seite {currentPage} von {totalPages}
            </span>
            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                disableMotion
            >
                Weiter
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    )
}

export { Pagination }
export type { PaginationProps }
