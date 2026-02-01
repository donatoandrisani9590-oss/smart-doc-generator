/**
 * SmartModeDialog - Quick access to Smart Mode
 *
 * Shows a dialog with the SmartModeWizard for rapid document creation.
 * Can be triggered from dashboard or anywhere in the app.
 */

import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SmartModeWizard } from "./SmartModeWizard";

interface SmartModeDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onOpenChange: (open: boolean) => void;
  /** Document type ID to create */
  documentTypeId: number;
  /** Document type name for display */
  documentTypeName: string;
  /** Initial data from chat extraction */
  initialData?: Record<string, unknown>;
  /** Callback when complete - navigate to editor with data */
  onComplete: (formData: Record<string, unknown>, title: string) => void;
}

export function SmartModeDialog({
  open,
  onOpenChange,
  documentTypeId,
  documentTypeName,
  initialData,
  onComplete,
}: SmartModeDialogProps) {
  const handleComplete = useCallback(
    (formData: Record<string, unknown>, title: string) => {
      onComplete(formData, title);
      onOpenChange(false);
    },
    [onComplete, onOpenChange]
  );

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Smart Mode - {documentTypeName}</DialogTitle>
          <DialogDescription>
            Erstellen Sie Ihr Dokument im Gesprächsmodus
          </DialogDescription>
        </DialogHeader>
        <SmartModeWizard
          documentTypeId={documentTypeId}
          initialData={initialData}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
}

export default SmartModeDialog;
