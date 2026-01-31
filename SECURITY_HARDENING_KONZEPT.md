# Security-Hardening Gesamtkonzept

## Smart Document Generator - Enterprise Security Implementation

**Version:** 1.0
**Erstellt:** 25. Januar 2026
**Ziel:** Production-Ready Security für HR-Dokumentensystem

---

## 1. Executive Summary

Das System verarbeitet **hochsensible HR-Daten** (Gehälter, Kündigungen, Abmahnungen, persönliche Daten). Ein Sicherheitsvorfall hätte schwerwiegende Folgen:

- **DSGVO-Strafen:** Bis zu 4% des Jahresumsatzes
- **Reputationsschaden:** Vertrauensverlust bei Mitarbeitern
- **Rechtliche Konsequenzen:** Klagen von Betroffenen

Aktueller Sicherheitsstatus: **Kritisch - Nicht produktionsreif**

---

## 2. Identifizierte Sicherheitslücken

### 2.1 Kritische Lücken (CVSS 9-10)

| ID | Lücke | Ort | Risiko |
|----|-------|-----|--------|
| SEC-001 | Hardcodierter Secret Key | `config.py:7` | JWT-Fälschung möglich |
| SEC-002 | XSS via `dangerouslySetInnerHTML` | `DocumentGenerator.tsx:540` | Beliebiger Code im Browser |
| SEC-003 | XSS via `document.write()` | `TemplatePreview.tsx:303` | Beliebiger Code im Browser |
| SEC-004 | Path Traversal in Generation | `generation.py:12` | Datei-Zugriff außerhalb |
| SEC-005 | Ungeschützter Cache-Clear | `preview.py:215` | DoS-Attacke |
| SEC-006 | SQL Debug Mode aktiv | `db.py:8` | Daten in Logs sichtbar |

### 2.2 Hohe Priorität (CVSS 7-8)

| ID | Lücke | Ort | Risiko |
|----|-------|-----|--------|
| SEC-007 | Token-Gültigkeit 8 Tage | `config.py:9` | Session-Hijacking |
| SEC-008 | Kein Rate-Limiting | Alle Endpoints | Brute-Force, DoS |
| SEC-009 | Keine Security Headers | `main.py` | Clickjacking, XSS |
| SEC-010 | SVG-Upload erlaubt | `LogoUploader.tsx` | XSS via SVG |
| SEC-011 | Keine File-Size Limits | `attachments.py` | Disk Exhaustion |
| SEC-012 | User Enumeration | `auth.py:21` | Account-Discovery |
| SEC-013 | Sensitive Daten in localStorage | `DocumentGenerator.tsx:114` | XSS-Zugriff |

### 2.3 Mittlere Priorität (CVSS 4-6)

| ID | Lücke | Ort | Risiko |
|----|-------|-----|--------|
| SEC-014 | Keine CSRF-Protection | Backend | State-Manipulation |
| SEC-015 | Fehlende Input-Längen | Schemas | ReDoS, Memory |
| SEC-016 | Exception Details exposed | `generation.py:35` | Information Leak |
| SEC-017 | Keine Brute-Force Protection | `auth.py` | Account-Kompromittierung |
| SEC-018 | OpenAPI in Production | `main.py:14` | Schema-Leak |
| SEC-019 | Temp-Files in /tmp | `bulk.py:158` | Daten-Leak |
| SEC-020 | Keine Request-IDs | Logging | Audit-Trail-Lücke |

---

## 3. Security-Architektur (Ziel-Zustand)

```
                                    ┌─────────────────────┐
                                    │   WAF / CDN         │
                                    │   (Cloudflare/AWS)  │
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │   Load Balancer     │
                                    │   (TLS Termination) │
                                    └──────────┬──────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
         ┌──────────▼──────────┐    ┌──────────▼──────────┐    ┌──────────▼──────────┐
         │   API Gateway       │    │   API Gateway       │    │   API Gateway       │
         │   - Rate Limiting   │    │   - Rate Limiting   │    │   - Rate Limiting   │
         │   - Auth Check      │    │   - Auth Check      │    │   - Auth Check      │
         └──────────┬──────────┘    └──────────┬──────────┘    └──────────┬──────────┘
                    │                          │                          │
         ┌──────────▼──────────┐    ┌──────────▼──────────┐    ┌──────────▼──────────┐
         │   FastAPI Backend   │    │   FastAPI Backend   │    │   FastAPI Backend   │
         │   - Input Validation│    │   - Input Validation│    │   - Input Validation│
         │   - Business Logic  │    │   - Business Logic  │    │   - Business Logic  │
         └──────────┬──────────┘    └──────────┬──────────┘    └──────────┬──────────┘
                    │                          │                          │
                    └──────────────────────────┼──────────────────────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
         ┌──────────▼──────────┐    ┌──────────▼──────────┐    ┌──────────▼──────────┐
         │   PostgreSQL        │    │   Redis             │    │   MinIO / S3        │
         │   (Encrypted)       │    │   (Rate Limits)     │    │   (Documents)       │
         └─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

---

## 4. Implementierungs-Konzept

### 4.1 Authentication & Authorization

#### 4.1.1 JWT-Verbesserungen

**Aktuell:**
```python
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 8  # 8 Tage - UNSICHER!
```

**Ziel:**
```python
# config.py
ACCESS_TOKEN_EXPIRE_MINUTES = 15           # 15 Minuten
REFRESH_TOKEN_EXPIRE_DAYS = 7              # 7 Tage
SECRET_KEY = os.environ["SECRET_KEY"]      # KEINE Defaults!
REFRESH_SECRET_KEY = os.environ["REFRESH_SECRET_KEY"]

