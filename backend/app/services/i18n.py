"""
Smart Document Generator - i18n Service
========================================
Zentralisierte Internationalisierung für Backend-Fehlermeldungen.
Lädt Übersetzungen aus externer JSON-Datei.

v3.1 Update: Alle Backend-Meldungen aus storage/config/error-messages.json
"""

import json
from pathlib import Path
from typing import Optional, Dict, Any
from contextvars import ContextVar
import logging

logger = logging.getLogger(__name__)

# Pfade
BASE_DIR = Path(__file__).parent.parent.parent
CONFIG_DIR = BASE_DIR / "storage" / "config"
ERROR_MESSAGES_FILE = CONFIG_DIR / "error-messages.json"

# Cache
_error_messages_cache: Optional[Dict[str, Any]] = None

# Context variable for current language (per-request)
_current_language: ContextVar[str] = ContextVar("current_language", default="DE")


def _load_error_messages() -> Dict[str, Any]:
    """
    Lädt die Fehlermeldungen aus der JSON-Datei.
    Verwendet Caching für Performance.
    """
    global _error_messages_cache

    if _error_messages_cache is not None:
        return _error_messages_cache

    if not ERROR_MESSAGES_FILE.exists():
        logger.warning(f"Error messages config not found: {ERROR_MESSAGES_FILE}")
        return _get_fallback_messages()

    try:
        with open(ERROR_MESSAGES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        _error_messages_cache = data.get("error_messages", {})
        return _error_messages_cache
    except json.JSONDecodeError as e:
        logger.error(f"Invalid error messages config: {e}")
        return _get_fallback_messages()


def _get_fallback_messages() -> Dict[str, Any]:
    """Fallback messages in case config file is missing."""
    return {
        "DE": {
            "auth": {
                "invalid_credentials": "Falsche E-Mail oder Passwort",
                "inactive_user": "Benutzerkonto ist deaktiviert"
            },
            "general": {
                "internal_error": "Ein interner Fehler ist aufgetreten"
            }
        }
    }


def reload_error_messages() -> Dict[str, Any]:
    """Erzwingt das Neuladen der Fehlermeldungen."""
    global _error_messages_cache
    _error_messages_cache = None
    return _load_error_messages()


def set_language(lang_code: str):
    """
    Setzt die aktuelle Sprache für den Request-Kontext.

    Args:
        lang_code: Sprachcode (z.B. "DE", "IT")
    """
    _current_language.set(lang_code.upper())


def get_language() -> str:
    """
    Gibt die aktuelle Sprache zurück.

    Returns:
        Aktueller Sprachcode
    """
    return _current_language.get()


def get_error_message(
    category: str,
    key: str,
    lang_code: Optional[str] = None,
    **kwargs
) -> str:
    """
    Gibt eine lokalisierte Fehlermeldung zurück.

    Args:
        category: Kategorie (z.B. "auth", "validation", "document")
        key: Meldungsschlüssel (z.B. "invalid_credentials")
        lang_code: Optional, Sprachcode (default: aktueller Kontext)
        **kwargs: Platzhalter-Ersetzungen (z.B. field="email", max=255)

    Returns:
        Lokalisierte Fehlermeldung

    Examples:
        get_error_message("auth", "invalid_credentials")
        get_error_message("validation", "required_field", field="email")
        get_error_message("validation", "value_too_long", field="name", max=255)
    """
    if lang_code is None:
        lang_code = get_language()

    messages = _load_error_messages()
    lang_messages = messages.get(lang_code.upper(), messages.get("DE", {}))

    # Get message from category
    category_messages = lang_messages.get(category, {})
    message = category_messages.get(key)

    if not message:
        # Fallback to German
        de_messages = messages.get("DE", {}).get(category, {})
        message = de_messages.get(key, f"[{category}.{key}]")

    # Replace placeholders
    if kwargs:
        try:
            message = message.format(**kwargs)
        except KeyError as e:
            logger.warning(f"Missing placeholder in message: {e}")

    return message


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTIONS - Kategorien-Shortcuts
# ═══════════════════════════════════════════════════════════════════════════════

def auth_error(key: str, lang_code: Optional[str] = None, **kwargs) -> str:
    """Shortcut für Auth-Fehlermeldungen."""
    return get_error_message("auth", key, lang_code, **kwargs)


def validation_error(key: str, lang_code: Optional[str] = None, **kwargs) -> str:
    """Shortcut für Validierungs-Fehlermeldungen."""
    return get_error_message("validation", key, lang_code, **kwargs)


def document_error(key: str, lang_code: Optional[str] = None, **kwargs) -> str:
    """Shortcut für Dokumenten-Fehlermeldungen."""
    return get_error_message("document", key, lang_code, **kwargs)


def general_error(key: str, lang_code: Optional[str] = None, **kwargs) -> str:
    """Shortcut für allgemeine Fehlermeldungen."""
    return get_error_message("general", key, lang_code, **kwargs)


# ═══════════════════════════════════════════════════════════════════════════════
# FASTAPI MIDDLEWARE INTEGRATION
# ═══════════════════════════════════════════════════════════════════════════════

def get_language_from_request(request) -> str:
    """
    Extrahiert die bevorzugte Sprache aus dem Request.

    Priorität:
    1. X-Language Header
    2. Accept-Language Header
    3. User's country_code (wenn authentifiziert)
    4. Default: DE

    Args:
        request: FastAPI Request object

    Returns:
        Sprachcode
    """
    # Check X-Language header
    x_lang = request.headers.get("X-Language")
    if x_lang and x_lang.upper() in ["DE", "IT", "ES", "AT", "FR"]:
        return x_lang.upper()

    # Check Accept-Language header
    accept_lang = request.headers.get("Accept-Language", "")
    for lang in accept_lang.split(","):
        lang_code = lang.split(";")[0].strip().split("-")[0].upper()
        if lang_code in ["DE", "IT", "ES", "AT", "FR"]:
            return lang_code

    # Default
    return "DE"


# ═══════════════════════════════════════════════════════════════════════════════
# SUPPORTED LANGUAGES
# ═══════════════════════════════════════════════════════════════════════════════

def get_supported_languages() -> list[str]:
    """Gibt alle unterstützten Sprachcodes zurück."""
    messages = _load_error_messages()
    return list(messages.keys())
