"""
Preview Service: Generates HTML preview for live document editing.
Must be fast (<50ms server time) for reactive UI.
"""
from __future__ import annotations
from typing import Any, Callable, Optional, Union
from datetime import date, datetime
from jinja2 import Template
import re
import bleach

# Erlaubte HTML-Tags für Klausel-Inhalte (XSS Prevention)
ALLOWED_TAGS = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'div', 'hr', 'blockquote', 'pre', 'code'
]

ALLOWED_ATTRIBUTES = {
    '*': ['class', 'style', 'id'],
    'a': ['href', 'title', 'target', 'rel'],
    'td': ['colspan', 'rowspan'],
    'th': ['colspan', 'rowspan'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
}


def sanitize_html(dirty: str) -> str:
    """Sanitize HTML content to prevent XSS attacks."""
    if not dirty:
        return ""
    return bleach.clean(
        dirty,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        strip=True
    )

# Locale mapping for date/currency formatting
LOCALE_CONFIG = {
    "DE": {"date_format": "%d.%m.%Y", "currency_sep": (".", ",")},
    "IT": {"date_format": "%d/%m/%Y", "currency_sep": (".", ",")},
}


def format_date_localized(value: Union[date, datetime, str], country_code: str) -> str:
    """Format date according to country standards."""
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value).date()
        except ValueError:
            return value
    
    config = LOCALE_CONFIG.get(country_code, LOCALE_CONFIG["DE"])
    return value.strftime(config["date_format"])


def format_currency_localized(value: Union[float, int], country_code: str) -> str:
    """Format currency according to country standards (e.g., 5.000,00 €).

    Returns formatted number with € symbol. Does NOT append 'EUR' to avoid
    duplication when clause templates already contain 'EUR' after the placeholder.
    """
    formatted = f"{value:,.2f}"
    # German/Italian style: swap . and ,
    formatted = formatted.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{formatted} €"


def _guess_salutation(vorname: str, country_code: str = "DE") -> str:
    """
    Guess salutation (Herr/Frau) based on first name heuristic.
    Returns empty string if unsure.
    """
    if not vorname:
        return ""

    # Common female name endings (German/Italian)
    female_endings = ("a", "e", "ine", "ina", "ette", "elle", "ie")
    # Common male names that end in 'a' or 'e' (exceptions)
    male_exceptions = {
        "luca", "andrea", "nicola", "sascha", "mischa", "joshua", "nikita",
        "mustafa", "elia", "mattia", "mehmet", "ahmed", "mohammed", "ali",
        "giuseppe", "carlo", "marco", "paolo", "mario", "antonio", "stefan",
        "thomas", "michael", "peter", "hans", "karl", "andreas", "markus",
        "johannes", "matthias", "tobias", "lukas", "jonas", "niklas", "elias",
        "tim", "jan", "ben", "max", "felix", "leon", "paul", "david",
        "alexander", "daniel", "philipp", "sebastian", "christian", "florian",
    }
    # Common female names (exceptions to male rules)
    female_exceptions = {
        "anna", "maria", "lisa", "laura", "sara", "emma", "lena", "julia",
        "sophie", "hanna", "lea", "mia", "emily", "ella", "clara", "elena",
        "alessandra", "francesca", "giovanna", "paola", "chiara", "silvia",
    }

    name_lower = vorname.strip().lower()

    if name_lower in female_exceptions:
        return "Frau" if country_code == "DE" else "Sig.ra"
    if name_lower in male_exceptions:
        return "Herr" if country_code == "DE" else "Sig."
    if name_lower.endswith(female_endings) and name_lower not in male_exceptions:
        return "Frau" if country_code == "DE" else "Sig.ra"

    # Default: assume male for names not ending in female patterns
    return "Herr" if country_code == "DE" else "Sig."


