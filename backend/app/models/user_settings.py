"""
User Feature Settings Model

Stores user-specific feature toggle preferences.
All features are enabled by default (opt-out model).
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.db import Base


class UserFeatureSettings(Base):
    """
    User-specific feature toggles.

    All features default to True (enabled).
    Users can disable features they don't need.
    """
    __tablename__ = "user_feature_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)

    # Document Management Features
    show_documents_overview = Column(Boolean, default=True, nullable=False)
    show_deadlines_widget = Column(Boolean, default=True, nullable=False)
    show_activity_feed = Column(Boolean, default=True, nullable=False)

    # Document Processing Features
    enable_document_upload = Column(Boolean, default=True, nullable=False)
    enable_ai_extraction = Column(Boolean, default=True, nullable=False)

    # Workflow Features (OPTIONAL - not mandatory)
    enable_approval_workflow = Column(Boolean, default=True, nullable=False)

    # AI Features
    enable_smart_mode = Column(Boolean, default=True, nullable=False)
    enable_compliance_scanner = Column(Boolean, default=True, nullable=False)
    enable_chat_assistant = Column(Boolean, default=True, nullable=False)
    enable_ai_streaming = Column(Boolean, default=True, nullable=False)
    enable_ghostwriter = Column(Boolean, default=True, nullable=False)
    enable_ai_agent = Column(Boolean, default=True, nullable=False)
    enable_onboarding_agent = Column(Boolean, default=True, nullable=False)

    # UI Preferences
    show_quick_templates = Column(Boolean, default=True, nullable=False)
    compact_sidebar = Column(Boolean, default=False, nullable=False)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


# Feature definitions for frontend
FEATURE_DEFINITIONS = {
    "show_documents_overview": {
        "label": "Dokumentenübersicht",
        "description": "Zeigt eine Tabelle aller Dokumente mit Status und Suche",
        "category": "dashboard",
        "icon": "FileText"
    },
    "show_deadlines_widget": {
        "label": "Fristen-Widget",
        "description": "Zeigt anstehende Fristen und Erinnerungen",
        "category": "dashboard",
        "icon": "Clock"
    },
    "show_activity_feed": {
        "label": "Aktivitäts-Feed",
        "description": "Zeigt letzte Aktionen und Änderungen",
        "category": "dashboard",
        "icon": "Activity"
    },
    "enable_document_upload": {
        "label": "Dokument-Upload",
        "description": "Ermöglicht das Hochladen von Dokumenten zur Analyse",
        "category": "documents",
        "icon": "Upload"
    },
    "enable_ai_extraction": {
        "label": "KI-Datenextraktion",
        "description": "Extrahiert automatisch Daten aus hochgeladenen Dokumenten",
        "category": "documents",
        "icon": "Brain"
    },
    "enable_approval_workflow": {
        "label": "Genehmigungsworkflow",
        "description": "Freiwilliger Genehmigungsprozess für Dokumente (nicht verpflichtend)",
        "category": "workflow",
        "icon": "CheckSquare",
        "optional": True
    },
    "enable_smart_mode": {
        "label": "Smart Mode",
        "description": "Gesprächsbasierte Dokumenterstellung",
        "category": "ai",
        "icon": "Wand2"
    },
    "enable_compliance_scanner": {
        "label": "Compliance-Scanner",
        "description": "Prüft Dokumente auf rechtliche Risiken",
        "category": "ai",
        "icon": "Shield"
    },
    "enable_chat_assistant": {
        "label": "Chat-Assistent",
        "description": "Natürlichsprachliche Dokumenterstellung",
        "category": "ai",
        "icon": "MessageSquare"
    },
    "enable_ai_streaming": {
        "label": "KI-Streaming",
        "description": "Zeigt KI-generierte Texte in Echtzeit Token für Token an",
        "category": "ai",
        "icon": "Zap"
    },
    "enable_ghostwriter": {
        "label": "KI-Ghostwriter",
        "description": "Generiert proaktiv Einleitungsabsätze basierend auf Formulardaten",
        "category": "ai",
        "icon": "Sparkles"
    },
    "enable_ai_agent": {
        "label": "KI-Assistent (Agent-Modus)",
        "description": "Aktiviert den KI-gestützten Dokumentenassistenten mit Chat-First-Workflow",
        "category": "ai",
        "icon": "Bot"
    },
    "enable_onboarding_agent": {
        "label": "Onboarding-Agent",
        "description": "Erstellt komplette Dokumentpakete (Onboarding, Kündigung, Beförderung) per Chat",
        "category": "ai",
        "icon": "Package"
    },
    "show_quick_templates": {
        "label": "Schnellstart-Templates",
        "description": "Zeigt häufig genutzte Vorlagen auf dem Dashboard",
        "category": "ui",
        "icon": "Zap"
    },
    "compact_sidebar": {
        "label": "Kompakte Sidebar",
        "description": "Minimiert die Seitenleiste für mehr Platz",
        "category": "ui",
        "icon": "Sidebar"
    }
}

# Category labels
FEATURE_CATEGORIES = {
    "dashboard": {"label": "Dashboard", "icon": "LayoutDashboard"},
    "documents": {"label": "Dokumente", "icon": "FileText"},
    "workflow": {"label": "Workflow", "icon": "GitBranch"},
    "ai": {"label": "KI-Funktionen", "icon": "Sparkles"},
    "ui": {"label": "Benutzeroberfläche", "icon": "Monitor"}
}
