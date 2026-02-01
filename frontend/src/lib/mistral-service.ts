/**
 * Mistral AI Service - Fallback für komplexe Anfragen
 *
 * Wird NUR verwendet wenn die lokale Regex-Engine nicht ausreicht.
 * EU-hosted (Frankreich), DSGVO-freundlich.
 *
 * Kosten: ~0.25€/1M Tokens (Mistral Small)
 */

import { parseIntent, type ParsedIntent } from './intent-parser';

// =============================================================================
// Types
// =============================================================================

export interface MistralConfig {
  apiKey: string;
  model?: 'mistral-small-latest' | 'mistral-medium-latest' | 'mistral-large-latest';
  maxTokens?: number;
}

export interface MistralResponse {
  intent: ParsedIntent;
  message: string;
  suggestedActions: SuggestedAction[];
  provider: 'local' | 'mistral';
  processingTime: number;
}

export interface SuggestedAction {
  action: 'create_draft' | 'update_field' | 'search_clause' | 'navigate';
  documentType?: string;
  initialData?: Record<string, unknown>;
  field?: string;
  value?: unknown;
  query?: string;
  path?: string;
}

// =============================================================================
// System Prompt
// =============================================================================

const SYSTEM_PROMPT = `Du bist ein Assistent für ein HR-Dokumentenmanagementsystem. Deine Aufgabe ist es, Benutzeranfragen zu verstehen und strukturierte Daten zu extrahieren.

VERFÜGBARE DOKUMENTTYPEN:

PHASE 1 - EINSTELLUNG & ONBOARDING:
- "Arbeitsvertrag Vollzeit" (Kategorie: Einstellung)
- "Arbeitsvertrag Teilzeit" (Kategorie: Einstellung)
- "Arbeitsvertrag Minijob" (Kategorie: Einstellung)
- "Arbeitsvertrag Befristet" (Kategorie: Einstellung)
- "Einstellungszusage" (Kategorie: Einstellung)
- "Absageschreiben" (Kategorie: Recruiting)
- "Verschwiegenheitserklärung" (Kategorie: Einstellung)

PHASE 2 - LAUFENDES ARBEITSVERHÄLTNIS:
- "Nachtrag zum Arbeitsvertrag" (Kategorie: Vertragsänderung)
- "Gehaltserhöhungsschreiben" (Kategorie: Vertragsänderung)
- "Beförderungsschreiben" (Kategorie: Vertragsänderung)
- "Versetzungsschreiben" (Kategorie: Vertragsänderung)
- "Arbeitszeitänderung" (Kategorie: Vertragsänderung)
- "Elternzeit-Bestätigung" (Kategorie: Abwesenheit)
- "Abmahnung" (Kategorie: Disziplinar)
- "Homeoffice-Vereinbarung" (Kategorie: Vereinbarung)
- "Bonusvereinbarung" (Kategorie: Vereinbarung)
- "Firmenwagen-Vereinbarung" (Kategorie: Vereinbarung)
- "Überstundenvereinbarung" (Kategorie: Vereinbarung)
- "Fortbildungsvereinbarung" (Kategorie: Vereinbarung)

PHASE 3 - BEENDIGUNG:
- "Kündigung" (Kategorie: Beendigung)
- "Fristlose Kündigung" (Kategorie: Beendigung)
- "Kündigungsbestätigung" (Kategorie: Beendigung)
- "Aufhebungsvertrag" (Kategorie: Beendigung)
- "Arbeitszeugnis Qualifiziert" (Kategorie: Beendigung)
- "Arbeitszeugnis Einfach" (Kategorie: Beendigung)
- "Zwischenzeugnis" (Kategorie: Zeugnis)
- "Freistellungserklärung" (Kategorie: Beendigung)
- "Arbeitsbescheinigung" (Kategorie: Beendigung)

SONSTIGE:
- "Probezeitbestätigung" (Kategorie: Bestätigung)
- "Urlaubsantrag" (Kategorie: Abwesenheit)
- "Dienstanweisung" (Kategorie: Anweisung)

VERFÜGBARE FELDER:
- first_name: Vorname des Mitarbeiters
- last_name: Nachname des Mitarbeiters
- salary: Monatliches Bruttogehalt (Zahl)
- position: Stellenbezeichnung
- department: Abteilung
- start_date: Startdatum (Format: DD.MM.YYYY)
- end_date: Enddatum (Format: DD.MM.YYYY)
- working_hours: Wochenstunden (Zahl)
- vacation_days: Jahresurlaub in Tagen (Zahl)
- probation_months: Probezeit in Monaten (Zahl)
- email: E-Mail-Adresse
- phone: Telefonnummer
- street: Straße und Hausnummer
- postal_code: Postleitzahl
- city: Stadt
- original_contract_date: Datum des ursprünglichen Vertrags (für Nachträge)
- incident_date: Datum des Vorfalls (für Abmahnung)
- incident_description: Beschreibung des Vorfalls (für Abmahnung)
- severance_amount: Abfindungsbetrag (für Aufhebungsvertrag)
- employment_start: Beschäftigungsbeginn (für Zeugnisse)
- employment_end: Beschäftigungsende (für Zeugnisse)
- training_description: Fortbildungsthema (für Fortbildungsvereinbarung)

ANTWORTFORMAT (NUR JSON, keine Erklärungen):
{
  "intent_type": "create_document" | "fill_field" | "search" | "unknown",
  "document_type": "Dokumenttyp Name" | null,
  "extracted_data": { "field_name": "value", ... },
  "confidence": 0.0-1.0,
  "suggested_action": "create_draft" | "update_field" | "search_clause" | null,
  "response_message": "Kurze, hilfreiche Antwort auf Deutsch"
}

REGELN:
1. Antworte NUR mit validem JSON
2. Extrahiere alle erkennbaren Daten aus der Anfrage
3. Bei Gehältern: Konvertiere in Monatswerte (Zahl ohne €)
4. Bei Datumsangaben: Konvertiere in YYYY-MM-DD
5. Sei freundlich aber kurz in response_message
6. Wenn unklar, frage nach in response_message`;

