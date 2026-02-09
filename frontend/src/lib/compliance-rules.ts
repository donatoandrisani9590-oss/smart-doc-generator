/**
 * Compliance Rules for Document Generation
 *
 * This module contains compliance check rules based on
 * country code and document type.
 *
 * NOTE: This is not legal advice. The rules serve only
 * as a guideline / orientation aid.
 */

// ============================================================================
// Types
// ============================================================================

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  /** Clause names that can satisfy this rule */
  satisfiedByClauseNames: string[];
  /** Optional clause IDs that can satisfy this rule */
  satisfiedByClauseIds?: number[];
  /** Legal basis reference */
  legalBasis?: string;
  /** Only applies to specific document types (empty = all) */
  applicableDocumentTypes?: string[];
  /** Condition function based on form data */
  condition?: (formData: Record<string, unknown>) => boolean;
}

export interface ComplianceResult {
  ruleId: string;
  ruleName: string;
  status: 'passed' | 'failed' | 'warning';
  severity: 'error' | 'warning' | 'info';
  message: string;
  legalBasis?: string;
  suggestedClauseNames?: string[];
}

export interface ComplianceCheckResult {
  score: number;
  maxScore: number;
  percentage: number;
  results: ComplianceResult[];
  passedCount: number;
  failedCount: number;
  warningCount: number;
}

// ============================================================================
// Compliance Rules per Country
// ============================================================================

/**
 * German compliance rules (DE)
 * Based on BGB, NachwG, BUrlG, ArbZG, BDSG/DSGVO
 */
