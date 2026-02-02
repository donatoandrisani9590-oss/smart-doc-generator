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
            'nav.admin.countries': 'Länderkonfiguration',
            'nav.admin.locations': 'Standorte',

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
            'field.country': 'Land',
            'field.location': 'Standort',

            // Actions
            'action.save': 'Speichern',
            'action.saveDraft': 'Als Entwurf speichern',
            'action.download.docx': 'Als DOCX',
            'action.download.pdf': 'Als PDF',
            'action.preview': 'Vorschau',
            'action.cancel': 'Abbrechen',
            'action.confirm': 'Bestätigen',
            'action.delete': 'Löschen',
            'action.edit': 'Bearbeiten',
            'action.create': 'Erstellen',
            'action.close': 'Schließen',

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
            'message.success': 'Erfolgreich',
            'message.loading': 'Wird geladen...',

            // Auth (v3.1)
            'auth.login': 'Anmelden',
            'auth.logout': 'Abmelden',
            'auth.register': 'Registrieren',
            'auth.email': 'E-Mail',
            'auth.password': 'Passwort',
            'auth.confirmPassword': 'Passwort bestätigen',
            'auth.forgotPassword': 'Passwort vergessen?',
            'auth.noAccount': 'Noch kein Konto?',
            'auth.hasAccount': 'Bereits ein Konto?',
            'auth.welcome': 'Willkommen',
            'auth.loginDescription': 'Melden Sie sich an, um auf das HR-Dokumentensystem zuzugreifen',

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
            'validation.passwordMismatch': 'Passwörter stimmen nicht überein',
            'validation.passwordTooShort': 'Passwort muss mindestens 8 Zeichen lang sein',

            // Countries (v3.1)
            'country.DE': 'Deutschland',
            'country.IT': 'Italien',
            'country.ES': 'Spanien',
            'country.AT': 'Österreich',
            'country.FR': 'Frankreich',
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
            'nav.admin.countries': 'Configurazione paesi',
            'nav.admin.locations': 'Sedi',

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
            'field.country': 'Paese',
            'field.location': 'Sede',

            // Actions
            'action.save': 'Salva',
            'action.saveDraft': 'Salva come bozza',
            'action.download.docx': 'Come DOCX',
            'action.download.pdf': 'Come PDF',
            'action.preview': 'Anteprima',
            'action.cancel': 'Annulla',
            'action.confirm': 'Conferma',
            'action.delete': 'Elimina',
            'action.edit': 'Modifica',
            'action.create': 'Crea',
            'action.close': 'Chiudi',

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
            'message.success': 'Successo',
            'message.loading': 'Caricamento...',

            // Auth (v3.1)
            'auth.login': 'Accedi',
            'auth.logout': 'Esci',
            'auth.register': 'Registrati',
            'auth.email': 'E-mail',
            'auth.password': 'Password',
            'auth.confirmPassword': 'Conferma password',
            'auth.forgotPassword': 'Password dimenticata?',
            'auth.noAccount': 'Non hai un account?',
            'auth.hasAccount': 'Hai già un account?',
            'auth.welcome': 'Benvenuto',
            'auth.loginDescription': 'Accedi per accedere al sistema di documenti HR',

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
            'validation.passwordMismatch': 'Le password non corrispondono',
            'validation.passwordTooShort': 'La password deve contenere almeno 8 caratteri',

            // Countries (v3.1)
            'country.DE': 'Germania',
            'country.IT': 'Italia',
            'country.ES': 'Spagna',
            'country.AT': 'Austria',
            'country.FR': 'Francia',
        }
    },
    es: {
        translation: {
            // Navigation
            'nav.dashboard': 'Panel',
            'nav.generate': 'Crear documento',
            'nav.documents': 'Mis documentos',
            'nav.drafts': 'Borradores',
            'nav.admin.settings': 'Gestor de diseño',
            'nav.admin.clauses': 'Biblioteca de cláusulas',
            'nav.admin.templates': 'Plantillas',
            'nav.admin.countries': 'Configuración de países',
            'nav.admin.locations': 'Ubicaciones',

            // Document Generator
            'generator.title': 'Crear documento',
            'generator.select_type': 'Seleccionar tipo de documento',
            'generator.form.section.personal': 'Datos del empleado',
            'generator.form.section.contract': 'Datos del contrato',
            'generator.form.section.salary': 'Remuneración',
            'generator.form.section.options': 'Opciones adicionales',
            'generator.form.section.custom': 'Acuerdo individual',

            // Fields
            'field.firstName': 'Nombre',
            'field.lastName': 'Apellido',
            'field.birthDate': 'Fecha de nacimiento',
            'field.address': 'Dirección',
            'field.startDate': 'Fecha de inicio',
            'field.position': 'Puesto',
            'field.hoursPerWeek': 'Horas semanales',
            'field.salary': 'Salario mensual (bruto)',
            'field.companyCar': 'Coche de empresa',
            'field.homeOffice': 'Teletrabajo',
            'field.probation': 'Período de prueba',
            'field.country': 'País',
            'field.location': 'Ubicación',

            // Actions
            'action.save': 'Guardar',
            'action.saveDraft': 'Guardar como borrador',
            'action.download.docx': 'Como DOCX',
            'action.download.pdf': 'Como PDF',
            'action.preview': 'Vista previa',
            'action.cancel': 'Cancelar',
            'action.confirm': 'Confirmar',
            'action.delete': 'Eliminar',
            'action.edit': 'Editar',
            'action.create': 'Crear',
            'action.close': 'Cerrar',

            // Preview
            'preview.title': 'Vista previa en vivo',
            'preview.placeholder': 'Seleccione un documento para ver la vista previa.',
            'preview.page': 'Página',
            'preview.of': 'de',

            // Drafts
            'drafts.title': 'Mis borradores',
            'drafts.unnamed': 'Borrador sin nombre',
            'drafts.continue': 'Continuar',
            'drafts.delete': 'Eliminar',
            'drafts.lastEdited': 'Última edición',

            // Messages
            'message.saved': 'Guardado',
            'message.autoSaved': 'Guardado automáticamente a las {time}',
            'message.generating': 'Generando documento...',
            'message.error': 'Se ha producido un error',
            'message.success': 'Éxito',
            'message.loading': 'Cargando...',

            // Auth (v3.1)
            'auth.login': 'Iniciar sesión',
            'auth.logout': 'Cerrar sesión',
            'auth.register': 'Registrarse',
            'auth.email': 'Correo electrónico',
            'auth.password': 'Contraseña',
            'auth.confirmPassword': 'Confirmar contraseña',
            'auth.forgotPassword': '¿Olvidó su contraseña?',
            'auth.noAccount': '¿No tiene cuenta?',
            'auth.hasAccount': '¿Ya tiene cuenta?',
            'auth.welcome': 'Bienvenido',
            'auth.loginDescription': 'Inicie sesión para acceder al sistema de documentos de RRHH',

            // Validation
            'validation.required': 'Este campo es obligatorio',
            'validation.email': 'Por favor, introduzca un correo electrónico válido',
            'validation.minLength': 'Mínimo {{min}} caracteres requeridos',
            'validation.maxLength': 'Máximo {{max}} caracteres permitidos',
            'validation.minValue': 'Valor mínimo: {{min}}',
            'validation.maxValue': 'Valor máximo: {{max}}',
            'validation.pattern': 'Formato no válido',
            'validation.number': 'Por favor, introduzca un número válido',
            'validation.date': 'Por favor, introduzca una fecha válida',
            'validation.missingFields': 'Por favor, complete todos los campos obligatorios',
            'validation.formComplete': 'Todos los campos obligatorios están completos',
            'validation.passwordMismatch': 'Las contraseñas no coinciden',
            'validation.passwordTooShort': 'La contraseña debe tener al menos 8 caracteres',

            // Countries (v3.1)
            'country.DE': 'Alemania',
            'country.IT': 'Italia',
            'country.ES': 'España',
            'country.AT': 'Austria',
            'country.FR': 'Francia',
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