// =============================================================================
// Mistral API Client
// =============================================================================

class MistralService {
  private apiKey: string | null = null;
  private model: string = 'mistral-small-latest';
  private baseUrl = 'https://api.mistral.ai/v1';

  /**
   * Konfiguriert den Service mit API Key
   */
  configure(config: MistralConfig): void {
    this.apiKey = config.apiKey;
    this.model = config.model || 'mistral-small-latest';
  }

  /**
   * Prüft ob der Service konfiguriert ist
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Verarbeitet eine Nachricht - erst lokal, dann Mistral falls nötig
   */
  async processMessage(
    message: string,
    context?: Record<string, unknown>
  ): Promise<MistralResponse> {
    const startTime = performance.now();

    // 1. Erst lokale Verarbeitung versuchen
    const localResult = parseIntent(message);

    // 2. Prüfen ob lokal ausreichend
    if (localResult.confidence >= 0.7 && localResult.intentType !== 'unknown') {
      return {
        intent: localResult,
        message: this.generateLocalMessage(localResult),
        suggestedActions: this.generateSuggestedActions(localResult),
        provider: 'local',
        processingTime: performance.now() - startTime,
      };
    }

    // 3. Mistral Fallback (nur wenn konfiguriert)
    if (!this.apiKey) {
      // Kein API Key - nutze lokales Ergebnis mit Warnung
      return {
        intent: localResult,
        message: localResult.confidence > 0.3
          ? this.generateLocalMessage(localResult)
          : 'Ich konnte Ihre Anfrage nicht vollständig verstehen. Bitte formulieren Sie sie etwas genauer.',
        suggestedActions: this.generateSuggestedActions(localResult),
        provider: 'local',
        processingTime: performance.now() - startTime,
      };
    }

    // 4. Mistral API aufrufen
    try {
      const mistralResult = await this.callMistralAPI(message, context);
      return {
        ...mistralResult,
        processingTime: performance.now() - startTime,
      };
    } catch (error) {
      console.error('Mistral API error:', error);
      // Fallback auf lokales Ergebnis
      return {
        intent: localResult,
        message: 'Es gab ein Problem mit der KI-Verarbeitung. Hier ist meine beste lokale Einschätzung.',
        suggestedActions: this.generateSuggestedActions(localResult),
        provider: 'local',
        processingTime: performance.now() - startTime,
      };
    }
  }