export const complianceRulesDE: ComplianceRule[] = [
  // --- Employment contract mandatory fields per NachwG ---
  {
    id: 'de-nachwg-kuendigung',
    name: 'Kündigungsfrist',
    description: 'Die Kündigungsfrist muss gemäß NachwG angegeben werden.',
    severity: 'error',
    satisfiedByClauseNames: ['kuendigungsfrist', 'kuendigung', 'beendigung', 'vertragsbeendigung'],
    legalBasis: '§ 622 BGB, § 2 Abs. 1 Nr. 9 NachwG',
    applicableDocumentTypes: ['arbeitsvertrag', 'employment_contract', 'anstellungsvertrag', 'arbeitsvertrag vollzeit', 'arbeitsvertrag teilzeit', 'arbeitsvertrag minijob', 'arbeitsvertrag befristet'],
  },
  {
    id: 'de-nachwg-arbeitszeit',
    name: 'Arbeitszeit',
    description: 'Die vereinbarte Arbeitszeit muss angegeben werden.',
    severity: 'error',
    satisfiedByClauseNames: ['arbeitszeit', 'arbeitszeitregelung', 'woechentliche_arbeitszeit'],
    legalBasis: '§ 2 Abs. 1 Nr. 7 NachwG, ArbZG',
    applicableDocumentTypes: ['arbeitsvertrag', 'employment_contract', 'anstellungsvertrag', 'arbeitsvertrag vollzeit', 'arbeitsvertrag teilzeit', 'arbeitsvertrag minijob', 'arbeitsvertrag befristet'],
  },
  {
    id: 'de-burlg-urlaub',
    name: 'Urlaubsanspruch',
    description: 'Der jährliche Urlaubsanspruch muss geregelt werden (min. 20 Tage bei 5-Tage-Woche).',
    severity: 'error',
    satisfiedByClauseNames: ['urlaub', 'urlaubsanspruch', 'jahresurlaub', 'erholungsurlaub'],
    legalBasis: '§ 3 BUrlG, § 2 Abs. 1 Nr. 8 NachwG',
    applicableDocumentTypes: ['arbeitsvertrag', 'employment_contract', 'anstellungsvertrag', 'arbeitsvertrag vollzeit', 'arbeitsvertrag teilzeit', 'arbeitsvertrag minijob', 'arbeitsvertrag befristet'],
  },
  {
    id: 'de-nachwg-verguetung',
    name: 'Vergütung',
    description: 'Die Höhe und Zusammensetzung der Vergütung muss angegeben werden.',
    severity: 'error',
    satisfiedByClauseNames: ['verguetung', 'gehalt', 'lohn', 'entgelt', 'bezuege'],
    legalBasis: '§ 2 Abs. 1 Nr. 6 NachwG',
    applicableDocumentTypes: ['arbeitsvertrag', 'employment_contract', 'anstellungsvertrag', 'arbeitsvertrag vollzeit', 'arbeitsvertrag teilzeit', 'arbeitsvertrag minijob', 'arbeitsvertrag befristet'],
  },
  {
    id: 'de-nachwg-taetigkeit',
    name: 'Tätigkeitsbeschreibung',
    description: 'Die zu leistende Tätigkeit muss beschrieben werden.',
    severity: 'error',
    satisfiedByClauseNames: ['taetigkeit', 'taetigkeitsbeschreibung', 'aufgaben', 'position'],
    legalBasis: '§ 2 Abs. 1 Nr. 5 NachwG',
    applicableDocumentTypes: ['arbeitsvertrag', 'employment_contract', 'anstellungsvertrag', 'arbeitsvertrag vollzeit', 'arbeitsvertrag teilzeit', 'arbeitsvertrag minijob', 'arbeitsvertrag befristet'],
  },

  // --- GDPR/BDSG ---
  {
    id: 'de-dsgvo-datenschutz',
    name: 'Datenschutz-Textbaustein',
    description: 'Ein Datenschutz-Textbaustein ist nach DSGVO erforderlich.',
    severity: 'error',
    satisfiedByClauseNames: ['datenschutz', 'dsgvo', 'datenschutzhinweis', 'personenbezogene_daten'],
    legalBasis: 'Art. 13, 14 DSGVO, § 26 BDSG',
    applicableDocumentTypes: ['arbeitsvertrag', 'employment_contract', 'anstellungsvertrag', 'dienstleistungsvertrag'],
  },

  // --- Recommended clauses ---
  {
    id: 'de-recommend-probezeit',
    name: 'Probezeit',
    description: 'Eine Probezeit-Regelung wird empfohlen.',
    severity: 'warning',
    satisfiedByClauseNames: ['probezeit', 'probezeitregelung'],
    legalBasis: '§ 622 Abs. 3 BGB',
    applicableDocumentTypes: ['arbeitsvertrag', 'employment_contract', 'anstellungsvertrag', 'arbeitsvertrag vollzeit', 'arbeitsvertrag teilzeit', 'arbeitsvertrag minijob', 'arbeitsvertrag befristet'],
  },
  {
    id: 'de-recommend-nebentaetigkeit',
    name: 'Nebentätigkeit',
    description: 'Eine Regelung zu Nebentätigkeiten wird empfohlen.',
    severity: 'info',
    satisfiedByClauseNames: ['nebentaetigkeit', 'nebenberufliche_taetigkeit', 'nebenbeschaeftigung'],
    applicableDocumentTypes: ['arbeitsvertrag', 'employment_contract', 'anstellungsvertrag', 'arbeitsvertrag vollzeit', 'arbeitsvertrag teilzeit', 'arbeitsvertrag minijob', 'arbeitsvertrag befristet'],
  },
  {
    id: 'de-recommend-verschwiegenheit',
    name: 'Verschwiegenheitspflicht',
    description: 'Eine Geheimhaltungs-Textbaustein wird empfohlen.',
    severity: 'warning',
    satisfiedByClauseNames: ['verschwiegenheit', 'geheimhaltung', 'vertraulichkeit', 'nda'],
    applicableDocumentTypes: ['arbeitsvertrag', 'employment_contract', 'anstellungsvertrag', 'dienstleistungsvertrag'],
  },

  // --- Special rules based on form data ---
  {
    id: 'de-fuehrung-wettbewerb',
    name: 'Wettbewerbsverbot',
    description: 'Für Führungspositionen wird ein nachvertragliches Wettbewerbsverbot empfohlen.',
    severity: 'warning',
    satisfiedByClauseNames: ['wettbewerbsverbot', 'konkurrenzverbot', 'wettbewerbsklausel'],
    legalBasis: '§§ 74 ff. HGB',
    applicableDocumentTypes: ['arbeitsvertrag', 'employment_contract', 'anstellungsvertrag', 'arbeitsvertrag vollzeit', 'arbeitsvertrag teilzeit', 'arbeitsvertrag minijob', 'arbeitsvertrag befristet'],
    condition: (formData) => {
      const position = String(formData.position || formData.jobTitle || '').toLowerCase();
      const isFuehrung = ['geschäftsführer', 'director', 'leiter', 'head', 'ceo', 'cto', 'cfo', 'manager', 'vorstand']
        .some(term => position.includes(term));
      return isFuehrung;
    },
  },
  {
    id: 'de-it-ip-rechte',
    name: 'IP-Rechte / Erfindungen',
    description: 'Für IT-Positionen sollten Regelungen zu geistigem Eigentum getroffen werden.',
    severity: 'warning',
    satisfiedByClauseNames: ['ip_rechte', 'erfindungen', 'urheberrecht', 'arbeitnehmererfindung', 'intellectual_property'],
    legalBasis: 'ArbNErfG, UrhG',
    applicableDocumentTypes: ['arbeitsvertrag', 'employment_contract', 'anstellungsvertrag', 'arbeitsvertrag vollzeit', 'arbeitsvertrag teilzeit', 'arbeitsvertrag minijob', 'arbeitsvertrag befristet'],
    condition: (formData) => {
      const position = String(formData.position || formData.jobTitle || formData.department || '').toLowerCase();
      const isIT = ['it', 'software', 'entwickler', 'developer', 'engineer', 'tech', 'data', 'devops']
        .some(term => position.includes(term));
      return isIT;
    },
  },
  {
    id: 'de-ueberstunden',
    name: 'Überstundenregelung',
    description: 'Eine Regelung zu Überstunden und deren Vergütung wird empfohlen.',
    severity: 'warning',
    satisfiedByClauseNames: ['ueberstunden', 'mehrarbeit', 'ueberstundenregelung'],
    legalBasis: 'ArbZG',
    applicableDocumentTypes: ['arbeitsvertrag', 'employment_contract', 'anstellungsvertrag', 'arbeitsvertrag vollzeit', 'arbeitsvertrag teilzeit', 'arbeitsvertrag minijob', 'arbeitsvertrag befristet'],
    condition: (formData) => {
      const workType = String(formData.employmentType || formData.beschaeftigungsart || '').toLowerCase();
      return workType.includes('vollzeit') || workType.includes('full-time') || !workType;
    },
  },
];

