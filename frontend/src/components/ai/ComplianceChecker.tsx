'use client';

import * as React from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Plus,
  Scale,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  getComplianceRules,
  clauseSatisfiesRule,
  calculateComplianceScore,
  type ComplianceResult,
  type ComplianceCheckResult,
} from '@/lib/compliance-rules';

// ============================================================================
// Types
// ============================================================================

export interface Clause {
  id: number;
  name: string;
  title?: string;
}

export interface ComplianceCheckerProps {
  /** ID des Dokumenttyps */
  documentTypeId: number;
  /** IDs der aktivierten Klauseln */
  enabledClauseIds: number[];
  /** Aktuelle Formulardaten */
  formData: Record<string, unknown>;
  /** Ländercode (z.B. 'DE', 'IT', 'AT', 'CH') */
  countryCode: string;
  /** Alle verfügbaren Klauseln */
  availableClauses: Clause[];
  /** Callback wenn eine Klausel hinzugefügt werden soll */
  onAddClause?: (clauseId: number) => void;
  /** Dokumenttyp-Name für Filterung */
  documentTypeName?: string;
  /** Optionale CSS-Klassen */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Führt die Compliance-Prüfung durch
 */
function performComplianceCheck(
  countryCode: string,
  enabledClauseIds: number[],
  formData: Record<string, unknown>,
  availableClauses: Clause[],
  documentTypeName?: string
): ComplianceCheckResult {
  const rules = getComplianceRules(countryCode);
  const results: ComplianceResult[] = [];

  // Aktivierte Klauseln mit Namen
  const enabledClauses = availableClauses.filter(c =>
    enabledClauseIds.includes(c.id)
  );

  for (const rule of rules) {
    // Prüfe ob die Regel für diesen Dokumenttyp gilt
    if (rule.applicableDocumentTypes && rule.applicableDocumentTypes.length > 0) {
      const normalizedDocType = (documentTypeName || '').toLowerCase().replace(/[-_\s]+/g, '_');
      const applies = rule.applicableDocumentTypes.some(type =>
        normalizedDocType.includes(type.toLowerCase()) ||
        type.toLowerCase().includes(normalizedDocType)
      );
      if (!applies) {
        continue;
      }
    }

    // Prüfe bedingte Regeln
    if (rule.condition && !rule.condition(formData)) {
      continue;
    }

    // Prüfe ob eine aktivierte Klausel die Regel erfüllt
    const satisfyingClause = enabledClauses.find(clause =>
      clauseSatisfiesRule(clause.name, clause.id, rule)
    );

    if (satisfyingClause) {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        status: 'passed',
        severity: rule.severity,
        message: `Vorhanden: ${satisfyingClause.title || satisfyingClause.name}`,
        legalBasis: rule.legalBasis,
      });
    } else {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        status: rule.severity === 'info' ? 'warning' : 'failed',
        severity: rule.severity,
        message: rule.description,
        legalBasis: rule.legalBasis,
        suggestedClauseNames: rule.satisfiedByClauseNames,
      });
    }
  }

  // Sortiere: Fehler zuerst, dann Warnungen, dann Info
  results.sort((a, b) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    const statusOrder = { failed: 0, warning: 1, passed: 2 };
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return statusOrder[a.status] - statusOrder[b.status];
  });

  const score = calculateComplianceScore(results);
  const passedCount = results.filter(r => r.status === 'passed').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const warningCount = results.filter(r => r.status === 'warning').length;

  return {
    score,
    maxScore: 100,
    percentage: score,
    results,
    passedCount,
    failedCount,
    warningCount,
  };
}

/**
 * Findet eine passende Klausel für eine Empfehlung
 */
