"use client";

import { Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCategoryIcon } from "./constants";
import type { DragOverlayContentProps } from "./types";

export const DragOverlayContent = ({ clause, section, type }: DragOverlayContentProps) => {
    if (type === "section" && section) {
        return (
            <div className="shadow-xl ring-2 ring-blue-500 opacity-90 w-80 bg-slate-100 rounded-lg p-3">
                <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-sm">{section.title}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                        {section.clauses.length} Textbausteine
                    </Badge>
                </div>
            </div>
        );
    }

    if (clause) {
        const IconComponent = getCategoryIcon(clause.category);

        return (
            <Card className="shadow-xl ring-2 ring-primary opacity-90 w-64">
                <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-green-100 rounded">
                            {/* eslint-disable-next-line react-hooks/static-components -- dynamic component from lookup, not a nested component definition */}
                            <IconComponent className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{clause.title}</p>
                            <p className="text-xs text-muted-foreground">{clause.category}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return null;
};
