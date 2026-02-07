# 🚀 Ultra-Simple Deployment Guide

**Du brauchst nur 3 Schritte!** ⚡

---

## ✅ Voraussetzungen

Installiere auf deinem Server:
1. **Docker Desktop** - [Download hier](https://www.docker.com/products/docker-desktop/)
2. **Git** - Falls noch nicht installiert

Das wars! Mehr brauchst du nicht.

---

## 📦 SCHRITT 1: Code herunterladen

```bash
# Clone das Repository
git clone <dein-repo-url>
cd smart-doc-generator

# Wechsel zum richtigen Branch
git checkout claude/review-app-code-qmWZ7
```

---

## 🔐 SCHRITT 2: Umgebung anpassen (Optional, aber empfohlen)

Öffne `backend/.env` und ändere:

```bash
# Öffne die Datei
nano backend/.env

# Ändere diese Zeilen:
DATABASE_URL=postgresql+asyncpg://docgen_user:DEIN_SICHERES_PASSWORT@db:5432/docgen_db
CORS_ORIGINS=http://localhost:5173,https://deine-domain.com
API_BASE_URL=https://deine-domain.com

# Speichern: Ctrl+O, Enter, Ctrl+X
```

**Falls du die Datei nicht findest:** Das Deployment-Script erstellt sie automatisch!

---

## 🚀 SCHRITT 3: Deployment starten

**Das ist der einzige Command, den du brauchst:**

```bash
./deploy.sh
```

Das Script macht **ALLES automatisch**:
- ✅ Prüft Docker Installation
- ✅ Erstellt .env falls nicht vorhanden
- ✅ Generiert sichere Secret Keys
- ✅ Baut Docker Images
- ✅ Startet alle Services (Backend, Database, Redis)
- ✅ Führt Database Migrations aus
- ✅ Testet ob alles läuft
- ✅ Zeigt dir die URLs

**Dauer:** 5-10 Minuten beim ersten Mal

---

## ✨ Fertig!

Nach dem Script siehst du:

```
🎉 DEPLOYMENT COMPLETE!

Service URLs:
  🌐 API:       http://localhost:8000
  📊 Health:    http://localhost:8000/health
  🔐 Login:     http://localhost:8000/api/v1/auth/login
```

Test ob es funktioniert:

```bash
curl http://localhost:8000/health
# Erwartet: {"status":"healthy"}
```

---

## 📊 Nützliche Commands

### Services ansehen
```bash
docker compose ps
```

### Logs anschauen
```bash
docker compose logs -f web      # API logs
docker compose logs -f db       # Database logs
docker compose logs -f          # Alle logs
```

### Services stoppen
```bash
docker compose down
```

### Services neu starten
```bash
docker compose restart
```

### Neues Deployment
```bash
git pull                        # Neue Changes holen
docker compose down             # Stoppen
./deploy.sh                     # Neu deployen
```

---

## 🐛 Probleme?

### "Docker daemon not running"
```bash
# Starte Docker Desktop
# Oder auf Linux:
sudo systemctl start docker
```

### "Port already in use"
```bash
# Stoppe andere Services die Port 8000, 5432, oder 6379 nutzen
docker compose down
lsof -i :8000
```

### "Permission denied: deploy.sh"
```bash
chmod +x deploy.sh
./deploy.sh
```

### Services laufen nicht
```bash
# Logs prüfen
docker compose logs

# Neu starten
docker compose down
docker compose up -d --build
```

---

## 🔐 Admin-User erstellen

Nach dem Deployment:

```bash
docker compose exec web python -c "
from app.db import get_db
from app.models.core import User
from app.core.security import get_password_hash
from sqlalchemy import select
import asyncio

async def create_admin():
    async for db in get_db():
        # Check if admin exists
        result = await db.execute(select(User).where(User.email == 'admin@example.com'))
        if result.scalar_one_or_none():
            print('Admin already exists')
            return

        # Create admin
        admin = User(
            email='admin@example.com',
            password_hash=get_password_hash('changeme123'),
            role='admin',
            country_code='DE',
            is_active=True
        )
        db.add(admin)
        await db.commit()
        print('Admin created: admin@example.com / changeme123')

asyncio.run(create_admin())
"
```

**Login:**
- Email: `admin@example.com`
- Password: `changeme123`

**⚠️ Ändere das Passwort sofort nach dem ersten Login!**

---

## 🌐 Frontend (Optional)

Wenn du auch das Frontend deployen willst:

```bash
cd frontend

# Dependencies installieren
npm install

# Production Build
npm run build

# Output ist in: frontend/dist/
```

Dann mit Nginx oder einem anderen Webserver serven.

---

## 📚 Mehr Infos?

- **Komplette Anleitung:** `PRODUCTION_DEPLOYMENT_GUIDE.md`
- **Security Details:** `SECURITY_HARDENING_KONZEPT.md`
- **Deployment Checklist:** `DEPLOYMENT_CHECKLIST.md`

---

## 🎯 Cheat Sheet

```bash
# Schnell-Deployment
git clone <repo> && cd smart-doc-generator
./deploy.sh

# Status prüfen
docker compose ps
curl http://localhost:8000/health

# Logs
docker compose logs -f web

# Stoppen
docker compose down

# Neu deployen
git pull && ./deploy.sh
```

---

## ✅ Das wars!

Du hast jetzt:
- ✅ Backend API läuft
- ✅ PostgreSQL Database
- ✅ Redis für Rate Limiting
- ✅ Celery Worker für Jobs
- ✅ Alle Security Features aktiv
- ✅ Production-ready Setup

**Viel Erfolg! 🚀**