# Separate Keys für Access und Refresh Tokens
# Rotation alle 90 Tage
```

#### 4.1.2 Token-Rotation

```python
# security.py - NEU
def create_token_pair(user_id: str) -> TokenPair:
    """Erstellt Access + Refresh Token Paar."""
    access_token = create_access_token(
        data={"sub": user_id, "type": "access"},
        expires_delta=timedelta(minutes=15)
    )
    refresh_token = create_access_token(
        data={"sub": user_id, "type": "refresh"},
        expires_delta=timedelta(days=7),
        secret_key=settings.REFRESH_SECRET_KEY
    )
    return TokenPair(access_token=access_token, refresh_token=refresh_token)

def refresh_access_token(refresh_token: str) -> str:
    """Generiert neuen Access Token aus Refresh Token."""
    payload = jwt.decode(refresh_token, settings.REFRESH_SECRET_KEY, algorithms=["HS256"])
    if payload.get("type") != "refresh":
        raise InvalidTokenError()
    return create_access_token(data={"sub": payload["sub"], "type": "access"})
```

#### 4.1.3 Brute-Force Protection

```python
# middleware/rate_limit.py - NEU
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# In main.py
app.state.limiter = limiter

# In auth.py
@router.post("/login")
@limiter.limit("5/minute")  # Max 5 Login-Versuche pro Minute
async def login(request: Request, ...):
    ...
```

#### 4.1.4 Account Lockout

```python
# models/user.py - Erweiterung
class User(Base):
    # ... bestehende Felder ...
    failed_login_attempts: int = 0
    locked_until: datetime = None

# auth.py
async def authenticate_user(email: str, password: str, db: AsyncSession) -> User:
    user = await get_user_by_email(db, email)

    if user and user.locked_until and user.locked_until > datetime.utcnow():
        raise HTTPException(status_code=423, detail="Account temporarily locked")

    if not user or not verify_password(password, user.hashed_password):
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.locked_until = datetime.utcnow() + timedelta(minutes=15)
            await db.commit()
        # WICHTIG: Gleiche Fehlermeldung für beide Fälle!
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Reset bei erfolgreichem Login
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()
    return user
```

---

### 4.2 Input Validation & Sanitization

#### 4.2.1 Pydantic Schemas härten

**Aktuell:**
```python
class ClauseBase(BaseModel):
    title: str           # Keine Limits!
    content_html: str    # Beliebiges HTML!
```

**Ziel:**
```python
from pydantic import BaseModel, Field, validator
import bleach

ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3']
ALLOWED_ATTRIBUTES = {}

class ClauseBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content_html: str = Field(..., max_length=100000)

    @validator('content_html')
    def sanitize_html(cls, v):
        """Entfernt gefährliche HTML-Tags und Attribute."""
        return bleach.clean(
            v,
            tags=ALLOWED_TAGS,
            attributes=ALLOWED_ATTRIBUTES,
            strip=True
        )

    @validator('title')
    def sanitize_title(cls, v):
        """Entfernt Steuerzeichen und trimmt."""
        import re
        v = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', v)  # Control chars
        return v.strip()
```

#### 4.2.2 Path Traversal Prevention

**Aktuell:**
```python
@router.post("/generate/{template_name}")
async def generate_document(template_name: str, ...):
    # template_name wird direkt verwendet - UNSICHER!
```

**Ziel:**
```python
import re
from pathlib import Path

ALLOWED_TEMPLATES = {"arbeitsvertrag", "kuendigung", "abmahnung", "zeugnis"}
TEMPLATE_DIR = Path("/app/templates")

