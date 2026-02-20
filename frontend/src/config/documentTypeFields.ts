/**
 * documentTypeFields — Dokument-Typ-spezifische Zusatzfelder
 *
 * Konfiguration zusätzlicher Formularfelder die abhängig vom gewählten
 * Dokumenttyp erscheinen. Die Keys sind case-insensitive Teilstrings des
 * Dokumenttyp-Namens (z.B. "abmahnung" matched "Schriftliche Abmahnung").
 *
 * Werte landen in WizardContext.dynamicFormValues via updateDynamicField()
 * und werden automatisch an die Generation-API übergeben.
 *
 * Feldtypen:
 *  - text      : Freitexteingabe
 *  - textarea  : Mehrzeiliger Text
 *  - select    : Auswahlmenü mit vordefinierten Optionen
 *  - checkbox  : Boolean-Schalter
 *  - date      : Datumseingabe
 *  - number    : Zahleneingabe
 */

export type FieldType = "text" | "textarea" | "select" | "checkbox" | "date" | "number";

export interface DynamicFieldDefinition {
    key: string;
    label: string;
    type: FieldType;
    placeholder?: string;
    required?: boolean;
    options?: { value: string; label: string }[];
    hint?: string;
    defaultValue?: string | boolean | number;
}

/**
 * Key: case-insensitiver Teilstring des Dokumenttyp-Namens.
 * Value: Array von Felddefinitionen die für diesen Typ zusätzlich angezeigt werden.
 */
