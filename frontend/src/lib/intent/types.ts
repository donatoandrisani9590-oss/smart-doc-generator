/**
 * Intent Parser - Type Definitions
 *
 * Alle TypeScript Interfaces und Types fuer den Intent Parser.
 */

export interface ParsedIntent {
  /** Erkannter Intent-Typ */
  intentType: 'create_document' | 'fill_field' | 'search' | 'unknown';
  /** Erkannter Dokumenttyp (falls vorhanden) */
  documentType: string | null;
  /** Extrahierte Daten */
  extractedData: Record<string, string | number>;
  /** Konfidenz (0-1) */
  confidence: number;
  /** Wurde lokal verarbeitet? */
  processedLocally: boolean;
  /** Urspruengliche Nachricht */
  originalMessage: string;
  /** Fehlende empfohlene Felder */
  missingFields?: string[];
  /** Intelligente Vorschlaege fuer naechste Eingabe */
  suggestions?: string[];
  /** Arbeitszeit-Typ */
  workType?: 'vollzeit' | 'teilzeit';
  /** Befristung */
  contractType?: 'befristet' | 'unbefristet';
}

export interface DocumentTypeMapping {
  keywords: string[];
  documentType: string;
  category: string;
}
