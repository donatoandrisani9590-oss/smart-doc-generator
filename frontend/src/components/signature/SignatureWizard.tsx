'use client';

/**
 * SignatureWizard Component
 *
 * A 3-step wizard for sending documents for signature:
 * 1. Add signers
 * 2. Place signature fields (simplified)
 * 3. Review & send
 */

import * as React from 'react';
import {
  Users,
  FileSignature,
  Send,
  Plus,
  Trash2,
  Lightbulb,
  Mail,
  Calendar,
  PenTool,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Wizard, WizardStepContent, type WizardStep } from '@/components/ui/wizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { signatureService } from '@/lib/signature-service';
import type {
  SignerRole,
  SignatureField,
  SignatureFieldType,
  SignatureRequest,
  CreateSignatureRequestInput,
} from '@/types/signature';

// =============================================================================
// Types
// =============================================================================

interface SignatureWizardProps {
  documentId: number;
  documentTitle: string;
  documentPreviewUrl?: string;
  onComplete: (request: SignatureRequest) => void;
  onCancel: () => void;
}

interface SignerFormData {
  id: string;
  name: string;
  email: string;
  role: SignerRole;
  order: number;
}

interface SignerFieldConfig {
  signerId: string;
  signerName: string;
  signature: boolean;
  date: boolean;
  initials: boolean;
}

interface ReviewData {
  expiresAt: string;
  reminderDays: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getRoleLabel(role: SignerRole): string {
  const labels: Record<SignerRole, string> = {
    employee: 'Mitarbeiter',
    manager: 'Manager',
    witness: 'Zeuge',
    contractor: 'Auftragnehmer',
    legal: 'Rechtsabteilung',
  };
  return labels[role] || role;
}

function getDefaultExpiration(): string {
  const date = new Date();
  date.setDate(date.getDate() + 14); // 14 days from now
  return date.toISOString().split('T')[0];
}

// =============================================================================
// Step 1: Signers Component
// =============================================================================

interface SignersStepProps {
  signers: SignerFormData[];
  onSignersChange: (signers: SignerFormData[]) => void;
  errors: Record<string, string>;
}

function SignersStep({ signers, onSignersChange, errors }: SignersStepProps) {
  const addSigner = () => {
    const newSigner: SignerFormData = {
      id: generateTempId(),
      name: '',
      email: '',
      role: 'employee',
      order: signers.length + 1,
    };
    onSignersChange([...signers, newSigner]);
  };

  const removeSigner = (id: string) => {
    const updated = signers
      .filter((s) => s.id !== id)
      .map((s, index) => ({ ...s, order: index + 1 }));
    onSignersChange(updated);
  };

  const updateSigner = (id: string, field: keyof SignerFormData, value: string | number) => {
    const updated = signers.map((s) =>
      s.id === id ? { ...s, [field]: value } : s
    );
    onSignersChange(updated);
  };

  const moveSignerOrder = (id: string, direction: 'up' | 'down') => {
    const index = signers.findIndex((s) => s.id === id);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === signers.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...signers];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];

