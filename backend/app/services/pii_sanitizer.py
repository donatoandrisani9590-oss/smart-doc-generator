"""
PII Sanitizer — Entfernt personenbezogene Daten aus LLM-Prompts.

DSGVO Art. 5 Abs. 1 lit. c (Datenminimierung):
  "Die Verarbeitung personenbezogener Daten muss dem Zweck angemessen und
  erheblich sowie auf das für die Zwecke der Verarbeitung notwendige Maß
  beschränkt sein."

Strategie:
  - Bekannte sensitive Felder werden durch Platzhalter ersetzt
  - Claude bekommt Feldnamen + Strukturinfo, aber keine konkreten PII-Werte
  - Die echten Werte bleiben im Frontend/DB und werden nie an den LLM gesendet
"""
import re
from typing import Optional


# ── Sensitive field patterns ────────────────────────────────────────────
# Feldnamen die personenbezogene oder finanzielle Daten enthalten.
# Pattern-Matching (case-insensitive) für maximale Abdeckung.

SENSITIVE_FIELD_PATTERNS: list[re.Pattern] = [
    # Finanzielle Daten
    re.compile(r"gehalt", re.I),
    re.compile(r"salary", re.I),
    re.compile(r"lohn", re.I),
    re.compile(r"verguetung|vergütung", re.I),
    re.compile(r"abfindung", re.I),
    re.compile(r"bonus", re.I),
    re.compile(r"provision", re.I),
    re.compile(r"zuschlag|zulage", re.I),
    re.compile(r"iban|bic|konto", re.I),
    re.compile(r"steuer.*nummer|steuernummer|steuer_id|steuerid", re.I),
    re.compile(r"sozialversicherung", re.I),

    # Identifikationsdaten
    re.compile(r"personal.*nummer|personalnummer", re.I),
    re.compile(r"employee.*id|mitarbeiter.*id", re.I),
    re.compile(r"sozialversicherungsnummer|sv_nummer|svnr", re.I),
    re.compile(r"ausweis|passport|reisepass", re.I),

    # Persönliche Daten
    re.compile(r"geburtsdatum|geburtstag|birth", re.I),
    re.compile(r"geburtsort|birth.*place", re.I),
    re.compile(r"adresse|address|strasse|straße|plz|postleitzahl|hausnummer", re.I),
    re.compile(r"telefon|phone|mobil|handy", re.I),
    re.compile(r"email|e_mail|e-mail", re.I),
    re.compile(r"familienstand|marital", re.I),
    re.compile(r"nationalit|staatsang", re.I),
    re.compile(r"religion|konfession", re.I),
    re.compile(r"schwerbehinder|disability|behinderung", re.I),

    # Gesundheitsdaten (Art. 9 DSGVO — besondere Kategorien)
    re.compile(r"krankheit|diagnose|gesundheit|health", re.I),
    re.compile(r"krankenversicherung|krankenkasse", re.I),

    # Vorfallbezogene Daten (bei Abmahnungen etc.)
    re.compile(r"vorfall.*beschreibung|incident", re.I),
    re.compile(r"kuendigungs.*grund|kündigungs.*grund", re.I),
    re.compile(r"abmahnungs.*grund", re.I),
]

# Felder die für die Dokumentstruktur wichtig sind und ans LLM dürfen
ALLOWED_FIELD_PATTERNS: list[re.Pattern] = [
    re.compile(r"^dokumenttyp$|^document.type$", re.I),
    re.compile(r"^country.code$|^land$", re.I),
    re.compile(r"^sprache$|^language$", re.I),
    re.compile(r"^arbeitszeitmodell$|^arbeitszeit$|^wochenstunden$", re.I),
    re.compile(r"^urlaubstage$|^urlaub$", re.I),
    re.compile(r"^kuendigungsfrist$|^kündigungsfrist$", re.I),
    re.compile(r"^probezeit$", re.I),
    re.compile(r"^position$|^stellenbezeichnung$|^job.title$", re.I),
    re.compile(r"^abteilung$|^department$", re.I),
    re.compile(r"^standort$|^location$", re.I),
    re.compile(r"^eintrittsdatum$|^start.date$", re.I),
    re.compile(r"^befristung$|^vertragsart$|^contract.type$", re.I),
    re.compile(r"^gerichtsstand$", re.I),
]

PLACEHOLDER = "[GESCHÜTZT]"


def is_sensitive_field(field_name: str) -> bool:
    """Prüfe ob ein Feldname sensitive PII-Daten enthält."""
    # Explizit erlaubte Felder übersteuern
    for pattern in ALLOWED_FIELD_PATTERNS:
        if pattern.search(field_name):
            return False

    for pattern in SENSITIVE_FIELD_PATTERNS:
        if pattern.search(field_name):
            return True

    # Konservativ: Namen-Felder sind immer sensitiv
    name_lower = field_name.lower()
    if any(kw in name_lower for kw in ("name", "vorname", "nachname", "anrede")):
        return True

    return False


def sanitize_form_data(
    form_data: dict,
    mode: str = "redact",
) -> dict:
    """
    Sanitize form data before sending to LLM.

    Args:
        form_data: Original form field key-value pairs
        mode: "redact" = replace PII with placeholder,
              "keys_only" = only send field names (no values)

    Returns:
        Sanitized copy (original dict is not modified)
    """
    if not form_data:
        return {}

    sanitized = {}
    for key, value in form_data.items():
        if not value:
            continue

        if mode == "keys_only":
            sanitized[key] = "[WERT VORHANDEN]" if value else "[LEER]"
        elif is_sensitive_field(key):
            sanitized[key] = PLACEHOLDER
        else:
            sanitized[key] = value

    return sanitized


def sanitize_employee_history(
    documents: list[dict],
) -> list[dict]:
    """
    Sanitize employee history before sending to LLM as tool result.

    Removes sensitive field values from form_data but keeps:
    - document type, title, date (for context)
    - non-sensitive field values (position, Arbeitszeit, etc.)
    """
    sanitized_docs = []
    for doc in documents:
        sanitized = {
            "id": doc.get("id"),
            "title": doc.get("title", ""),
            "created_at": doc.get("created_at", ""),
            "document_type_id": doc.get("document_type_id"),
        }

        # Sanitize form_data within the document
        form_data = doc.get("form_data", {})
        if form_data:
            sanitized["form_data"] = sanitize_form_data(form_data)
        else:
            sanitized["form_data"] = {}

        # Employee name/id als Kontext belassen (Claude braucht das für die Zuordnung)
        # aber nur den Namen, nicht die Personalnummer
        sanitized["employee_name"] = doc.get("employee_name", "")
        # employee_id bewusst NICHT mitgeben

        sanitized_docs.append(sanitized)

    return sanitized_docs


def sanitize_error_message(error: str) -> str:
    """
    Remove potential PII from error messages before sending to client.

    Anthropic API errors can sometimes include parts of the prompt.
    """
    if not error:
        return "Ein unbekannter Fehler ist aufgetreten."

    # Truncate overly long error messages (might contain prompt data)
    if len(error) > 300:
        error = error[:300] + "..."

    # Remove anything that looks like form data JSON
    error = re.sub(r'\{[^}]*"(gehalt|name|adresse|iban|steuer)[^}]*\}', '[DATEN ENTFERNT]', error, flags=re.I)

    # Remove email addresses
    error = re.sub(r'[\w.+-]+@[\w-]+\.[\w.-]+', '[EMAIL ENTFERNT]', error)

    # Remove phone numbers
    error = re.sub(r'[\+]?[\d\s\-\(\)]{8,}', '[TELEFON ENTFERNT]', error)

    return error