  /**
   * Ruft die Mistral API auf
   */
  private async callMistralAPI(
    message: string,
    context?: Record<string, unknown>
  ): Promise<Omit<MistralResponse, 'processingTime'>> {
    const contextStr = context
      ? `\n\nAKTUELLER KONTEXT:\n${JSON.stringify(context, null, 2)}`
      : '';

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message + contextStr },
        ],
        max_tokens: 500,
        temperature: 0.1, // Niedrig für konsistente Extraktion
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Mistral API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from Mistral');
    }

    // Parse JSON response
    const parsed = JSON.parse(content);

    const intent: ParsedIntent = {
      intentType: parsed.intent_type || 'unknown',
      documentType: parsed.document_type || null,
      extractedData: parsed.extracted_data || {},
      confidence: parsed.confidence || 0.5,
      processedLocally: false,
      originalMessage: message,
    };

    return {
      intent,
      message: parsed.response_message || 'Anfrage verarbeitet.',
      suggestedActions: this.generateSuggestedActions(intent, parsed.suggested_action),
      provider: 'mistral',
    };
  }

  /**
   * Generiert eine Nachricht für lokale Ergebnisse
   */
  private generateLocalMessage(intent: ParsedIntent): string {
    const dataCount = Object.keys(intent.extractedData).length;

    if (intent.intentType === 'create_document' && intent.documentType) {
      if (dataCount > 0) {
        return `Ich erstelle einen ${intent.documentType} mit ${dataCount} vorausgefüllten Feldern.`;
      }
      return `Ich erstelle einen ${intent.documentType} für Sie.`;
    }

    if (intent.intentType === 'fill_field' && dataCount > 0) {
      return `Ich habe ${dataCount} Feld${dataCount > 1 ? 'er' : ''} erkannt.`;
    }

    if (dataCount > 0) {
      return `Ich habe folgende Daten erkannt: ${Object.keys(intent.extractedData).join(', ')}.`;
    }

    return 'Bitte beschreiben Sie, welches Dokument Sie erstellen möchten.';
  }

  /**
   * Generiert Aktionsvorschläge
   */
  private generateSuggestedActions(
    intent: ParsedIntent,
    _suggestedAction?: string
  ): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    if (intent.intentType === 'create_document' && intent.documentType) {
      actions.push({
        action: 'create_draft',
        documentType: intent.documentType,
        initialData: intent.extractedData,
      });
    }

    if (intent.intentType === 'fill_field' && Object.keys(intent.extractedData).length > 0) {
      for (const [field, value] of Object.entries(intent.extractedData)) {
        actions.push({
          action: 'update_field',
          field,
          value,
        });
      }
    }

    if (intent.intentType === 'search') {
      actions.push({
        action: 'search_clause',
        query: intent.originalMessage,
      });
    }

    return actions;
  }
}

// Singleton-Instanz
export const mistralService = new MistralService();

/**
 * Konfiguriert den Mistral Service
 */
export function configureMistral(apiKey: string, model?: MistralConfig['model']): void {
  mistralService.configure({ apiKey, model });
}

/**
 * Verarbeitet eine Nachricht mit dem Smart Mode
 */
export async function processSmartMessage(
  message: string,
  context?: Record<string, unknown>
): Promise<MistralResponse> {
  return mistralService.processMessage(message, context);
}

export default mistralService;
