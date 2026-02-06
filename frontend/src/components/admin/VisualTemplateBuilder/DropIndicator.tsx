"use client";

import { Plus } from "lucide-react";
import type { DropIndicatorProps } from "./types";

export const DropIndicator = ({ isOver }: DropIndicatorProps) => {
    if (!isOver) return null;

    return (
        <div className="flex items-center justify-center p-4 border-2 border-dashed border-primary rounded-lg bg-primary/5">
            <Plus className="w-5 h-5 text-primary mr-2" />
            <span className="text-sm font-medium text-primary">Hier ablegen</span>
        </div>
    );
};
