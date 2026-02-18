/**
 * ActivityChart Component
 *
 * Simple bar chart showing document generation activity over the last 6 months.
 * Uses pure CSS for visualization (no external chart library).
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRepositoryStats } from "@/hooks/useApi";
import { Loader2, BarChart3 } from "lucide-react";

interface ActivityChartProps {
    countryCode?: string;
}

export const ActivityChart = ({ countryCode }: ActivityChartProps) => {
    const { data: stats, isLoading } = useRepositoryStats(countryCode);

    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- manual memoization intentional
    const chartData = useMemo(() => {
        if (!stats?.documents_by_month) return [];

        const maxCount = Math.max(...stats.documents_by_month.map((m) => m.count), 1);

        return stats.documents_by_month.map((month) => ({
            ...month,
            percentage: (month.count / maxCount) * 100,
        }));
    }, [stats?.documents_by_month]);

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Dokumente pro Monat
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center h-48">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-muted-foreground">
                        Keine Daten verfügbar
                    </div>
                ) : (
                    <div className="h-48">
                        {/* Chart Container */}
                        <div className="flex items-end justify-between h-36 gap-2">
                            {chartData.map((month) => (
                                <div key={month.month} className="flex-1 flex flex-col items-center gap-1">
                                    {/* Bar */}
                                    <div
                                        className="w-full bg-primary/20 rounded-t-sm relative group cursor-pointer hover:bg-primary/30 transition-colors"
                                        style={{
                                            height: `${Math.max(month.percentage, 5)}%`,
                                        }}
                                    >
                                        <div
                                            className="absolute inset-x-0 bottom-0 bg-primary rounded-t-sm transition-all"
                                            style={{ height: `${month.percentage}%` }}
                                        />
                                        {/* Tooltip */}
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                            {month.count} Dokumente
                                        </div>
                                    </div>
                                    {/* Count */}
                                    <span className="text-xs font-medium">{month.count}</span>
                                </div>
                            ))}
                        </div>
                        {/* Labels */}
                        <div className="flex justify-between mt-2">
                            {chartData.map((month) => (
                                <div key={month.month} className="flex-1 text-center">
                                    <span className="text-xs text-muted-foreground">
                                        {month.label?.split(" ")[0] || month.month}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
