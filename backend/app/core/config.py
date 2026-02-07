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

    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost/docgen_db"
    REDIS_URL: str = "redis://localhost:6379/0"

    # API Base URL for generating absolute URLs (e.g., for logo in preview)
    API_BASE_URL: str = "http://localhost:8000"

    # CORS: In Production explizite Domains setzen (Komma-getrennt in .env)
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

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
