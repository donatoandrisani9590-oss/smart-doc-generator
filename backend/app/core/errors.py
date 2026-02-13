"""
Standardized German error messages for the API.

All user-facing error messages should be in German.
Use these constants instead of hardcoded strings.
"""


class ErrorMessages:
    # ── Generic ───────────────────────────────────────────────────────────
    NOT_FOUND = "Nicht gefunden"
    FORBIDDEN = "Zugriff verweigert"
    UNAUTHORIZED = "Nicht autorisiert"

    # ── Document Types ────────────────────────────────────────────────────
    DOCUMENT_TYPE_NOT_FOUND = "Dokumenttyp nicht gefunden"
    VARIANT_GROUP_NOT_FOUND = "Varianten-Gruppe nicht gefunden"
    VARIANT_GROUP_ALREADY_ASSIGNED = "Varianten-Gruppe ist diesem Dokumenttyp bereits zugeordnet"
    VARIANT_GROUP_ASSIGNMENT_NOT_FOUND = "Varianten-Gruppen-Zuordnung nicht gefunden"
    TARGET_DOCUMENT_TYPE_NOT_FOUND = "Ziel-Dokumenttyp nicht gefunden"
    SOURCE_TEMPLATE_NOT_FOUND = "Quell-Vorlage nicht gefunden"

    # ── Drafts ────────────────────────────────────────────────────────────
    DRAFT_NOT_FOUND = "Entwurf nicht gefunden"
    DRAFT_EMPTY = "Entwurf nicht gefunden oder leer"

    # ── Clauses ───────────────────────────────────────────────────────────
    CLAUSE_NOT_FOUND = "Textbaustein nicht gefunden"
    CLAUSE_REQUIRES_ID = "Mindestens eine clause_id ist erforderlich"

    # ── Documents ─────────────────────────────────────────────────────────
    DOCUMENT_NOT_FOUND = "Dokument nicht gefunden"
    PDF_NOT_FOUND = "PDF-Datei nicht gefunden. Sie wurde möglicherweise bereinigt."

    # ── Attachments ───────────────────────────────────────────────────────
    ATTACHMENT_NOT_FOUND = "Anlage nicht gefunden"

    # ── Favorites ─────────────────────────────────────────────────────────
    ALREADY_FAVORITED = "Bereits in Favoriten"
    FAVORITE_NOT_FOUND = "Favorit nicht gefunden"

    # ── Bulk Jobs ─────────────────────────────────────────────────────────
    JOB_NOT_FOUND = "Auftrag nicht gefunden"
    RESULT_FILE_NOT_FOUND = "Ergebnis-Datei nicht gefunden"

    # ── Guest Links ───────────────────────────────────────────────────────
    LINK_INVALID = "Link ungültig oder abgelaufen"
    LINK_EXPIRED = "Link abgelaufen"

    # ── Setup ─────────────────────────────────────────────────────────────
    SYSTEM_ALREADY_INITIALIZED = "System bereits initialisiert. Verwenden Sie das Admin-Panel zur Benutzerverwaltung."
    PASSWORD_TOO_SHORT = "Passwort muss mindestens 8 Zeichen lang sein"