/**
 * Italian compliance rules (IT)
 * Based on Codice Civile, Jobs Act, D.Lgs. 81/2015
 */
export const complianceRulesIT: ComplianceRule[] = [
  {
    id: 'it-ccnl-riferimento',
    name: 'CCNL-Riferimento',
    description: 'Il riferimento al CCNL applicabile deve essere indicato.',
    severity: 'error',
    satisfiedByClauseNames: ['ccnl', 'contratto_collettivo', 'riferimento_ccnl'],
    legalBasis: 'D.Lgs. 152/1997',
    applicableDocumentTypes: ['contratto_lavoro', 'arbeitsvertrag', 'employment_contract'],
  },
  {
    id: 'it-ferie',
    name: 'Ferie',
    description: 'Il diritto alle ferie deve essere specificato (min. 4 settimane).',
    severity: 'error',
    satisfiedByClauseNames: ['ferie', 'urlaub', 'urlaubsanspruch'],
    legalBasis: 'Art. 36 Cost., D.Lgs. 66/2003',
    applicableDocumentTypes: ['contratto_lavoro', 'arbeitsvertrag', 'employment_contract'],
  },
  {
    id: 'it-privacy',
    name: 'Privacy / GDPR',
    description: 'Informativa sulla privacy ai sensi del GDPR.',
    severity: 'error',
    satisfiedByClauseNames: ['privacy', 'gdpr', 'datenschutz', 'dsgvo'],
    legalBasis: 'GDPR Art. 13, 14, D.Lgs. 196/2003',
    applicableDocumentTypes: ['contratto_lavoro', 'arbeitsvertrag', 'employment_contract', 'dienstleistungsvertrag'],
  },
  {
    id: 'it-retribuzione',
    name: 'Retribuzione',
    description: 'La retribuzione deve essere indicata.',
    severity: 'error',
    satisfiedByClauseNames: ['retribuzione', 'stipendio', 'verguetung', 'gehalt'],
    legalBasis: 'Art. 36 Cost., D.Lgs. 152/1997',
    applicableDocumentTypes: ['contratto_lavoro', 'arbeitsvertrag', 'employment_contract'],
  },
  {
    id: 'it-orario',
    name: 'Orario di Lavoro',
    description: 'Lorario di lavoro deve essere specificato.',
    severity: 'error',
    satisfiedByClauseNames: ['orario_lavoro', 'arbeitszeit', 'working_hours'],
    legalBasis: 'D.Lgs. 66/2003',
    applicableDocumentTypes: ['contratto_lavoro', 'arbeitsvertrag', 'employment_contract'],
  },
];

