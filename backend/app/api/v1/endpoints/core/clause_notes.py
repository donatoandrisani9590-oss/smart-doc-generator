"""
Textbaustein-Notizen API (v4.2 Feature: Kapitel 15.5.6)

Interne Notizen pro Klausel für HR/Admin:
- "RA Müller hat geprüft"
- "Betriebsrat zugestimmt"
- Diese erscheinen NICHT im generierten Dokument
"""
from __future__ import annotations
from typing import Any, List, Annotated, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel

from app.db import get_db
from app.api import deps
from app.models.documents import ClauseNote, Clause

router = APIRouter()


async def _get_clause_with_access_check(
    clause_id: int, db, current_user
) -> Clause:
    """Load clause and verify tenant access."""
    clause = await db.get(Clause, clause_id)
    if not clause:
        raise HTTPException(status_code=404, detail="Textbaustein nicht gefunden")
    if clause.user_id is not None and clause.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Zugriff verweigert")
    return clause


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════
class ClauseNoteCreate(BaseModel):
    content: str
    is_pinned: bool = False
    note_type: str = "info"  # info, warning, legal, approval


class ClauseNoteUpdate(BaseModel):
    content: Optional[str] = None
    is_pinned: Optional[bool] = None
    note_type: Optional[str] = None


class ClauseNoteResponse(BaseModel):
    id: int
    clause_id: int
    content: str
    is_pinned: bool
    note_type: str
    created_by_user_id: str
    created_by_user_name: str
    created_at: str

    class Config:
        from_attributes = True


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/{clause_id}/notes", response_model=List[ClauseNoteResponse])
async def get_clause_notes(
    clause_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Any, Depends(deps.get_current_user)],
) -> Any:
    """
    Alle Notizen für einen Textbaustein abrufen (Tenant-isoliert).
    Sortiert: Angeheftete zuerst, dann nach Datum (neueste zuerst).
    """
    # Prüfen ob Klausel existiert + Tenant-Check
    clause = await _get_clause_with_access_check(clause_id, db, current_user)

    query = (
        select(ClauseNote)
        .where(ClauseNote.clause_id == clause_id)
        .order_by(ClauseNote.is_pinned.desc(), ClauseNote.created_at.desc())
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{clause_id}/notes", response_model=ClauseNoteResponse)
async def create_clause_note(
    clause_id: int,
    note_in: ClauseNoteCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Any, Depends(deps.get_current_user)],
) -> Any:
    """
    Neue Notiz zu eines Textbausteins hinzufügen (Tenant-isoliert).
    """
    # Prüfen ob Klausel existiert + Tenant-Check
    clause = await _get_clause_with_access_check(clause_id, db, current_user)

    # Notiz erstellen
    note = ClauseNote(
        clause_id=clause_id,
        content=note_in.content,
        is_pinned=note_in.is_pinned,
        note_type=note_in.note_type,
        created_by_user_id=getattr(current_user, "id", "unknown"),
        created_by_user_name=getattr(current_user, "full_name", "Unbekannt"),
        created_at=datetime.utcnow().isoformat(),
    )

    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


@router.put("/{clause_id}/notes/{note_id}", response_model=ClauseNoteResponse)
async def update_clause_note(
    clause_id: int,
    note_id: int,
    note_in: ClauseNoteUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Any, Depends(deps.get_current_user)],
) -> Any:
    """
    Notiz aktualisieren (nur eigene Notizen oder Admin).
    """
    # Tenant-Check auf den Textbaustein
    await _get_clause_with_access_check(clause_id, db, current_user)

    note = await db.get(ClauseNote, note_id)
    if not note or note.clause_id != clause_id:
        raise HTTPException(status_code=404, detail="Notiz nicht gefunden")

    # Ownership-Check: Nur der Ersteller oder Admins dürfen Notizen ändern
    note_owner = str(getattr(note, "created_by_user_id", ""))
    if note_owner != str(current_user.id) and getattr(current_user, "role", "") != "admin":
        raise HTTPException(status_code=403, detail="Nur der Ersteller oder Admins dürfen Notizen ändern")

    # Update-Felder
    if note_in.content is not None:
        note.content = note_in.content
    if note_in.is_pinned is not None:
        note.is_pinned = note_in.is_pinned
    if note_in.note_type is not None:
        note.note_type = note_in.note_type

    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/{clause_id}/notes/{note_id}")
async def delete_clause_note(
    clause_id: int,
    note_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Any, Depends(deps.get_current_active_admin)],
) -> Any:
    """
    Notiz löschen (nur Admins, Tenant-isoliert).
    """
    # Tenant-Check auf den Textbaustein
    await _get_clause_with_access_check(clause_id, db, current_user)

    note = await db.get(ClauseNote, note_id)
    if not note or note.clause_id != clause_id:
        raise HTTPException(status_code=404, detail="Notiz nicht gefunden")

    await db.delete(note)
    await db.commit()
    return {"message": "Notiz gelöscht"}