function findMatchingClause(
  suggestedNames: string[],
  availableClauses: Clause[],
  enabledClauseIds: number[]
): Clause | undefined {
  const normalizedSuggestions = suggestedNames.map(name =>
    name.toLowerCase().replace(/[-_\s]+/g, '_')
  );

  return availableClauses.find(clause => {
    if (enabledClauseIds.includes(clause.id)) {
      return false;
    }

    const normalizedName = clause.name.toLowerCase().replace(/[-_\s]+/g, '_');
    const normalizedTitle = (clause.title || '').toLowerCase().replace(/[-_\s]+/g, '_');

    return normalizedSuggestions.some(
      suggested =>
        normalizedName.includes(suggested) ||
        suggested.includes(normalizedName) ||
        normalizedTitle.includes(suggested) ||
        suggested.includes(normalizedTitle)
    );
  });
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ScoreDisplayProps {
  score: number;
  failedCount: number;
  warningCount: number;
  passedCount: number;
}

function ScoreDisplay({ score, failedCount, warningCount, passedCount }: ScoreDisplayProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  const getProgressColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 70) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Compliance Score:</span>
          <span className={cn('text-2xl font-bold', getScoreColor(score))}>
            {score}/100
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{passedCount}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{passedCount} Anforderungen erfüllt</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {warningCount > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span>{warningCount}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{warningCount} Empfehlungen</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {failedCount > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span>{failedCount}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{failedCount} fehlende Pflichtangaben</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all duration-500', getProgressColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

interface ComplianceItemProps {
  result: ComplianceResult;
  matchingClause?: Clause;
  onAddClause?: () => void;
}

function ComplianceItem({ result, matchingClause, onAddClause }: ComplianceItemProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  const getIcon = () => {
    switch (result.status) {
      case 'passed':
        return <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />;
      case 'failed':
        return result.severity === 'error' ? (
          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
        );
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
    }
  };

  const getBgColor = () => {
    if (result.status === 'passed') return 'bg-green-50/50';
    if (result.severity === 'error') return 'bg-red-50/50';
    return 'bg-amber-50/50';
  };

  return (
    <div className={cn('rounded-lg p-3 border border-border/50', getBgColor())}>
      <div className="flex items-start gap-3">
        {getIcon()}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{result.ruleName}</span>
            {result.severity === 'error' && result.status !== 'passed' && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                Pflicht
              </Badge>
            )}
            {result.severity === 'warning' && result.status !== 'passed' && (
              <Badge variant="warning" className="text-xs px-1.5 py-0">
                Empfohlen
              </Badge>
            )}
            {result.severity === 'info' && result.status !== 'passed' && (
              <Badge variant="muted" className="text-xs px-1.5 py-0">
                Hinweis
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground">{result.message}</p>

          {result.legalBasis && (
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2">
                  <Scale className="h-3 w-3" />
                  <span>{result.legalBasis}</span>
                  {showDetails ? (
                    <ChevronUp className="h-3 w-3 ml-1" />
                  ) : (
                    <ChevronDown className="h-3 w-3 ml-1" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 pt-2 border-t border-border/30">
                <p className="text-xs text-muted-foreground">
                  Diese Anforderung basiert auf {result.legalBasis}. Die Einhaltung dieser
                  Vorschrift ist für rechtsgültige Verträge essentiell.
                </p>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        {result.status !== 'passed' && matchingClause && onAddClause && (
          <Button
            variant="outline"
            size="sm"
            className="flex-shrink-0 h-8"
            onClick={onAddClause}
          >
            <Plus className="h-4 w-4 mr-1" />
            Hinzufügen
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ComplianceChecker({
  enabledClauseIds,
  formData,
  countryCode,
  availableClauses,
  onAddClause,
  documentTypeName,
  className,
}: ComplianceCheckerProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [showPassed, setShowPassed] = React.useState(false);

  // Compliance-Check durchführen
  const checkResult = React.useMemo(
    () =>
      performComplianceCheck(
        countryCode,
        enabledClauseIds,
        formData,
        availableClauses,
        documentTypeName
      ),
    [countryCode, enabledClauseIds, formData, availableClauses, documentTypeName]
  );

  // Ergebnisse filtern
  const failedResults = checkResult.results.filter(r => r.status === 'failed');
  const warningResults = checkResult.results.filter(r => r.status === 'warning');
  const passedResults = checkResult.results.filter(r => r.status === 'passed');

  // Handler für Klausel hinzufügen
  const handleAddClause = React.useCallback(
    (result: ComplianceResult) => {
      if (!onAddClause || !result.suggestedClauseNames) return;

      const matchingClause = findMatchingClause(
        result.suggestedClauseNames,
        availableClauses,
        enabledClauseIds
      );

      if (matchingClause) {
        onAddClause(matchingClause.id);
      }
    },
    [onAddClause, availableClauses, enabledClauseIds]
  );

  // Länder-Label
  const countryLabels: Record<string, string> = {
    DE: 'Deutschland',
    IT: 'Italien',
    AT: 'Österreich',
    CH: 'Schweiz',
  };

  return (
    <Card className={cn('border-blue-200/50', className)}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left group">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-100 text-blue-600">
                  <Shield className="h-4 w-4" />
                </div>
                <CardTitle className="text-base font-medium">
                  Compliance-Check
                </CardTitle>
                <Badge variant="outline" className="ml-2 text-xs">
                  {countryLabels[countryCode] || countryCode}
                </Badge>
              </div>
              <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </div>
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Score Display */}
            <ScoreDisplay
              score={checkResult.percentage}
              failedCount={checkResult.failedCount}
              warningCount={checkResult.warningCount}
              passedCount={checkResult.passedCount}
            />

            {/* Failed Items (Pflicht) */}
            {failedResults.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  Fehlende Pflichtangaben ({failedResults.length})
                </h4>
                <div className="space-y-2">
                  {failedResults.map(result => {
                    const matchingClause = result.suggestedClauseNames
                      ? findMatchingClause(
                          result.suggestedClauseNames,
                          availableClauses,
                          enabledClauseIds
                        )
                      : undefined;

                    return (
                      <ComplianceItem
                        key={result.ruleId}
                        result={result}
                        matchingClause={matchingClause}
                        onAddClause={
                          matchingClause && onAddClause
                            ? () => handleAddClause(result)
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Warning Items (Empfohlen) */}
            {warningResults.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Empfehlungen ({warningResults.length})
                </h4>
                <div className="space-y-2">
                  {warningResults.map(result => {
                    const matchingClause = result.suggestedClauseNames
                      ? findMatchingClause(
                          result.suggestedClauseNames,
                          availableClauses,
                          enabledClauseIds
                        )
                      : undefined;

                    return (
                      <ComplianceItem
                        key={result.ruleId}
                        result={result}
                        matchingClause={matchingClause}
                        onAddClause={
                          matchingClause && onAddClause
                            ? () => handleAddClause(result)
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Passed Items (Erfüllt) */}
            {passedResults.length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowPassed(!showPassed)}
                  className="text-sm font-medium flex items-center gap-2 hover:text-foreground transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Erfüllte Anforderungen ({passedResults.length})
                  {showPassed ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>

                {showPassed && (
                  <div className="space-y-2">
                    {passedResults.map(result => (
                      <ComplianceItem key={result.ruleId} result={result} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Disclaimer */}
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground flex items-start gap-2">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Dies ist keine Rechtsberatung. Die Prüfung dient nur als
                  Orientierungshilfe. Bei rechtlichen Fragen wenden Sie sich bitte an
                  einen Rechtsanwalt.
                </span>
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default ComplianceChecker;