/**
 * Austrian compliance rules (AT)
 */
export const complianceRulesAT: ComplianceRule[] = [
  {
    id: 'at-urlaub',
    name: 'Urlaubsanspruch',
    description: 'Der Urlaubsanspruch muss gemäß UrlG angegeben werden (min. 25 Werktage).',
    severity: 'error',
    satisfiedByClauseNames: ['urlaub', 'urlaubsanspruch', 'jahresurlaub'],
    legalBasis: '§ 2 UrlG',
    applicableDocumentTypes: ['arbeitsvertrag', 'dienstvertrag', 'employment_contract'],
  },
  {
    id: 'at-kuendigung',
    name: 'Kündigungsfrist',
    description: 'Die Kündigungsfristen müssen angegeben werden.',
    severity: 'error',
    satisfiedByClauseNames: ['kuendigungsfrist', 'kuendigung', 'beendigung'],
    legalBasis: '§ 20 AngG',
    applicableDocumentTypes: ['arbeitsvertrag', 'dienstvertrag', 'employment_contract'],
  },
  {
    id: 'at-kollektivvertrag',
    name: 'Kollektivvertrag',
    description: 'Der anzuwendende Kollektivvertrag muss angegeben werden.',
    severity: 'error',
    satisfiedByClauseNames: ['kollektivvertrag', 'kv', 'tarifvertrag'],
    legalBasis: 'ArbVG',
    applicableDocumentTypes: ['arbeitsvertrag', 'dienstvertrag', 'employment_contract'],
  },
  {
    id: 'at-datenschutz',
    name: 'Datenschutz',
    description: 'Eine Datenschutz-Textbaustein ist nach DSGVO erforderlich.',
    severity: 'error',
    satisfiedByClauseNames: ['datenschutz', 'dsgvo', 'datenschutzhinweis'],
    legalBasis: 'DSGVO, DSG',
    applicableDocumentTypes: ['arbeitsvertrag', 'dienstvertrag', 'employment_contract'],
  },
];

/**
 * Swiss compliance rules (CH)
 */
export const complianceRulesCH: ComplianceRule[] = [
  {
    id: 'ch-ferien',
    name: 'Ferienanspruch',
    description: 'Der Ferienanspruch muss angegeben werden (min. 4 Wochen, 5 Wochen bis 20 Jahre).',
    severity: 'error',
    satisfiedByClauseNames: ['ferien', 'urlaub', 'urlaubsanspruch'],
    legalBasis: 'Art. 329a OR',
    applicableDocumentTypes: ['arbeitsvertrag', 'employment_contract'],
  },
  {
    id: 'ch-kuendigung',
    name: 'Kündigungsfrist',
    description: 'Die Kündigungsfristen müssen angegeben werden.',
    severity: 'error',
    satisfiedByClauseNames: ['kuendigungsfrist', 'kuendigung', 'beendigung'],
    legalBasis: 'Art. 335c OR',
    applicableDocumentTypes: ['arbeitsvertrag', 'employment_contract'],
  },
  {
    id: 'ch-datenschutz',
    name: 'Datenschutz',
    description: 'Eine Datenschutz-Textbaustein wird empfohlen.',
    severity: 'warning',
    satisfiedByClauseNames: ['datenschutz', 'datenschutzhinweis'],
    legalBasis: 'nDSG (neues Datenschutzgesetz)',
    applicableDocumentTypes: ['arbeitsvertrag', 'employment_contract', 'dienstleistungsvertrag'],
  },
];