def render_placeholders(content: str, form_data: dict, country_code: str = "DE") -> str:
    """
    Replace {{ placeholder }} and [placeholder] with formatted values.
    Handles date and currency fields with localization.
    Supports alias mapping for common placeholder name variations.
    """
    # Alias mapping: template placeholder name → form_data field name
    # This handles cases where templates use different names than form fields
    PLACEHOLDER_ALIASES = {
        "bruttogehalt": "gehalt",
        "gehalt_brutto": "gehalt",
        "gehalt_brutto_monat": "gehalt",
        "monatsgehalt": "gehalt",
        "mitarbeiter_vorname": "vorname",
        "mitarbeiter_nachname": "nachname",
        "mitarbeiter_name": "nachname",
        "mitarbeiter_adresse": "strasse",
        "probezeit_monate": "probezeit",
        "arbeitszeit": "wochenstunden",
        "beginn": "eintrittsdatum",
        "startdatum": "eintrittsdatum",
        "vertragsbeginn": "eintrittsdatum",
        "anrede": "_anrede",  # Special: computed field
    }

    def replace_match(match: re.Match) -> str:
        placeholder = match.group(1).strip()

        # Try direct lookup first, then alias mapping
        value = form_data.get(placeholder)
        if value is None:
            alias = PLACEHOLDER_ALIASES.get(placeholder.lower())
            if alias:
                value = form_data.get(alias)

        if value is None:
            return f"[{placeholder}]"
        
        # Date fields (check by name or type)
        if "datum" in placeholder.lower() or "date" in placeholder.lower():
            return format_date_localized(value, country_code)
        
        # Currency fields
        if "gehalt" in placeholder.lower() or "betrag" in placeholder.lower():
            try:
                return format_currency_localized(float(value), country_code)
            except (ValueError, TypeError):
                return str(value)
        
        return str(value)
    
    # Replace both {{ placeholder }} and [placeholder] patterns
    content = re.sub(r"\{\{\s*(\w+)\s*\}\}", replace_match, content)
    content = re.sub(r"\[(\w+)\]", replace_match, content)
    return content


def evaluate_condition(condition: dict, form_data: dict) -> bool:
    """
    Evaluate clause condition against form data.
    Supports both simple conditions and complex AND/OR groups.

    Simple condition example:
        {"field": "firmenwagen", "operator": "=", "value": true}

    Group condition example:
        {
            "type": "group",
            "logic": "and",
            "conditions": [
                {"type": "simple", "field": "position", "operator": "=", "value": "Manager"},
                {"type": "simple", "field": "gehalt", "operator": ">=", "value": 50000}
            ]
        }

    Supported operators:
        - "=", "!=" : Equality comparison
        - ">", ">=", "<", "<=" : Numeric comparison
        - "contains", "startsWith", "endsWith" : String operations
        - "exists", "notExists" : Existence checks
        - "in", "notIn" : List membership
    """
    if not condition:
        return True

    # Handle group conditions (AND/OR)
    condition_type = condition.get("type")
    if condition_type == "group":
        logic = condition.get("logic", "and")
        sub_conditions = condition.get("conditions", [])

        if not sub_conditions:
            return True

        if logic == "or":
            return any(evaluate_condition(c, form_data) for c in sub_conditions)
        else:  # "and" is default
            return all(evaluate_condition(c, form_data) for c in sub_conditions)

    # Handle simple condition (including legacy format without "type" field)
    field = condition.get("field")
    if not field:
        return True

    operator = condition.get("operator", "=")
    expected = condition.get("value")
    actual = form_data.get(field)

    # Equality operators
    if operator == "=":
        return _compare_equal(actual, expected)
    elif operator == "!=":
        return not _compare_equal(actual, expected)

    # Numeric comparison operators
    elif operator == ">":
        return _compare_numeric(actual, expected, lambda a, b: a > b)
    elif operator == ">=":
        return _compare_numeric(actual, expected, lambda a, b: a >= b)
    elif operator == "<":
        return _compare_numeric(actual, expected, lambda a, b: a < b)
    elif operator == "<=":
        return _compare_numeric(actual, expected, lambda a, b: a <= b)

    # String operators
    elif operator == "contains":
        return _str_contains(actual, expected)
    elif operator == "startsWith":
        return _str_startswith(actual, expected)
    elif operator == "endsWith":
        return _str_endswith(actual, expected)

    # Existence operators
    elif operator == "exists":
        return actual is not None and actual != ""
    elif operator == "notExists":
        return actual is None or actual == ""

    # List membership operators
    elif operator == "in":
        return _in_list(actual, expected)
    elif operator == "notIn":
        return not _in_list(actual, expected)

    # Unknown operator - default to True for forwards compatibility
    return True


def _compare_equal(actual: Any, expected: Any) -> bool:
    """Compare two values for equality with type coercion."""
    if actual is None and expected is None:
        return True
    if actual is None or expected is None:
        return False

    # Boolean comparison (handle string "true"/"false")
    if isinstance(expected, bool):
        if isinstance(actual, bool):
            return actual == expected
        if isinstance(actual, str):
            return actual.lower() in ("true", "1", "yes") if expected else actual.lower() in ("false", "0", "no")
        return bool(actual) == expected

    # String comparison (case-insensitive for flexibility)
    if isinstance(expected, str) and isinstance(actual, str):
        return actual.strip().lower() == expected.strip().lower()

    # Numeric comparison with type coercion
    try:
        return float(actual) == float(expected)
    except (TypeError, ValueError):
        pass

    # Fallback to direct comparison
    return actual == expected