@router.post("/generate/{template_name}")
async def generate_document(template_name: str, ...):
    # Whitelist-Check
    if template_name not in ALLOWED_TEMPLATES:
        raise HTTPException(status_code=400, detail="Invalid template")

    # Zusätzlich: Pfad-Normalisierung
    template_path = (TEMPLATE_DIR / f"{template_name}.docx").resolve()
    if not str(template_path).startswith(str(TEMPLATE_DIR)):
        raise HTTPException(status_code=400, detail="Invalid template path")
```

#### 4.2.3 File Upload Security

```python
# attachments.py - GEHÄRTET
import magic
from pathlib import Path

ALLOWED_MIME_TYPES = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

@router.post("/attachments")
async def create_attachment(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    # 1. Größen-Check
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    # 2. MIME-Type via Magic Bytes (nicht file.content_type!)
    detected_mime = magic.from_buffer(content, mime=True)
    if detected_mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=415, detail=f"File type not allowed: {detected_mime}")

    # 3. Sicherer Dateiname (UUID + Extension)
    import uuid
    safe_filename = f"{uuid.uuid4()}{ALLOWED_MIME_TYPES[detected_mime]}"

    # 4. Speichern außerhalb des Web-Roots
    save_path = Path(settings.UPLOAD_DIR) / safe_filename
    save_path.write_bytes(content)

    # 5. Virus-Scan (optional, empfohlen)
    # await scan_file_for_viruses(save_path)
```

---

### 4.3 Security Headers

#### 4.3.1 Backend Middleware

```python
# middleware/security_headers.py - NEU
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)

        # Clickjacking Prevention
        response.headers["X-Frame-Options"] = "DENY"

        # XSS Protection
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # HTTPS Enforcement
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Content Security Policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "font-src 'self'; "
            "frame-ancestors 'none'; "
            "form-action 'self';"
        )

        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions Policy
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=(), payment=()"
        )

        return response

# main.py
app.add_middleware(SecurityHeadersMiddleware)
```

#### 4.3.2 Frontend Meta-Tags

```html
<!-- index.html -->
<head>
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;">
    <meta http-equiv="X-Content-Type-Options" content="nosniff">
    <meta name="referrer" content="strict-origin-when-cross-origin">
</head>
```

---

### 4.4 XSS Prevention (Frontend)

#### 4.4.1 HTML Sanitization

**Aktuell (UNSICHER):**
```tsx
<div dangerouslySetInnerHTML={{ __html: previewHtml }} />
```

**Ziel:**
```tsx
// utils/sanitize.ts - NEU
import DOMPurify from 'dompurify';

export function sanitizeHtml(dirty: string): string {
    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'table', 'tr', 'td', 'th'],
        ALLOWED_ATTR: ['class', 'style'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
        FORBID_ATTR: ['onclick', 'onerror', 'onload', 'onmouseover']
    });
}

// DocumentGenerator.tsx
import { sanitizeHtml } from '@/utils/sanitize';

<div
    className="document-preview"
    dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml) }}
/>
```

#### 4.4.2 Sichere Print-Funktion

**Aktuell (UNSICHER):**
```tsx
printWindow.document.write(previewHtml);
```

**Ziel:**
```tsx
// utils/print.ts - NEU
import { sanitizeHtml } from './sanitize';

