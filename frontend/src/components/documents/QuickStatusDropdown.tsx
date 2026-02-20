/**
 * QuickStatusDropdown — Inline status action dropdown for document rows.
 *
 * Shows common workflow actions (Versendet, Wiedervorlage, Notiz, Abschließen)
 * in a popover. Uses the existing POST /documents/{id}/actions endpoint.
 */

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown, Send, Calendar, StickyNote, CheckCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

interface QuickStatusDropdownProps {
    documentId: number;
}

const QUICK_ACTIONS = [
    { type: "sent", label: "Versendet", icon: Send },
    { type: "reminder_set", label: "Wiedervorlage", icon: Calendar },
    { type: "note", label: "Notiz", icon: StickyNote },
    { type: "completed", label: "Abschließen", icon: CheckCircle },
] as const;

export function QuickStatusDropdown({ documentId }: QuickStatusDropdownProps) {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();

    const createAction = useMutation({
        mutationFn: async (actionType: string) => {
            return api.post(`/api/v1/documents/${documentId}/actions`, {
                action_type: actionType,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["repository"] });
            queryClient.invalidateQueries({ queryKey: ["repository-stats"] });
            setOpen(false);
        },
    });

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-xs h-7"
                    onClick={(e) => e.stopPropagation()}
                >
                    Status <ChevronDown className="w-3 h-3" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="end">
                {QUICK_ACTIONS.map((a) => (
                    <button
                        key={a.type}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-warm-50 transition-colors disabled:opacity-50"
                        disabled={createAction.isPending}
                        onClick={(e) => {
                            e.stopPropagation();
                            createAction.mutate(a.type);
                        }}
                    >
                        <a.icon className="w-3.5 h-3.5 text-muted-foreground" />
                        {a.label}
                    </button>
                ))}
            </PopoverContent>
        </Popover>
    );
}