    // Update order numbers
    const reordered = updated.map((s, i) => ({ ...s, order: i + 1 }));
    onSignersChange(reordered);
  };

  return (
    <WizardStepContent
      title="Wer soll unterschreiben?"
      description="Fuegen Sie alle Personen hinzu, die dieses Dokument unterschreiben sollen."
    >
      <div className="space-y-4">
        {signers.map((signer, index) => (
          <Card key={signer.id} className="relative">
            <CardContent className="pt-6">
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  #{signer.order}
                </Badge>
                {signers.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeSigner(signer.id)}
                    aria-label="Unterzeichner entfernen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`name-${signer.id}`}>Name</Label>
                  <Input
                    id={`name-${signer.id}`}
                    placeholder="Max Mustermann"
                    value={signer.name}
                    onChange={(e) => updateSigner(signer.id, 'name', e.target.value)}
                    className={errors[`${signer.id}-name`] ? 'border-destructive' : ''}
                  />
                  {errors[`${signer.id}-name`] && (
                    <p className="text-sm text-destructive">{errors[`${signer.id}-name`]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`email-${signer.id}`}>E-Mail</Label>
                  <Input
                    id={`email-${signer.id}`}
                    type="email"
                    placeholder="max@beispiel.de"
                    value={signer.email}
                    onChange={(e) => updateSigner(signer.id, 'email', e.target.value)}
                    className={errors[`${signer.id}-email`] ? 'border-destructive' : ''}
                  />
                  {errors[`${signer.id}-email`] && (
                    <p className="text-sm text-destructive">{errors[`${signer.id}-email`]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`role-${signer.id}`}>Rolle</Label>
                  <Select
                    value={signer.role}
                    onValueChange={(value) => updateSigner(signer.id, 'role', value as SignerRole)}
                  >
                    <SelectTrigger id={`role-${signer.id}`}>
                      <SelectValue placeholder="Rolle waehlen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Mitarbeiter</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="contractor">Auftragnehmer</SelectItem>
                      <SelectItem value="witness">Zeuge</SelectItem>
                      <SelectItem value="legal">Rechtsabteilung</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Reihenfolge</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => moveSignerOrder(signer.id, 'up')}
                      disabled={index === 0}
                    >
                      Nach oben
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => moveSignerOrder(signer.id, 'down')}
                      disabled={index === signers.length - 1}
                    >
                      Nach unten
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={addSigner}
        >
          <Plus className="mr-2 h-4 w-4" />
          Weiteren Unterzeichner hinzufuegen
        </Button>

        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertDescription>
            Die Reihenfolge bestimmt, wer zuerst signiert. Der naechste Unterzeichner
            wird erst benachrichtigt, wenn der vorherige unterschrieben hat.
          </AlertDescription>
        </Alert>
      </div>
    </WizardStepContent>
  );
}

// =============================================================================
// Step 2: Fields Placement Component
// =============================================================================

interface FieldsStepProps {
  fieldConfigs: SignerFieldConfig[];
  onFieldConfigsChange: (configs: SignerFieldConfig[]) => void;
  documentTitle: string;
  documentPreviewUrl?: string;
}

function FieldsStep({
  fieldConfigs,
  onFieldConfigsChange,
  documentTitle,
  documentPreviewUrl,
}: FieldsStepProps) {
  const updateFieldConfig = (
    signerId: string,
    field: 'signature' | 'date' | 'initials',
    value: boolean
  ) => {
    const updated = fieldConfigs.map((config) =>
      config.signerId === signerId ? { ...config, [field]: value } : config
    );
    onFieldConfigsChange(updated);
  };

  const getFieldCount = (): number => {
    return fieldConfigs.reduce((count, config) => {
      return (
        count +
        (config.signature ? 1 : 0) +
        (config.date ? 1 : 0) +
        (config.initials ? 1 : 0)
      );
    }, 0);
  };

  return (
    <WizardStepContent
      title="Wo sollen die Unterschriften platziert werden?"
      description="Waehlen Sie die Signaturfelder fuer jeden Unterzeichner aus."
    >
      <div className="space-y-6">
        {/* Simplified PDF Preview */}
        <Card className="overflow-hidden">
          <div className="bg-muted/50 p-4">
            <div className="aspect-[3/4] max-h-[300px] bg-white border rounded-lg flex flex-col items-center justify-center text-muted-foreground">
              {documentPreviewUrl ? (
                <img
                  src={documentPreviewUrl}
                  alt="Dokumentvorschau"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <>
                  <FileText className="h-16 w-16 mb-4 opacity-50" />
                  <p className="text-sm font-medium">{documentTitle}</p>
                  <p className="text-xs mt-1">Seite 1 von 3</p>
                </>
              )}
            </div>

            {/* Signature field indicators */}
            <div className="mt-4 flex flex-wrap gap-2">
              {fieldConfigs
                .filter((c) => c.signature)
                .map((config) => (
                  <Badge
                    key={`sig-${config.signerId}`}
                    variant="secondary"
                    className="gap-1"
                  >
                    <PenTool className="h-3 w-3" />
                    {config.signerName}
                  </Badge>
                ))}
            </div>
          </div>
        </Card>

        <Separator />

        {/* Field selection per signer */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Felder pro Unterzeichner:
          </h3>

          {fieldConfigs.map((config) => (
            <Card key={config.signerId}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{config.signerName}</Badge>
                  </div>

                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={config.signature}
                        onCheckedChange={(checked) =>
                          updateFieldConfig(config.signerId, 'signature', checked === true)
                        }
                      />
                      <span className="text-sm flex items-center gap-1">
                        <PenTool className="h-3 w-3" />
                        Signatur
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={config.date}
                        onCheckedChange={(checked) =>
                          updateFieldConfig(config.signerId, 'date', checked === true)
                        }
                      />
                      <span className="text-sm flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Datum
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={config.initials}
                        onCheckedChange={(checked) =>
                          updateFieldConfig(config.signerId, 'initials', checked === true)
                        }
                      />
                      <span className="text-sm flex items-center gap-1">
                        <FileSignature className="h-3 w-3" />
                        Initialen
                      </span>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Gesamt: {getFieldCount()} Signaturfelder werden im Dokument platziert.
          </AlertDescription>
        </Alert>
      </div>
    </WizardStepContent>
  );
}

// =============================================================================
// Step 3: Review Component
// =============================================================================

interface ReviewStepProps {
  documentTitle: string;
  signers: SignerFormData[];
  fieldConfigs: SignerFieldConfig[];
  reviewData: ReviewData;
  onReviewDataChange: (data: ReviewData) => void;
  isSubmitting: boolean;
}

function ReviewStep({
  documentTitle,
  signers,
  fieldConfigs,
  reviewData,
  onReviewDataChange,
  isSubmitting,
}: ReviewStepProps) {
  const getFieldCount = (): number => {
    return fieldConfigs.reduce((count, config) => {
      return (
        count +
        (config.signature ? 1 : 0) +
        (config.date ? 1 : 0) +
        (config.initials ? 1 : 0)
      );
    }, 0);
  };

  const getFieldsPerSigner = (signerId: string): number => {
    const config = fieldConfigs.find((c) => c.signerId === signerId);
    if (!config) return 0;
    return (
      (config.signature ? 1 : 0) +
      (config.date ? 1 : 0) +
      (config.initials ? 1 : 0)
    );
  };

  return (
    <WizardStepContent
      title="Zusammenfassung"
      description="Ueberpruefen Sie die Details bevor Sie das Dokument zur Unterschrift senden."
    >
      <div className="space-y-6">
        {/* Document Info */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h3 className="font-medium">{documentTitle}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {getFieldCount()} Signaturfelder ({signers.length} Unterzeichner)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Signers List */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Unterzeichner:</h3>

          {signers.map((signer, index) => (
            <Card key={signer.id}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                      {index + 1}
                    </Badge>
                    <div>
                      <p className="font-medium">{signer.name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {signer.email}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{getRoleLabel(signer.role)}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getFieldsPerSigner(signer.id)} Felder
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        {/* Settings */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="expires-at" className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Gueltig bis
            </Label>
            <Input
              id="expires-at"
              type="date"
              value={reviewData.expiresAt}
              onChange={(e) =>
                onReviewDataChange({ ...reviewData, expiresAt: e.target.value })
              }
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-days" className="flex items-center gap-1">
              <Mail className="h-4 w-4" />
              Erinnerung nach
            </Label>
            <Select
              value={String(reviewData.reminderDays)}
              onValueChange={(value) =>
                onReviewDataChange({ ...reviewData, reminderDays: parseInt(value, 10) })
              }
            >
              <SelectTrigger id="reminder-days">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Tag</SelectItem>
                <SelectItem value="2">2 Tage</SelectItem>
                <SelectItem value="3">3 Tage</SelectItem>
                <SelectItem value="5">5 Tage</SelectItem>
                <SelectItem value="7">7 Tage</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isSubmitting && (
          <Alert>
            <AlertCircle className="h-4 w-4 animate-pulse" />
            <AlertDescription>
              Dokument wird zur Unterschrift gesendet...
            </AlertDescription>
          </Alert>
        )}
      </div>
    </WizardStepContent>
  );
}

// =============================================================================
// Main SignatureWizard Component
// =============================================================================

export function SignatureWizard({
  documentId,
  documentTitle,
  documentPreviewUrl,
  onComplete,
  onCancel,
}: SignatureWizardProps) {
  // State
  const [currentStep, setCurrentStep] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Signers state
  const [signers, setSigners] = React.useState<SignerFormData[]>([
    {
      id: generateTempId(),
      name: '',
      email: '',
      role: 'employee',
      order: 1,
    },
  ]);

  // Field configs state
  const [fieldConfigs, setFieldConfigs] = React.useState<SignerFieldConfig[]>([]);

  // Review data state
  const [reviewData, setReviewData] = React.useState<ReviewData>({
    expiresAt: getDefaultExpiration(),
    reminderDays: 3,
  });

  // Sync field configs with signers
  React.useEffect(() => {
    const newConfigs: SignerFieldConfig[] = signers.map((signer) => {
      const existing = fieldConfigs.find((c) => c.signerId === signer.id);
      return (
        existing || {
          signerId: signer.id,
          signerName: signer.name || 'Unterzeichner',
          signature: true,
          date: true,
          initials: false,
        }
      );
    });

    // Update signer names in configs
    const updatedConfigs = newConfigs.map((config) => {
      const signer = signers.find((s) => s.id === config.signerId);
      return {
        ...config,
        signerName: signer?.name || 'Unterzeichner',
      };
    });

    setFieldConfigs(updatedConfigs);
  }, [signers]);

  // Wizard steps configuration
  const wizardSteps: WizardStep[] = [
    {
      id: 'signers',
      label: 'Unterzeichner',
      icon: Users,
      description: 'Wer soll unterschreiben?',
      validate: () => validateSignersStep(),
    },
    {
      id: 'fields',
      label: 'Felder',
      icon: FileSignature,
      description: 'Signaturfelder platzieren',
      validate: () => validateFieldsStep(),
    },
    {
      id: 'review',
      label: 'Senden',
      icon: Send,
      description: 'Ueberpruefen und absenden',
    },
  ];

  // Validation functions
  const validateSignersStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (signers.length === 0) {
      newErrors['general'] = 'Mindestens ein Unterzeichner erforderlich';
    }

    signers.forEach((signer) => {
      if (!signer.name.trim()) {
        newErrors[`${signer.id}-name`] = 'Name ist erforderlich';
      }
      if (!signer.email.trim()) {
        newErrors[`${signer.id}-email`] = 'E-Mail ist erforderlich';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signer.email)) {
        newErrors[`${signer.id}-email`] = 'Ungueltige E-Mail-Adresse';
      }
    });

    // Check for duplicate emails
    const emails = signers.map((s) => s.email.toLowerCase());
    const duplicates = emails.filter((email, index) => emails.indexOf(email) !== index);
    if (duplicates.length > 0) {
      signers.forEach((signer) => {
        if (duplicates.includes(signer.email.toLowerCase())) {
          newErrors[`${signer.id}-email`] = 'Doppelte E-Mail-Adresse';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateFieldsStep = (): boolean => {
    // Ensure at least one signature field per signer
    const missingSignatures = fieldConfigs.filter(
      (config) => !config.signature && !config.initials
    );

    if (missingSignatures.length > 0) {
      setErrors({
        fields: 'Jeder Unterzeichner benoetigt mindestens ein Signatur- oder Initialen-Feld',
      });
      return false;
    }

    setErrors({});
    return true;
  };

  // Submit handler
  const handleComplete = async () => {
    setIsSubmitting(true);

    try {
      // Build signature fields from configs
      const fields: Omit<SignatureField, 'id'>[] = [];
      let yPosition = 70; // Start position on page

      fieldConfigs.forEach((config) => {
        const baseX = 10;
        let currentX = baseX;

        if (config.signature) {
          fields.push({
            signerId: config.signerId,
            type: 'signature' as SignatureFieldType,
            page: 1,
            x: currentX,
            y: yPosition,
            width: 25,
            height: 5,
            required: true,
            label: 'Unterschrift',
          });
          currentX += 30;
        }

        if (config.date) {
          fields.push({
            signerId: config.signerId,
            type: 'date' as SignatureFieldType,
            page: 1,
            x: currentX,
            y: yPosition,
            width: 15,
            height: 3,
            required: true,
            label: 'Datum',
          });
          currentX += 20;
        }

        if (config.initials) {
          fields.push({
            signerId: config.signerId,
            type: 'initials' as SignatureFieldType,
            page: 1,
            x: currentX,
            y: yPosition,
            width: 10,
            height: 3,
            required: true,
            label: 'Initialen',
          });
        }

        yPosition += 10; // Next signer below
      });

      // Calculate expiration days
      const expiresDate = new Date(reviewData.expiresAt);
      const today = new Date();
      const expiresInDays = Math.ceil(
        (expiresDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Create signature request input
      const input: CreateSignatureRequestInput = {
        documentId,
        signers: signers.map((s) => ({
          name: s.name,
          email: s.email,
          role: s.role,
          order: s.order,
        })),
        fields,
        subject: `Bitte unterschreiben: ${documentTitle}`,
        message: `Sie wurden gebeten, das Dokument "${documentTitle}" zu unterschreiben. Bitte klicken Sie auf den Link in dieser E-Mail, um das Dokument zu ueberpruefen und zu unterschreiben.`,
        expiresInDays: Math.max(1, expiresInDays),
      };

      // Create and send signature request
      const request = await signatureService.createSignatureRequest(input);
      const sentRequest = await signatureService.sendForSignature(request.id);

      onComplete(sentRequest);
    } catch (error) {
      console.error('Failed to send signature request:', error);
      setErrors({
        submit: error instanceof Error ? error.message : 'Fehler beim Senden der Signaturanfrage',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Wizard
        steps={wizardSteps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        onComplete={handleComplete}
        onCancel={onCancel}
        showStepIndicator
        allowStepClick
        completeLabel="Zur Unterschrift senden"
        nextLabel="Weiter"
        backLabel="Zurueck"
        cancelLabel="Abbrechen"
      >
        {/* Step 1: Signers */}
        <SignersStep
          signers={signers}
          onSignersChange={setSigners}
          errors={errors}
        />

        {/* Step 2: Fields */}
        <FieldsStep
          fieldConfigs={fieldConfigs}
          onFieldConfigsChange={setFieldConfigs}
          documentTitle={documentTitle}
          documentPreviewUrl={documentPreviewUrl}
        />

        {/* Step 3: Review */}
        <ReviewStep
          documentTitle={documentTitle}
          signers={signers}
          fieldConfigs={fieldConfigs}
          reviewData={reviewData}
          onReviewDataChange={setReviewData}
          isSubmitting={isSubmitting}
        />
      </Wizard>

      {/* Global error display */}
      {errors.submit && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors.submit}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default SignatureWizard;
