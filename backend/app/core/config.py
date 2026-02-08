from pydantic_settings import BaseSettings
from pydantic import field_validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "Smart Document Generator"
    API_V1_STR: str = "/api/v1"

    # SECURITY: Secret Keys MÜSSEN als Environment Variables gesetzt werden
    SECRET_KEY: str = ""  # Für Access Tokens
    REFRESH_SECRET_KEY: str = ""  # Separate Key für Refresh Tokens (erhöhte Sicherheit)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # 1 Stunde (vorher 8 Tage - unsicher!)
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7  # Refresh Token: 7 Tage

    # Debug-Mode: Nur in Development aktivieren
    DEBUG: bool = False

    # Explicit opt-in for auth bypass in local development
    # Must be explicitly set to True alongside DEBUG=True to skip authentication
    ALLOW_AUTH_BYPASS: bool = False

    # Control API docs visibility independently from DEBUG
    SHOW_API_DOCS: bool = False

    # Environment identifier (development, staging, production)
    ENVIRONMENT: str = "development"

    # Logging
    LOG_LEVEL: str = "INFO"  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    LOG_FORMAT: str = "json"  # "json" for production, "text" for development

    # Sentry Error Tracking (optional – leave empty to disable)
    SENTRY_DSN: str = ""
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1  # 10% of transactions

    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost/docgen_db"
    REDIS_URL: str = "redis://localhost:6379/0"

    # API Base URL for generating absolute URLs (e.g., for logo in preview)
    API_BASE_URL: str = "http://localhost:8000"

    # CORS: In Production explizite Domains setzen (Komma-getrennt in .env)
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # E-Mail (SMTP) – leave empty to disable email notifications
    MAIL_SERVER: str = ""
    MAIL_PORT: int = 587
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "noreply@example.com"
    MAIL_FROM_NAME: str = "Smart Document Generator"
    MAIL_USE_TLS: bool = True
    MAIL_USE_SSL: bool = False

    # SSO / OAuth2 (OIDC) – leave empty to disable SSO
    # Supported providers: azure_ad, google, custom_oidc
    SSO_PROVIDER: str = ""  # e.g. "azure_ad"
    SSO_CLIENT_ID: str = ""
    SSO_CLIENT_SECRET: str = ""
    SSO_TENANT_ID: str = ""  # Azure AD Tenant ID
    SSO_AUTHORITY_URL: str = ""  # OIDC issuer URL (auto-derived for azure_ad if empty)
    SSO_CALLBACK_URL: str = ""  # Backend callback URL (auto-derived if empty)
    SSO_AUTO_CREATE_USERS: bool = True  # Auto-create user on first SSO login
    SSO_DEFAULT_ROLE: str = "user"  # Default role for SSO-created users

    @property
    def sso_enabled(self) -> bool:
        return bool(self.SSO_PROVIDER and self.SSO_CLIENT_ID and self.SSO_CLIENT_SECRET)

    @property
    def sso_authority_url(self) -> str:
        if self.SSO_AUTHORITY_URL:
            return self.SSO_AUTHORITY_URL
        if self.SSO_PROVIDER == "azure_ad" and self.SSO_TENANT_ID:
            return f"https://login.microsoftonline.com/{self.SSO_TENANT_ID}/v2.0"
        return ""

    @property
    def sso_callback_url(self) -> str:
        if self.SSO_CALLBACK_URL:
            return self.SSO_CALLBACK_URL
        return f"{self.API_BASE_URL}{self.API_V1_STR}/auth/sso/callback"

    @property
    def mail_enabled(self) -> bool:
        return bool(self.MAIL_SERVER and self.MAIL_USERNAME)

    @property
    def BACKEND_CORS_ORIGINS(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if not v or v == "" or len(v) < 43:
            raise ValueError(
                "SECRET_KEY muss als Environment Variable gesetzt werden (min. 43 Zeichen / 256-bit). "
                "Generiere einen mit: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )
        # Reject obvious development/placeholder keys in production
        weak_patterns = ["dev_", "test_", "local_", "changeme", "password", "example"]
        if any(pattern in v.lower() for pattern in weak_patterns):
            import os
            if os.environ.get("DEBUG", "").lower() != "true":
                raise ValueError(
                    "SECRET_KEY enthält unsichere Muster und darf in Production nicht verwendet werden. "
                    "Generiere einen mit: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
                )
        return v

    @field_validator("REFRESH_SECRET_KEY")
    @classmethod
    def validate_refresh_secret_key(cls, v: str) -> str:
        if not v or v == "" or len(v) < 43:
            raise ValueError(
                "REFRESH_SECRET_KEY muss als Environment Variable gesetzt werden (min. 43 Zeichen / 256-bit). "
                "WICHTIG: Muss unterschiedlich von SECRET_KEY sein! "
                "Generiere einen mit: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )
        # Reject obvious development/placeholder keys in production
        weak_patterns = ["dev_", "test_", "local_", "changeme", "password", "example"]
        if any(pattern in v.lower() for pattern in weak_patterns):
            import os
            if os.environ.get("DEBUG", "").lower() != "true":
                raise ValueError(
                    "REFRESH_SECRET_KEY enthält unsichere Muster und darf in Production nicht verwendet werden. "
                    "Generiere einen mit: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
                )
        return v

    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
