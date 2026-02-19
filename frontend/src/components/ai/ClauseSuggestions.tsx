'use client';

import * as React from 'react';
import { Lightbulb, Plus, Info, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
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
  clauseSuggestionRules,
  normalizeClauseName,
  type ClauseSuggestionRule,
} from '@/lib/compliance-rules';

// ============================================================================
// Types
// ============================================================================

export interface Clause {
  id: number;
  name: string;
  title?: string;
  description?: string;
  category?: string;
}

export interface ClauseSuggestionsProps {
  /** ID des Dokumenttyps */
  documentTypeId: number;
  /** Aktuelle Formulardaten */
  formData: Record<string, unknown>;
  /** IDs der bereits aktivierten Textbausteine */
  enabledClauseIds: number[];
  /** Alle verfügbaren Textbausteine */
  availableClauses: Clause[];
  /** Callback wenn einen Textbaustein hinzugefügt wird */
  onAddClause: (clauseId: number) => void;
  /** Optionale CSS-Klassen */
  className?: string;
  /** Maximale Anzahl an Vorschlägen (default: 5) */
  maxSuggestions?: number;
}

interface SuggestedClause {
  clause: Clause;
  rule: ClauseSuggestionRule;
  priority: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Findet Textbausteine die zu einer Empfehlungsregel passen
 */
function findMatchingClauses(
  rule: ClauseSuggestionRule,
  availableClauses: Clause[],
  enabledClauseIds: number[]
): Clause[] {
  return availableClauses.filter(clause => {
    // Bereits aktivierte Textbausteine überspringen
    if (enabledClauseIds.includes(clause.id)) {
      return false;
    }

    // Prüfen ob den Textbaustein zur Regel passt
    const normalizedClauseName = normalizeClauseName(clause.name);
    const normalizedClauseTitle = clause.title ? normalizeClauseName(clause.title) : '';

    return rule.suggestedClauseNames.some(suggestedName => {
      const normalizedSuggested = normalizeClauseName(suggestedName);
      return (
        normalizedClauseName.includes(normalizedSuggested) ||
        normalizedSuggested.includes(normalizedClauseName) ||
        normalizedClauseTitle.includes(normalizedSuggested) ||
        normalizedSuggested.includes(normalizedClauseTitle)
      );
    });
  });
}

/**
 * Generiert Textbaustein-Vorschläge basierend auf Formulardaten
 */
function generateSuggestions(
  formData: Record<string, unknown>,
  availableClauses: Clause[],
  enabledClauseIds: number[],
  maxSuggestions: number
): SuggestedClause[] {
  const suggestions: SuggestedClause[] = [];
  const addedClauseIds = new Set<number>();

  // Sortiere Regeln nach Priorität
  const sortedRules = [...clauseSuggestionRules].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    // Prüfe ob die Regel-Bedingung erfüllt ist
    if (!rule.condition(formData)) {
      continue;
    }

    // Finde passende Textbausteine
    const matchingClauses = findMatchingClauses(rule, availableClauses, enabledClauseIds);

    for (const clause of matchingClauses) {
      // Keine Duplikate
      if (addedClauseIds.has(clause.id)) {
        continue;
      }

      suggestions.push({
        clause,
        rule,
        priority: rule.priority,
      });
      addedClauseIds.add(clause.id);

      // Max erreicht?
      if (suggestions.length >= maxSuggestions) {
        return suggestions;
      }
    }
  }

  return suggestions;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface SuggestionCardProps {
  suggestion: SuggestedClause;
  onAdd: () => void;
}

function SuggestionCard({ suggestion, onAdd }: SuggestionCardProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { clause, rule } = suggestion;

  return (
    <div className="border border-border/50 rounded-lg p-4 bg-card/50 hover:bg-card/80 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <h4 className="font-medium text-sm truncate">
              {clause.title || clause.name}
            </h4>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              {rule.reason}
            </Badge>
            {clause.category && (
              <span className="truncate">{clause.category}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsOpen(!isOpen)}
                >
                  <Info className="h-4 w-4" />
                  <span className="sr-only">Details anzeigen</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Warum empfohlen?</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="outline"
            size="sm"
            onClick={onAdd}
            className="h-8"
          >
            <Plus className="h-4 w-4 mr-1" />
            Hinzufügen
          </Button>
        </div>
      </div>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent className="mt-3 pt-3 border-t border-border/50">
          <p className="text-sm text-muted-foreground">
            {rule.explanation}
          </p>
          {clause.description && (
            <p className="text-sm text-muted-foreground mt-2 italic">
              {clause.description}
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ClauseSuggestions({
  formData,
  enabledClauseIds,
  availableClauses,
  onAddClause,
  className,
  maxSuggestions = 5,
}: ClauseSuggestionsProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [dismissedIds] = React.useState<Set<number>>(new Set());

  // Generiere Vorschläge
  const suggestions = React.useMemo(() => {
    const allSuggestions = generateSuggestions(
      formData,
      availableClauses,
      enabledClauseIds,
      maxSuggestions + dismissedIds.size
    );

    // Filter dismissed suggestions
    return allSuggestions.filter(s => !dismissedIds.has(s.clause.id));
  }, [formData, availableClauses, enabledClauseIds, maxSuggestions, dismissedIds]);

  // Handler
  const handleAddClause = React.useCallback(
    (clauseId: number) => {
      onAddClause(clauseId);
    },
    [onAddClause]
  );

  // Keine Vorschläge? Nichts anzeigen
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Card className={cn('border-amber-200/50 bg-amber-50/30', className)}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left group">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-amber-100 text-amber-600">
                  <Lightbulb className="h-4 w-4" />
                </div>
                <CardTitle className="text-base font-medium">
                  Empfohlene Textbausteine
                </CardTitle>
                <Badge variant="secondary" className="ml-2">
                  {suggestions.length}
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
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground mb-4">
              Basierend auf deinen Eingaben empfehlen wir folgende Textbausteine:
            </p>

            <div className="space-y-3">
              {suggestions.slice(0, maxSuggestions).map(suggestion => (
                <SuggestionCard
                  key={suggestion.clause.id}
                  suggestion={suggestion}
                  onAdd={() => handleAddClause(suggestion.clause.id)}
                />
              ))}
            </div>

            {suggestions.length > maxSuggestions && (
              <p className="text-xs text-muted-foreground mt-4 text-center">
                +{suggestions.length - maxSuggestions} weitere Empfehlungen verfügbar
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default ClauseSuggestions;