def _compare_numeric(actual: Any, expected: Any, comparator) -> bool:
    """Safe numeric comparison with type conversion."""
    if actual is None or expected is None:
        return False
    try:
        # Handle string numbers with thousands separators (e.g., "50.000" or "50,000")
        actual_str = str(actual).replace(".", "").replace(",", ".") if isinstance(actual, str) else str(actual)
        expected_str = str(expected).replace(".", "").replace(",", ".") if isinstance(expected, str) else str(expected)
        return comparator(float(actual_str), float(expected_str))
    except (TypeError, ValueError):
        return False


def _str_contains(actual: Any, expected: Any) -> bool:
    """Check if actual string contains expected substring (case-insensitive)."""
    if actual is None or expected is None:
        return False
    return str(expected).lower() in str(actual).lower()


def _str_startswith(actual: Any, expected: Any) -> bool:
    """Check if actual string starts with expected prefix (case-insensitive)."""
    if actual is None or expected is None:
        return False
    return str(actual).lower().startswith(str(expected).lower())


def _str_endswith(actual: Any, expected: Any) -> bool:
    """Check if actual string ends with expected suffix (case-insensitive)."""
    if actual is None or expected is None:
        return False
    return str(actual).lower().endswith(str(expected).lower())


def _in_list(actual: Any, expected: Any) -> bool:
    """Check if actual value is in expected list."""
    if actual is None:
        return False
    if not isinstance(expected, (list, tuple)):
        return _compare_equal(actual, expected)
    return any(_compare_equal(actual, item) for item in expected)


def _renumber_clause_sections(clauses: list[dict]) -> list[dict]:
    """
    Renumber § (section) headings sequentially after conditional clause filtering.

    When conditional clauses are excluded (e.g. Firmenwagen §12, Home Office §13),
    the remaining clauses would have gaps in their numbering. This function
    renumbers them sequentially starting from §1.

    Only replaces the heading occurrence inside <strong> tags to avoid
    modifying cross-references to legal paragraphs (e.g. "§ 622 BGB").

    Handles both HTML entity (&sect;) and literal § character, with optional
    whitespace or &nbsp; between the symbol and the number.
    """
    heading_pattern = re.compile(
        r'(<strong[^>]*>\s*)'           # Opening <strong> tag (capture group 1)
        r'(§|&sect;)'                   # Section symbol: literal § or HTML entity (group 2)
        r'(\s*(?:&nbsp;)?\s*)'          # Optional whitespace/&nbsp; (group 3)
        r'(\d+)'                        # The section number to replace (group 4)
        r'(\s)',                         # Space after number (group 5)
        re.IGNORECASE
    )

    renumbered = []
    for idx, clause in enumerate(clauses, start=1):
        content = clause.get("content", "")
        if not content:
            renumbered.append(clause)
            continue

        new_content, count = heading_pattern.subn(
            lambda m, n=idx: f"{m.group(1)}{m.group(2)}{m.group(3)}{n}{m.group(5)}",
            content,
            count=1
        )

        if count > 0:
            renumbered.append({**clause, "content": new_content})
        else:
            renumbered.append(clause)

    return renumbered