export const DOCUMENT_TYPE_FIELDS: Record<string, DynamicFieldDefinition[]> = {

    // ── Abmahnung ─────────────────────────────────────────────────────────────
    abmahnung: [
        {
            key: "abmahnungsgrund",
            label: "Abmahnungsgrund",
            type: "select",
            required: true,
            options: [
                { value: "unpuenktlichkeit", label: "Unpünktlichkeit / Verspätung" },
                { value: "fehlzeiten", label: "Unentschuldigte Fehlzeiten" },
                { value: "schlechtleistung", label: "Schlechtleistung / Pflichtverletzung" },
                { value: "verhalten", label: "Fehlverhalten gegenüber Kollegen/Vorgesetzten" },
                { value: "alkohol", label: "Alkohol- oder Drogenkonsum am Arbeitsplatz" },
                { value: "datenschutz", label: "Datenschutzverletzung" },
                { value: "sonstiges", label: "Sonstiges" },
            ],
            hint: "Wähle den Hauptgrund der Abmahnung für die Klausel-Vorauswahl.",
        },
        {
            key: "abmahnungsdatum_vorfall",
            label: "Datum des Vorfalls",
            type: "date",
            required: true,
            hint: "Wann hat der abgemahnte Vorfall stattgefunden?",
        },
        {
            key: "abmahnung_wiederholungsfall",
            label: "Wiederholungsfall",
            type: "checkbox",
            defaultValue: false,
            hint: "Wurde der Mitarbeiter für dieses Verhalten bereits zuvor abgemahnt?",
        },
        {
            key: "abmahnung_schilderung",
            label: "Sachverhaltsschilderung",
            type: "textarea",
            placeholder: "Beschreibe kurz den konkreten Vorfall (Datum, Uhrzeit, Ort, Zeugen)...",
            hint: "Diese Schilderung wird in den Abmahnungstext übernommen.",
        },
    ],

    // ── Kündigung ─────────────────────────────────────────────────────────────
    kundigung: [
        {
            key: "kuendigungsart",
            label: "Kündigungsart",
            type: "select",
            required: true,
            options: [
                { value: "ordentlich_arbeitgeber", label: "Ordentliche Kündigung durch Arbeitgeber" },
                { value: "ordentlich_arbeitnehmer", label: "Ordentliche Kündigung durch Arbeitnehmer" },
                { value: "ausserordentlich", label: "Außerordentliche fristlose Kündigung" },
                { value: "aufhebung", label: "Aufhebungsvertrag (einvernehmlich)" },
            ],
        },
        {
            key: "kuendigung_grund",
            label: "Kündigungsgrund (intern)",
            type: "select",
            options: [
                { value: "betriebsbedingt", label: "Betriebsbedingt" },
                { value: "verhaltensbedingt", label: "Verhaltensbedingt" },
                { value: "personenbedingt", label: "Personenbedingt" },
                { value: "eigeninitiative", label: "Eigeninitiative Arbeitnehmer" },
            ],
            hint: "Nur intern — wird nicht im Kündigungsschreiben erwähnt.",
        },
        {
            key: "letzter_arbeitstag",
            label: "Letzter Arbeitstag",
            type: "date",
            hint: "Muss die gesetzliche/vertragliche Kündigungsfrist berücksichtigen.",
        },
        {
            key: "freistellung_ab",
            label: "Freistellung ab (optional)",
            type: "date",
            hint: "Leer lassen wenn keine sofortige Freistellung erfolgt.",
        },
        {
            key: "resturlaub_auszahlen",
            label: "Resturlaub auszahlen",
            type: "checkbox",
            defaultValue: false,
        },
    ],

    // ── Aufhebungsvertrag ─────────────────────────────────────────────────────
    aufhebung: [
        {
            key: "aufhebung_datum",
            label: "Beendigungsdatum",
            type: "date",
            required: true,
            hint: "Datum an dem das Arbeitsverhältnis einvernehmlich endet.",
        },
        {
            key: "abfindung_brutto",
            label: "Abfindungsbetrag (EUR brutto)",
            type: "number",
            placeholder: "z.B. 15000",
            hint: "Einmalige Zahlung nach § 1a KSchG. Leer lassen wenn keine Abfindung.",
        },
        {
            key: "aufhebung_geheimhaltung",
            label: "Geheimhaltungsklausel vereinbaren",
            type: "checkbox",
            defaultValue: true,
        },
        {
            key: "aufhebung_zeugnis_art",
            label: "Zeugnisart",
            type: "select",
            options: [
                { value: "einfach", label: "Einfaches Zeugnis" },
                { value: "qualifiziert", label: "Qualifiziertes Zeugnis" },
                { value: "kein", label: "Kein Zeugnis vereinbart" },
            ],
            defaultValue: "qualifiziert",
        },
    ],

    // ── Elternzeit ────────────────────────────────────────────────────────────
    elternzeit: [
        {
            key: "elternzeit_von",
            label: "Elternzeit von",
            type: "date",
            required: true,
        },
        {
            key: "elternzeit_bis",
            label: "Elternzeit bis",
            type: "date",
            required: true,
        },
        {
            key: "elterngeld_bezug",
            label: "Elterngeld wird beantragt",
            type: "checkbox",
            defaultValue: true,
        },
        {
            key: "teilzeit_waehrend_elternzeit",
            label: "Teilzeittätigkeit während Elternzeit",
            type: "checkbox",
            defaultValue: false,
            hint: "Bis zu 32 Stunden/Woche zulässig (§ 15 BEEG).",
        },
        {
            key: "elternzeit_teilzeit_stunden",
            label: "Teilzeit-Wochenstunden (falls zutreffend)",
            type: "number",
            placeholder: "z.B. 20",
        },
    ],

    // ── Zeugnis ───────────────────────────────────────────────────────────────
    zeugnis: [
        {
            key: "zeugnis_art",
            label: "Zeugnisart",
            type: "select",
            required: true,
            options: [
                { value: "einfach", label: "Einfaches Zeugnis (nur Tätigkeit)" },
                { value: "qualifiziert", label: "Qualifiziertes Zeugnis (mit Beurteilung)" },
                { value: "zwischenzeugnis", label: "Zwischenzeugnis" },
            ],
            defaultValue: "qualifiziert",
        },
        {
            key: "zeugnis_gesamtnote",
            label: "Gesamtbeurteilung",
            type: "select",
            options: [
                { value: "1", label: "Sehr gut (Note 1)" },
                { value: "2", label: "Gut (Note 2)" },
                { value: "3", label: "Befriedigend (Note 3)" },
                { value: "4", label: "Ausreichend (Note 4)" },
            ],
            defaultValue: "2",
            hint: "Entsprechend dem Zeugniscodex: Note 2 = 'stets zur vollsten Zufriedenheit'.",
        },
        {
            key: "zeugnis_austrittsgrund",
            label: "Austrittsformel aufnehmen",
            type: "checkbox",
            defaultValue: true,
            hint: "Empfohlen: 'Herr/Frau X verlässt unser Unternehmen auf eigenen Wunsch'.",
        },
    ],

    // ── Versetzung / Änderungsvertrag ─────────────────────────────────────────
    versetzung: [
        {
            key: "neuer_arbeitsort",
            label: "Neuer Arbeitsort",
            type: "text",
            placeholder: "z.B. München, Filiale Nord",
            required: true,
        },
        {
            key: "neue_abteilung",
            label: "Neue Abteilung / Kostenstelle",
            type: "text",
            placeholder: "z.B. Vertrieb Süd",
        },
        {
            key: "versetzung_ab",
            label: "Versetzung wirksam ab",
            type: "date",
            required: true,
        },
        {
            key: "versetzung_mit_gehaltsanpassung",
            label: "Mit Gehaltsanpassung",
            type: "checkbox",
            defaultValue: false,
        },
    ],
};

/**
 * Findet die passende Feldkonfiguration für einen Dokumenttyp-Namen.
 * Case-insensitiver Teilstring-Match. Längere (spezifischere) Keys gewinnen
 * bei Überschneidungen (z.B. "aufhebung" vor "kundigung").
 *
 * @example
 * getFieldsForDocumentType("Abmahnung wegen Unpünktlichkeit")
 * // → Array<DynamicFieldDefinition> für "abmahnung"
 */
export function getFieldsForDocumentType(documentTypeName: string): DynamicFieldDefinition[] {
    const nameLower = documentTypeName.toLowerCase();
    const sortedEntries = Object.entries(DOCUMENT_TYPE_FIELDS)
        .sort(([a], [b]) => b.length - a.length); // longer keys = more specific, matched first
    for (const [key, fields] of sortedEntries) {
        if (nameLower.includes(key)) {
            return fields;
        }
    }
    return [];
}