// ============================================================================
// Rule Registry
// ============================================================================

export const complianceRulesByCountry: Record<string, ComplianceRule[]> = {
  DE: complianceRulesDE,
  IT: complianceRulesIT,
  AT: complianceRulesAT,
  CH: complianceRulesCH,
};

/**
 * Returns compliance rules for a given country code.
 */
export function getComplianceRules(countryCode: string): ComplianceRule[] {
  return complianceRulesByCountry[countryCode.toUpperCase()] || complianceRulesDE;
}

// ============================================================================
// Clause Suggestion Rules
// ============================================================================

export interface ClauseSuggestionRule {
  id: string;
  /** Clause names to suggest */
  suggestedClauseNames: string[];
  /** Short reason for the recommendation */
  reason: string;
  /** Detailed explanation */
  explanation: string;
  /** Priority (higher = more important) */
  priority: number;
  /** Condition that must be met */
  condition: (formData: Record<string, unknown>) => boolean;
}

/**
 * Rules for AI-driven clause suggestions
 */
export const clauseSuggestionRules: ClauseSuggestionRule[] = [
  // --- Employment type ---
  {
    id: 'vollzeit-urlaub',
    suggestedClauseNames: ['urlaub', 'urlaubsanspruch', 'jahresurlaub', 'erholungsurlaub'],
    reason: 'Vollzeit-Vertrag',
    explanation: 'Bei Vollzeitbeschäftigung sollte der Urlaubsanspruch klar geregelt sein. Das BUrlG sieht mindestens 20 Tage bei einer 5-Tage-Woche vor.',
    priority: 90,
    condition: (formData) => {
      const workType = String(formData.employmentType || formData.beschaeftigungsart || '').toLowerCase();
      return workType.includes('vollzeit') || workType.includes('full-time') || workType === '';
    },
  },
  {
    id: 'vollzeit-ueberstunden',
    suggestedClauseNames: ['ueberstunden', 'mehrarbeit', 'ueberstundenregelung'],
    reason: 'Vollzeit-Vertrag',
    explanation: 'Bei Vollzeitbeschäftigung sollte die Vergütung oder der Ausgleich von Überstunden geregelt werden.',
    priority: 70,
    condition: (formData) => {
      const workType = String(formData.employmentType || formData.beschaeftigungsart || '').toLowerCase();
      return workType.includes('vollzeit') || workType.includes('full-time') || workType === '';
    },
  },

  // --- Management position ---
  {
    id: 'fuehrung-wettbewerb',
    suggestedClauseNames: ['wettbewerbsverbot', 'konkurrenzverbot', 'wettbewerbsklausel'],
    reason: 'Führungsposition',
    explanation: 'Führungskräfte haben oft Zugang zu sensiblen Geschäftsgeheimnissen. Ein nachvertragliches Wettbewerbsverbot schützt das Unternehmen.',
    priority: 85,
    condition: (formData) => {
      const position = String(formData.position || formData.jobTitle || '').toLowerCase();
      return ['geschäftsführer', 'director', 'leiter', 'head', 'ceo', 'cto', 'cfo', 'manager', 'vorstand', 'prokura']
        .some(term => position.includes(term));
    },
  },
  {
    id: 'fuehrung-bonus',
    suggestedClauseNames: ['bonus', 'bonusregelung', 'praemie', 'tantieme', 'variable_verguetung'],
    reason: 'Führungsposition',
    explanation: 'Für Führungspositionen ist eine variable Vergütungskomponente (Bonus/Tantieme) üblich.',
    priority: 75,
    condition: (formData) => {
      const position = String(formData.position || formData.jobTitle || '').toLowerCase();
      return ['geschäftsführer', 'director', 'leiter', 'head', 'ceo', 'cto', 'cfo', 'manager', 'vorstand']
        .some(term => position.includes(term));
    },
  },
  {
    id: 'fuehrung-dienstwagen',
    suggestedClauseNames: ['dienstwagen', 'firmenwagen', 'company_car'],
    reason: 'Führungsposition + Gehalt',
    explanation: 'Bei Führungspositionen mit entsprechendem Gehalt ist ein Dienstwagen als Gehaltsbestandteil üblich.',
    priority: 60,
    condition: (formData) => {
      const position = String(formData.position || formData.jobTitle || '').toLowerCase();
      const salary = Number(formData.salary || formData.gehalt || formData.bruttogehalt || 0);
      const isFuehrung = ['geschäftsführer', 'director', 'leiter', 'head', 'ceo', 'cto', 'cfo']
        .some(term => position.includes(term));
      return isFuehrung && salary >= 80000;
    },
  },

  // --- IT department ---
  {
    id: 'it-geheimhaltung',
    suggestedClauseNames: ['geheimhaltung', 'verschwiegenheit', 'vertraulichkeit', 'nda'],
    reason: 'IT-Position',
    explanation: 'IT-Mitarbeiter haben oft Zugang zu sensiblen Systemen und Daten. Eine Geheimhaltungs-Textbaustein ist daher besonders wichtig.',
    priority: 85,
    condition: (formData) => {
      const position = String(formData.position || formData.jobTitle || formData.department || '').toLowerCase();
      return ['it', 'software', 'entwickler', 'developer', 'engineer', 'tech', 'data', 'devops', 'admin', 'security']
        .some(term => position.includes(term));
    },
  },
  {
    id: 'it-ip-rechte',
    suggestedClauseNames: ['ip_rechte', 'erfindungen', 'urheberrecht', 'arbeitnehmererfindung', 'intellectual_property'],
    reason: 'IT-Position',
    explanation: 'Entwickler und IT-Fachkräfte erschaffen oft geistiges Eigentum. Eine Regelung zu IP-Rechten stellt klar, dass Arbeitsergebnisse dem Arbeitgeber gehören.',
    priority: 80,
    condition: (formData) => {
      const position = String(formData.position || formData.jobTitle || formData.department || '').toLowerCase();
      return ['software', 'entwickler', 'developer', 'engineer', 'programmer', 'architect']
        .some(term => position.includes(term));
    },
  },
  {
    id: 'it-homeoffice',
    suggestedClauseNames: ['homeoffice', 'remote_work', 'mobiles_arbeiten', 'telearbeit'],
    reason: 'IT-Position',
    explanation: 'Remote-Arbeit ist in IT-Positionen weit verbreitet. Eine klare Homeoffice-Regelung schafft Rechtssicherheit.',
    priority: 70,
    condition: (formData) => {
      const position = String(formData.position || formData.jobTitle || formData.department || '').toLowerCase();
      return ['it', 'software', 'entwickler', 'developer', 'engineer', 'tech', 'data', 'devops']
        .some(term => position.includes(term));
    },
  },

  // --- High salary ---
  {
    id: 'hohes-gehalt-dienstwagen',
    suggestedClauseNames: ['dienstwagen', 'firmenwagen', 'company_car'],
    reason: 'Gehalt > 80.000 EUR',
    explanation: 'Bei einem Jahresgehalt über 80.000 EUR ist ein Dienstwagen als zusätzlicher Gehaltsbestandteil üblich.',
    priority: 65,
    condition: (formData) => {
      const salary = Number(formData.salary || formData.gehalt || formData.bruttogehalt || 0);
      return salary >= 80000;
    },
  },
  {
    id: 'hohes-gehalt-bonus',
    suggestedClauseNames: ['bonus', 'bonusregelung', 'praemie', 'variable_verguetung'],
    reason: 'Gehalt > 60.000 EUR',
    explanation: 'Bei höheren Gehältern ist eine variable Vergütungskomponente (Bonus) marktüblich.',
    priority: 60,
    condition: (formData) => {
      const salary = Number(formData.salary || formData.gehalt || formData.bruttogehalt || 0);
      return salary >= 60000;
    },
  },
  {
    id: 'hohes-gehalt-bav',
    suggestedClauseNames: ['betriebliche_altersvorsorge', 'bav', 'pension', 'altersvorsorge'],
    reason: 'Gehalt > 70.000 EUR',
    explanation: 'Bei höheren Gehältern ist eine betriebliche Altersvorsorge ein attraktiver Benefit.',
    priority: 55,
    condition: (formData) => {
      const salary = Number(formData.salary || formData.gehalt || formData.bruttogehalt || 0);
      return salary >= 70000;
    },
  },

  // --- Fixed-term contracts ---
  {
    id: 'befristet-probezeit',
    suggestedClauseNames: ['probezeit', 'probezeitregelung'],
    reason: 'Neuer Mitarbeiter',
    explanation: 'Eine Probezeit ermöglicht beiden Seiten, die Zusammenarbeit zu testen. Die verkürzte Kündigungsfrist während der Probezeit bietet Flexibilität.',
    priority: 80,
    condition: () => true, // Always recommended for new contracts
  },

  // --- Sales ---
  {
    id: 'vertrieb-provision',
    suggestedClauseNames: ['provision', 'provisionsregelung', 'vertriebsprovision', 'sales_commission'],
    reason: 'Vertriebsposition',
    explanation: 'Vertriebsmitarbeiter werden oft leistungsabhängig vergütet. Eine klare Provisionsregelung verhindert Streitigkeiten.',
    priority: 85,
    condition: (formData) => {
      const position = String(formData.position || formData.jobTitle || formData.department || '').toLowerCase();
      return ['vertrieb', 'sales', 'account', 'business development', 'key account']
        .some(term => position.includes(term));
    },
  },
  {
    id: 'vertrieb-wettbewerb',
    suggestedClauseNames: ['wettbewerbsverbot', 'konkurrenzverbot', 'kundenschutz'],
    reason: 'Vertriebsposition',
    explanation: 'Vertriebsmitarbeiter haben direkten Kundenkontakt. Ein Wettbewerbsverbot schützt die Kundenbeziehungen.',
    priority: 75,
    condition: (formData) => {
      const position = String(formData.position || formData.jobTitle || formData.department || '').toLowerCase();
      return ['vertrieb', 'sales', 'account', 'key account']
        .some(term => position.includes(term));
    },
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalizes a clause name for comparison (lowercase, umlaut replacement, underscore separation).
 */
export function normalizeClauseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äöüß]/g, match => {
      const map: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
      return map[match] || match;
    })
    .replace(/[-_\s]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Checks whether a clause satisfies a compliance rule (by ID or normalized name).
 */
export function clauseSatisfiesRule(
  clauseName: string,
  clauseId: number | undefined,
  rule: ComplianceRule
): boolean {
  // Check by ID first (most reliable)
  if (clauseId && rule.satisfiedByClauseIds?.includes(clauseId)) {
    return true;
  }

  // Check by normalized name
  const normalizedClauseName = normalizeClauseName(clauseName);
  return rule.satisfiedByClauseNames.some(
    ruleName => normalizeClauseName(ruleName) === normalizedClauseName ||
                normalizedClauseName.includes(normalizeClauseName(ruleName)) ||
                normalizeClauseName(ruleName).includes(normalizedClauseName)
  );
}

/**
 * Calculates the compliance score as a weighted percentage.
 */
export function calculateComplianceScore(results: ComplianceResult[]): number {
  const weights = {
    error: 20,
    warning: 10,
    info: 5,
  };

  let totalWeight = 0;
  let earnedWeight = 0;

  results.forEach(result => {
    const weight = weights[result.severity];
    totalWeight += weight;
    if (result.status === 'passed') {
      earnedWeight += weight;
    }
  });

  if (totalWeight === 0) return 100;
  return Math.round((earnedWeight / totalWeight) * 100);
}