export function printHtml(html: string, title: string = 'Dokument') {
    const sanitized = sanitizeHtml(html);
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');

    if (!printWindow) {
        console.error('Popup blocked');
        return;
    }

    // Sicherer Weg: DOM-Manipulation statt document.write
    const doc = printWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${DOMPurify.sanitize(title)}</title>
            <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline';">
        </head>
        <body>${sanitized}</body>
        </html>
    `);
    doc.close();
    printWindow.print();
}
```

#### 4.4.3 Sichere localStorage-Nutzung

**Aktuell (UNSICHER):**
```tsx
localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
// Enthält: Namen, Gehälter, Geburtsdaten - im Klartext!
```

**Ziel:**
```tsx
// utils/secureStorage.ts - NEU
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = 'generated-per-session-from-user-token';

export const secureStorage = {
    setItem(key: string, value: unknown): void {
        const encrypted = CryptoJS.AES.encrypt(
            JSON.stringify(value),
            ENCRYPTION_KEY
        ).toString();
        sessionStorage.setItem(key, encrypted);  // sessionStorage statt localStorage
    },

    getItem<T>(key: string): T | null {
        const encrypted = sessionStorage.getItem(key);
        if (!encrypted) return null;

        try {
            const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
            return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
        } catch {
            return null;
        }
    },

    removeItem(key: string): void {
        sessionStorage.removeItem(key);
    }
};
```

---

### 4.5 Rate Limiting

#### 4.5.1 Redis-basiertes Rate Limiting

```python
# middleware/rate_limit.py - NEU
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import redis

# Redis-Backend für verteiltes Rate Limiting
redis_client = redis.from_url(settings.REDIS_URL)
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.REDIS_URL
)

# main.py
from slowapi.errors import RateLimitExceeded

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Verschiedene Limits pro Endpoint-Typ
RATE_LIMITS = {
    "login": "5/minute",           # Login: 5 Versuche/Minute
    "api_read": "100/minute",      # GET-Requests: 100/Minute
    "api_write": "30/minute",      # POST/PUT/DELETE: 30/Minute
    "generation": "10/minute",     # PDF-Generierung: 10/Minute
    "bulk": "2/minute",            # Bulk-Jobs: 2/Minute
}
```

#### 4.5.2 Endpoint-spezifische Limits

```python
# generation.py
@router.post("/generate/{template_name}")
@limiter.limit("10/minute")
async def generate_document(request: Request, ...):
    ...

# bulk.py
@router.post("/jobs")
@limiter.limit("2/minute")
async def create_bulk_job(request: Request, ...):
    ...

# auth.py
@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, ...):
    ...
```

---

### 4.6 Logging & Monitoring

#### 4.6.1 Structured Security Logging

```python
# utils/security_logger.py - NEU
import structlog
import json
from datetime import datetime

logger = structlog.get_logger()

class SecurityEvent:
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGIN_LOCKED = "login_locked"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    SUSPICIOUS_INPUT = "suspicious_input"
    FILE_UPLOAD = "file_upload"
    DATA_EXPORT = "data_export"
    ADMIN_ACTION = "admin_action"

def log_security_event(
    event_type: str,
    user_id: str = None,
    ip_address: str = None,
    details: dict = None,
    severity: str = "INFO"
):
    logger.bind(
        event_type=event_type,
        user_id=user_id,
        ip_address=ip_address,
        timestamp=datetime.utcnow().isoformat(),
        severity=severity,
        details=details or {}
    ).info(f"Security event: {event_type}")

# Verwendung in auth.py
async def login(...):
    try:
        user = await authenticate_user(...)
        log_security_event(
            SecurityEvent.LOGIN_SUCCESS,
            user_id=user.id,
            ip_address=request.client.host
        )
    except HTTPException:
        log_security_event(
            SecurityEvent.LOGIN_FAILED,
            ip_address=request.client.host,
            details={"email": form_data.username},
            severity="WARNING"
        )
        raise
```

#### 4.6.2 Request Tracing

```python
# middleware/request_id.py - NEU
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar('request_id', default='')

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request_id = request.headers.get('X-Request-ID', str(uuid.uuid4()))
        request_id_var.set(request_id)

        response = await call_next(request)
        response.headers['X-Request-ID'] = request_id

        return response

# Logging mit Request-ID
logger.bind(request_id=request_id_var.get()).info("Processing request")
```

---

### 4.7 CORS & CSRF Protection

#### 4.7.1 Strikte CORS-Konfiguration

```python
# main.py - GEHÄRTET
from fastapi.middleware.cors import CORSMiddleware

ALLOWED_ORIGINS = [
    "https://app.niederwieser.de",
    "https://staging.niederwieser.de",
]

if settings.DEBUG:
    ALLOWED_ORIGINS.append("http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # Explizite Whitelist
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],  # Explizite Methoden
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],  # Explizite Headers
    expose_headers=["X-Request-ID"],
    max_age=600,  # Preflight-Cache: 10 Minuten
)
```

#### 4.7.2 CSRF-Token Implementation

```python
# middleware/csrf.py - NEU
from starlette_csrf import CSRFMiddleware

# main.py
app.add_middleware(
    CSRFMiddleware,
    secret=settings.CSRF_SECRET,
    cookie_name="csrf_token",
    cookie_secure=True,  # Nur über HTTPS
    cookie_samesite="strict",
)

# Frontend muss CSRF-Token im Header senden:
# X-CSRF-Token: <token aus Cookie>
```

---

### 4.8 Database Security

#### 4.8.1 Debug-Mode deaktivieren

```python
# db.py - GEHÄRTET
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,  # Nur in Development!
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,  # Connection Health Check
)
```

#### 4.8.2 Encryption at Rest

```sql
-- PostgreSQL: Transparent Data Encryption
-- In postgresql.conf oder via Cloud-Provider (AWS RDS, Azure)

-- Sensitive Spalten zusätzlich verschlüsseln:
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Beispiel: Gehalt verschlüsselt speichern
ALTER TABLE generated_documents
ADD COLUMN form_data_encrypted BYTEA;

-- Verschlüsselung beim Schreiben
UPDATE generated_documents
SET form_data_encrypted = pgp_sym_encrypt(form_data::text, 'encryption_key');
```

---

### 4.9 Secrets Management

#### 4.9.1 Environment Variables

```bash
# .env.production (NIEMALS in Git!)
SECRET_KEY=<64-Zeichen-Zufallsstring>
REFRESH_SECRET_KEY=<64-Zeichen-Zufallsstring>
CSRF_SECRET=<32-Zeichen-Zufallsstring>
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/db
REDIS_URL=redis://:password@host:6379/0

# Generierung:
# python -c "import secrets; print(secrets.token_urlsafe(64))"
```

#### 4.9.2 Vault Integration (Optional, Enterprise)

```python
# utils/secrets.py - NEU
import hvac

class VaultClient:
    def __init__(self):
        self.client = hvac.Client(
            url=os.environ['VAULT_ADDR'],
            token=os.environ['VAULT_TOKEN']
        )

    def get_secret(self, path: str) -> dict:
        response = self.client.secrets.kv.v2.read_secret_version(path=path)
        return response['data']['data']

# Verwendung
vault = VaultClient()
db_credentials = vault.get_secret('database/creds')
```

---

## 5. Deployment Security

### 5.1 Docker Security

```dockerfile
# Dockerfile - GEHÄRTET
FROM python:3.11-slim

# Nicht als root laufen!
RUN useradd -m -u 1000 appuser
USER appuser

# Keine Secrets im Image
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Health Check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

COPY --chown=appuser:appuser . /app
WORKDIR /app

RUN pip install --no-cache-dir -r requirements.txt

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 5.2 Kubernetes Security (Optional)

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - name: api
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
              - ALL
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
```

---

## 6. Compliance & Audit

### 6.1 GDPR-Anforderungen

| Anforderung | Implementierung |
|-------------|-----------------|
| Datenminimierung | Nur notwendige Felder erfassen |
| Speicherbegrenzung | Retention-Policies (7 Jahre) |
| Auskunftsrecht | Export-Endpoint für User-Daten |
| Löschrecht | Anonymisierung nach Löschung |
| Audit-Trail | Immutable Logs, 7 Jahre |

### 6.2 Security Audit Checklist

```markdown
[ ] Penetration Test durchgeführt
[ ] Dependency Scan (npm audit, safety check)
[ ] OWASP Top 10 geprüft
[ ] Code Review für Security
[ ] Security Headers validiert (securityheaders.com)
[ ] SSL/TLS Konfiguration geprüft (ssllabs.com)
[ ] Rate Limiting getestet
[ ] Brute-Force Protection getestet
[ ] Input Validation getestet
[ ] Error Handling geprüft (keine Stack Traces)
```

---

## 7. Notfall-Prozeduren

### 7.1 Incident Response

1. **Erkennung:** Monitoring-Alert oder User-Report
2. **Eindämmung:** Betroffenen Service isolieren
3. **Analyse:** Logs auswerten, Scope bestimmen
4. **Behebung:** Patch deployen, Secrets rotieren
5. **Recovery:** Service wiederherstellen
6. **Dokumentation:** Incident Report erstellen
7. **Verbesserung:** Maßnahmen für Prävention

### 7.2 Secret Rotation

```bash
#!/bin/bash
# rotate_secrets.sh

# 1. Neue Secrets generieren
NEW_SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(64))")
NEW_REFRESH_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(64))")

# 2. In Vault/Secrets Manager speichern
vault kv put secret/app SECRET_KEY=$NEW_SECRET_KEY REFRESH_SECRET_KEY=$NEW_REFRESH_KEY

# 3. Rolling Restart der Pods
kubectl rollout restart deployment/api

# 4. Alte Tokens invalidieren (alle User müssen neu einloggen)
```

---

## 8. Zusammenfassung

### Was muss SOFORT gemacht werden:

1. Secret Key aus Code entfernen
2. Debug-Mode deaktivieren
3. XSS-Vulnerabilities fixen
4. Cache-Clear Endpoint schützen

### Was muss diese Woche gemacht werden:

5. Token-Gültigkeit reduzieren
6. Security Headers implementieren
7. Rate Limiting aktivieren
8. Input Validation vervollständigen

### Was muss vor Go-Live gemacht werden:

9. Penetration Test
10. GDPR-Compliance prüfen
11. Dependency Scan
12. Security Audit

---

*Dieses Konzept basiert auf OWASP Best Practices, BSI Grundschutz und Enterprise Security Standards.*
