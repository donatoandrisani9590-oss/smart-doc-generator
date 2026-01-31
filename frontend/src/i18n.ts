import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
    de: {
        translation: {
            // Navigation
            'nav.dashboard': 'Dashboard',
            'nav.generate': 'Dokument erstellen',
            'nav.documents': 'Meine Dokumente',
            'nav.drafts': 'Entwürfe',
            'nav.admin.settings': 'Design-Manager',
            'nav.admin.clauses': 'Klausel-Bibliothek',
            'nav.admin.templates': 'Dokumentvorlagen',

            // Document Generator
            'generator.title': 'Dokument erstellen',
            'generator.select_type': 'Dokumenttyp wählen',
            'generator.form.section.personal': 'Mitarbeiterdaten',
            'generator.form.section.contract': 'Vertragsdaten',
            'generator.form.section.salary': 'Vergütung',
            'generator.form.section.options': 'Optionale Bausteine',
            'generator.form.section.custom': 'Individualvereinbarung',

            // Fields
            'field.firstName': 'Vorname',
            'field.lastName': 'Nachname',
            'field.birthDate': 'Geburtsdatum',
            'field.address': 'Adresse',
            'field.startDate': 'Eintrittsdatum',
            'field.position': 'Position',
            'field.hoursPerWeek': 'Wochenstunden',
            'field.salary': 'Monatsgehalt (brutto)',
            'field.companyCar': 'Firmenwagen',
            'field.homeOffice': 'Homeoffice-Regelung',
            'field.probation': 'Probezeit',

            // Actions
            'action.save': 'Speichern',
            'action.saveDraft': 'Als Entwurf speichern',
            'action.download.docx': 'Als DOCX',
            'action.download.pdf': 'Als PDF',
            'action.preview': 'Vorschau',

            // Preview
            'preview.title': 'Live-Vorschau',
            'preview.placeholder': 'Wählen Sie ein Dokument, um eine Live-Vorschau zu sehen.',
            'preview.page': 'Seite',
            'preview.of': 'von',

            // Drafts
            'drafts.title': 'Meine Entwürfe',
            'drafts.unnamed': 'Unbenannter Entwurf',
            'drafts.continue': 'Fortsetzen',
            'drafts.delete': 'Löschen',
            'drafts.lastEdited': 'Zuletzt bearbeitet',

            // Messages
            'message.saved': 'Gespeichert',
            'message.autoSaved': 'Automatisch gespeichert um {time}',
            'message.generating': 'Dokument wird erstellt...',
            'message.error': 'Ein Fehler ist aufgetreten',

            // Validation (v4.2.1)
            'validation.required': 'Dieses Feld ist erforderlich',
            'validation.email': 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
            'validation.minLength': 'Mindestens {{min}} Zeichen erforderlich',
            'validation.maxLength': 'Maximal {{max}} Zeichen erlaubt',
            'validation.minValue': 'Mindestwert: {{min}}',
            'validation.maxValue': 'Maximalwert: {{max}}',
            'validation.pattern': 'Ungültiges Format',
            'validation.number': 'Bitte geben Sie eine gültige Zahl ein',
            'validation.date': 'Bitte geben Sie ein gültiges Datum ein',
            'validation.missingFields': 'Bitte füllen Sie alle Pflichtfelder aus',
            'validation.formComplete': 'Alle Pflichtfelder sind ausgefüllt',
        }
    },
    it: {
        translation: {
            // Navigation
            'nav.dashboard': 'Dashboard',
            'nav.generate': 'Crea documento',
            'nav.documents': 'I miei documenti',
            'nav.drafts': 'Bozze',
            'nav.admin.settings': 'Gestione Design',
            'nav.admin.clauses': 'Biblioteca Clausole',
            'nav.admin.templates': 'Modelli documento',

            // Document Generator
            'generator.title': 'Crea documento',
            'generator.select_type': 'Seleziona tipo documento',
            'generator.form.section.personal': 'Dati dipendente',
            'generator.form.section.contract': 'Dati contrattuali',
            'generator.form.section.salary': 'Retribuzione',
            'generator.form.section.options': 'Opzioni aggiuntive',
            'generator.form.section.custom': 'Accordo individuale',

            // Fields
            'field.firstName': 'Nome',
            'field.lastName': 'Cognome',
            'field.birthDate': 'Data di nascita',
            'field.address': 'Indirizzo',
            'field.startDate': 'Data di inizio',
            'field.position': 'Posizione',
            'field.hoursPerWeek': 'Ore settimanali',
            'field.salary': 'Stipendio mensile (lordo)',
            'field.companyCar': 'Auto aziendale',
            'field.homeOffice': 'Lavoro da casa',
            'field.probation': 'Periodo di prova',

            // Actions
            'action.save': 'Salva',
            'action.saveDraft': 'Salva come bozza',
            'action.download.docx': 'Come DOCX',
            'action.download.pdf': 'Come PDF',
            'action.preview': 'Anteprima',

            // Preview
            'preview.title': 'Anteprima live',
            'preview.placeholder': 'Seleziona un documento per vedere l\'anteprima.',
            'preview.page': 'Pagina',
            'preview.of': 'di',

            // Drafts
            'drafts.title': 'Le mie bozze',
            'drafts.unnamed': 'Bozza senza nome',
            'drafts.continue': 'Continua',
            'drafts.delete': 'Elimina',
            'drafts.lastEdited': 'Ultima modifica',

            // Messages
            'message.saved': 'Salvato',
            'message.autoSaved': 'Salvato automaticamente alle {time}',
            'message.generating': 'Generazione documento...',
            'message.error': 'Si è verificato un errore',

            // Validation (v4.2.1)
            'validation.required': 'Questo campo è obbligatorio',
            'validation.email': 'Inserire un indirizzo e-mail valido',
            'validation.minLength': 'Minimo {{min}} caratteri richiesti',
            'validation.maxLength': 'Massimo {{max}} caratteri consentiti',
            'validation.minValue': 'Valore minimo: {{min}}',
            'validation.maxValue': 'Valore massimo: {{max}}',
            'validation.pattern': 'Formato non valido',
            'validation.number': 'Inserire un numero valido',
            'validation.date': 'Inserire una data valida',
            'validation.missingFields': 'Compilare tutti i campi obbligatori',
            'validation.formComplete': 'Tutti i campi obbligatori sono compilati',
        }
    }
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: 'de', // Default language
        fallbackLng: 'de',
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