def assemble_html_preview(
    design_settings: dict,
    clauses: list[dict],
    form_data: dict,
    country_code: str = "DE",
    custom_clause: Optional[dict] = None
) -> str:
    """
    Assemble full HTML preview document.
    This is the core function called by the /api/preview/html endpoint.

    Now includes full document layout matching DOCX generation:
    - Document title (Arbeitsvertrag / CONTRATTO DI LAVORO)
    - Contract parties section
    - Signature section
    """
    # Filter clauses by conditions
    active_clauses = []
    for clause in clauses:
        condition = clause.get("condition")
        if evaluate_condition(condition, form_data):
            active_clauses.append(clause)

    # Renumber § sections sequentially after conditional filtering
    # to eliminate gaps when conditional clauses are excluded
    active_clauses = _renumber_clause_sections(active_clauses)

    # Sanitize and render placeholders in clause content
    for i, clause in enumerate(active_clauses):
        sanitized_content = sanitize_html(clause.get("content", ""))
        rendered_content = render_placeholders(
            sanitized_content,
            form_data,
            country_code
        )
        active_clauses[i] = {
            **clause,
            "rendered_content": rendered_content
        }

    # Build assembled content
    content_html = ""
    for clause in active_clauses:
        content_html += clause["rendered_content"] + "\n"

    # Add custom clause if present (SANITIZED to prevent XSS)
    if custom_clause and custom_clause.get("content"):
        sanitized_title = sanitize_html(custom_clause.get('title', 'Sondervereinbarung'))
        sanitized_content = sanitize_html(custom_clause.get('content'))
        content_html += f"""
        <div class="custom-clause">
            <h2>{sanitized_title}</h2>
            {sanitized_content}
        </div>
        """

    # Extract employee information from form_data
    vorname = form_data.get("vorname", "")
    nachname = form_data.get("nachname", "")
    employee_name = f"{vorname} {nachname}".strip() or "[Vorname Nachname]"

    # Determine salutation based on explicit anrede field or name heuristic
    anrede = form_data.get("anrede", "")
    if not anrede and vorname:
        anrede = _guess_salutation(vorname, country_code)
    if not anrede:
        anrede = "Herr/Frau" if country_code == "DE" else "Sig./Sig.ra"

    # Inject computed anrede into form_data so [anrede] placeholders in clauses resolve
    form_data["_anrede"] = anrede

    # Employee address - check multiple possible field names
    employee_address = (
        form_data.get("mitarbeiter_adresse") or
        form_data.get("adresse") or
        form_data.get("strasse") or
        ""
    )

    employee_city = form_data.get("plz_ort", "")

    # Signatory name from form_data or design_settings
    signatory_name = (
        form_data.get("signatory_name") or
        design_settings.get("signatory_name") or
        ("Geschäftsführer" if country_code == "DE" else "Amministratore")
    )

    # Render full document with DIN 5008 settings
    template = Template(PREVIEW_TEMPLATE)
    html = template.render(
        logo_path=design_settings.get("logo_path", ""),
        company_name=design_settings.get("company_name", ""),
        header_line1=design_settings.get("header_line1", ""),
        header_line2=design_settings.get("header_line2", ""),
        footer_line1=design_settings.get("footer_line1", ""),
        footer_line2=design_settings.get("footer_line2", ""),
        primary_color=design_settings.get("primary_color", "#243186"),
        font_family=design_settings.get("font_family", "Arial"),
        content=content_html,
        country_code=country_code,
        # Employee data for contract parties section
        anrede=anrede,
        employee_name=employee_name,
        employee_address=employee_address,
        employee_city=employee_city,
        signatory_name=signatory_name,
        # DIN 5008 Page Format Settings
        margin_left_cm=design_settings.get("margin_left_cm", "2.5"),
        margin_right_cm=design_settings.get("margin_right_cm", "2.0"),
        margin_top_cm=design_settings.get("margin_top_cm", "2.5"),
        margin_bottom_cm=design_settings.get("margin_bottom_cm", "2.0"),
        font_size_pt=design_settings.get("font_size_pt", 11),
        line_spacing=design_settings.get("line_spacing", "1.15"),
        logo_width_cm=design_settings.get("logo_width_cm", "5.0"),
    )

    return html


# DIN A4 styled HTML template - CONTENT ONLY
# Styles are defined in frontend/src/styles/preview.css
# The frontend wraps this content in a div.document-preview container
PREVIEW_TEMPLATE = """
<!-- Logo Header -->
<header class="document-header">
    {% if logo_path %}
    <div class="logo"><img src="{{ logo_path }}" alt="{{ company_name }}"></div>
    {% endif %}
</header>

<!-- Document Title -->
<div class="document-title">
    {% if country_code == 'IT' %}CONTRATTO DI LAVORO{% else %}Arbeitsvertrag{% endif %}
</div>

<!-- Contract Parties -->
<div class="contract-parties">
    <div class="party-label">
        {% if country_code == 'IT' %}Tra{% else %}Zwischen{% endif %}
    </div>

    <div class="party-name">{{ company_name }}</div>
    <div class="party-address">{{ header_line1 }}</div>
    <div class="party-address">{{ header_line2 }}</div>
    <div class="party-role">
        {% if country_code == 'IT' %}– di seguito denominato "Datore di Lavoro" –{% else %}– nachstehend „Arbeitgeber" genannt –{% endif %}
    </div>

    <div class="party-label">
        {% if country_code == 'IT' %}e{% else %}und{% endif %}
    </div>

    <div class="party-name">
        {{ anrede }} {{ employee_name }}
    </div>
    {% if employee_address %}
    <div class="party-address">{{ employee_address }}</div>
    {% endif %}
    {% if employee_city %}
    <div class="party-address">{{ employee_city }}</div>
    {% endif %}
    <div class="party-role">
        {% if country_code == 'IT' %}– di seguito denominato "Lavoratore/Lavoratrice" –{% else %}– nachstehend „Arbeitnehmer" genannt –{% endif %}
    </div>
</div>

<!-- Clause Content -->
<div class="document-content">
    {{ content | safe }}
</div>

<!-- Signature Section -->
<div class="signature-section">
    <table class="signature-table">
        <tr>
            <td>
                <div class="signature-date">
                    {% if country_code == 'IT' %}Laives{% else %}Sulzberg{% endif %}, ______________
                </div>
            </td>
            <td></td>
        </tr>
        <tr>
            <td>
                <div class="signature-line">
                    {{ signatory_name }}<br>
                    {{ company_name }}
                </div>
            </td>
            <td>
                <div class="signature-line">
                    {{ employee_name }}
                </div>
            </td>
        </tr>
    </table>
</div>
"""
