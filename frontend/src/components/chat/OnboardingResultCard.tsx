/**
 * OnboardingResultCard — shows draft results from the onboarding pipeline.
 *
 * Displays a card in the chat with:
 * - List of created drafts with status icons
 * - Missing field warnings
 * - "Öffnen" buttons that navigate to the generator with the draft
 */
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, AlertTriangle, XCircle, FileText, ExternalLink, Package,
} from "lucide-react";

interface DraftResult {
  id: number | null;
  title: string;
  document_type: string;
  document_type_id: number;
  missing_fields?: string[];
  field_count?: number;
  error?: string;
}

interface OnboardingResultCardProps {
  packageName: string;
  drafts: DraftResult[];
  jobId: number;
  summary: string;
}

export const OnboardingResultCard = ({
  packageName,
  drafts,
  jobId,
  summary,
}: OnboardingResultCardProps) => {
  const navigate = useNavigate();

  const successful = drafts.filter((d) => d.id != null && !d.error);
  const failed = drafts.filter((d) => d.error);

  const handleOpenDraft = (draftId: number, docTypeId: number) => {
    navigate(`/generate?draft=${draftId}&type=${docTypeId}`);
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="pt-4 pb-3 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <span className="font-medium text-sm">
            {packageName}-Paket erstellt
          </span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {successful.length}/{drafts.length} Dokumente
          </Badge>
        </div>

        {/* Draft list */}
        <div className="space-y-2">
          {drafts.map((draft, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-2 rounded-md bg-background/80"
            >
              {/* Status icon */}
              {draft.error ? (
                <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              ) : draft.missing_fields && draft.missing_fields.length > 0 ? (
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              )}

              {/* Document info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">
                    {draft.title}
                  </span>
                </div>
                {draft.error ? (
                  <p className="text-xs text-destructive mt-0.5">{draft.error}</p>
                ) : draft.missing_fields && draft.missing_fields.length > 0 ? (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {draft.missing_fields.length} fehlende Felder
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Vollständig
                  </p>
                )}
              </div>

              {/* Open button */}
              {draft.id != null && !draft.error && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => handleOpenDraft(draft.id!, draft.document_type_id)}
                >
                  Öffnen
                  <ExternalLink className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Summary */}
        {failed.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {failed.length} Dokument(e) konnten nicht erstellt werden.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
