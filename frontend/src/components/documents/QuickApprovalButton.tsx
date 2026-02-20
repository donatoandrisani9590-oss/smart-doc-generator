/**
 * QuickApprovalButton — Quick "Freigabe" button for document rows.
 *
 * Navigates to the document detail page with the approval tab open,
 * since creating an approval request requires approver selection.
 */

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface QuickApprovalButtonProps {
    documentId: number;
}

export function QuickApprovalButton({ documentId }: QuickApprovalButtonProps) {
    const navigate = useNavigate();

    return (
        <Button
            size="sm"
            className="gap-1 text-xs h-7 bg-primary hover:bg-primary/90"
            onClick={(e) => {
                e.stopPropagation();
                navigate(`/documents/${documentId}?tab=freigabe`);
            }}
        >
            <Send className="w-3 h-3" />
            Freigabe
        </Button>
    );
}
