"""
Unified Document Composer API

Smart UX Konzept Endpoints:
- Klausel-Instanzen verwalten (CRUD)
- Bibliothek durchsuchen
- Deviation-Flow (Phase 2)
- Promotion-Flow (Phase 3)

Implementiert gemäß SMART_UX_IMPLEMENTATION_PLAN.md
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, timezone
import json
import re

from app.db import get_db
from app.api.deps import get_current_user
from app.models.composer import DocumentClauseInstance, ClauseOrigin
from app.models.enterprise import DocumentDraft
from app.models.documents import Clause, DocumentType, DocumentTypeClause, ClauseVariantGroup, ClauseVariant, DocumentTypeVariantGroup
from app.schemas.composer import (
    ClauseInstanceCreate,
    ClauseInstanceUpdate,
    ClauseInstanceResponse,
    ClauseInstanceListResponse,
    ReorderRequest,
    DeviateRequest,
    DeviateResponse,
    PromoteRequest,
    PromoteResponse,
    LibraryClauseResponse,
    LibrarySearchResponse,
    ComposerDraftCreate,
    ComposerDraftResponse,
    FormDataUpdate,
    ClauseOriginEnum,
)

router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def strip_html_tags(html: str, max_length: int = 150) -> str:
    """Entfernt HTML-Tags und kürzt auf max_length."""
    if not html:
        return ""
    clean = re.sub(r'<[^>]+>', '', html)
    clean = re.sub(r'\s+', ' ', clean).strip()
    if len(clean) > max_length:
        return clean[:max_length] + "..."
    return clean


async def get_draft_for_user(
    db: AsyncSession,
    draft_id: int,
    user_id: str
) -> DocumentDraft:
    """Lädt einen Draft und prüft Ownership."""
    draft = await db.get(DocumentDraft, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft nicht gefunden")
    if draft.user_id != user_id:
        raise HTTPException(status_code=403, detail="Zugriff verweigert")
    return draft


async def get_clause_instance(
    db: AsyncSession,
    draft_id: int,
    instance_id: int,
    user_id: str
) -> DocumentClauseInstance:
    """Lädt eine Klausel-Instanz und prüft Ownership."""
    # Erst Draft-Ownership prüfen
    await get_draft_for_user(db, draft_id, user_id)

    instance = await db.get(DocumentClauseInstance, instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Klausel-Instanz nicht gefunden")
    if instance.document_draft_id != draft_id:
        raise HTTPException(status_code=403, detail="Klausel gehört nicht zu diesem Draft")
    return instance


# ══════════════════════════════════════════════════════════════════════════════
# DRAFT MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/drafts", response_model=ComposerDraftResponse, tags=["composer"])
async def create_composer_draft(
    draft_data: ComposerDraftCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Erstellt einen neuen Composer-Draft.

    Der Draft wird mit den Standard-Klauseln des DocumentTypes initialisiert.
    Alle Standard-Klauseln werden als 'global' hinzugefügt.
    """
    # DocumentType laden
    doc_type = await db.get(DocumentType, draft_data.document_type_id)
    if not doc_type:
        raise HTTPException(status_code=404, detail="Dokumenttyp nicht gefunden")

    # Draft erstellen
    draft = DocumentDraft(
        document_type_id=draft_data.document_type_id,
        country_code=draft_data.country_code,
        user_id=str(current_user.id),
        name=draft_data.name,
        form_data=json.dumps(draft_data.form_data) if draft_data.form_data else "{}"
    )
    db.add(draft)
    await db.flush()  # ID generieren

    # Standard-Klauseln des DocumentTypes als globale Instanzen hinzufügen
    result = await db.execute(
        select(DocumentTypeClause)
        .where(DocumentTypeClause.document_type_id == draft_data.document_type_id)
        .order_by(DocumentTypeClause.display_order)
    )
    doc_type_clauses = result.scalars().all()

    display_order_counter = 0

    for dtc in doc_type_clauses:
        # Klausel laden für Titel
        clause = await db.get(Clause, dtc.clause_id)
        if not clause or not clause.is_active:
            continue

        instance = DocumentClauseInstance(
            document_draft_id=draft.id,
            clause_origin=ClauseOrigin.GLOBAL.value,
            source_clause_id=dtc.clause_id,
            source_clause_version=clause.version,
            title=clause.title,
            content_html=None,  # Bei global: Content aus Clause laden
            display_order=display_order_counter,
            condition_json=dtc.condition,
            is_condition_met=True  # Initial immer true, wird bei Preview evaluiert
        )
        db.add(instance)
        display_order_counter += 1

    # ══════════════════════════════════════════════════════════════════════════
    # Varianten-Gruppen hinzufügen (v4.2 Feature)
    # ══════════════════════════════════════════════════════════════════════════
    # Lade zugeordnete Varianten-Gruppen für diesen Dokumenttyp
    vg_result = await db.execute(
        select(DocumentTypeVariantGroup)
        .where(DocumentTypeVariantGroup.document_type_id == draft_data.document_type_id)
        .order_by(DocumentTypeVariantGroup.display_order)
    )
    doc_type_variant_groups = vg_result.scalars().all()

    # Map der ausgewählten Varianten (variant_group_id -> variant_id)
    selected_variants_map = {}
    if draft_data.selected_variants:
        for sv in draft_data.selected_variants:
            selected_variants_map[sv.variant_group_id] = sv.variant_id

    for dtvg in doc_type_variant_groups:
        # Bestimme die zu verwendende Variante
        variant_id = selected_variants_map.get(
            dtvg.variant_group_id,
            dtvg.default_variant_id  # Fallback auf Dokumenttyp-Default
        )

        # Lade die Variante
        variant = None
        if variant_id:
            variant = await db.get(ClauseVariant, variant_id)

        # Wenn keine Variante ausgewählt, lade die Standard-Variante der Gruppe
        if not variant:
            vg_variants_result = await db.execute(
                select(ClauseVariant)
                .where(
                    ClauseVariant.group_id == dtvg.variant_group_id,
                    ClauseVariant.is_active == True
                )
                .order_by(ClauseVariant.is_default.desc(), ClauseVariant.sort_order)
            )
            vg_variants = vg_variants_result.scalars().all()
            if vg_variants:
                variant = vg_variants[0]  # Nehme Standard oder erste Variante

        if not variant:
            continue  # Keine Variante gefunden, überspringen

        # Lade die zugehörige Klausel
        variant_clause = await db.get(Clause, variant.clause_id)
        if not variant_clause or not variant_clause.is_active:
            continue

        # Lade Varianten-Gruppe für den Namen
        variant_group = await db.get(ClauseVariantGroup, dtvg.variant_group_id)

        # Erstelle Klausel-Instanz vom Typ VARIANT
        instance = DocumentClauseInstance(
            document_draft_id=draft.id,
            clause_origin=ClauseOrigin.VARIANT.value if hasattr(ClauseOrigin, 'VARIANT') else ClauseOrigin.GLOBAL.value,
            source_clause_id=variant.clause_id,
            source_clause_version=variant_clause.version,
            title=f"{variant_group.name if variant_group else 'Variante'}: {variant.variant_name}",
            content_html=None,  # Content aus Clause laden
            display_order=display_order_counter,
            variant_group_id=dtvg.variant_group_id,
            selected_variant_id=variant.id,
            is_condition_met=True
        )
        db.add(instance)
        display_order_counter += 1

    await db.commit()
    await db.refresh(draft)

    # Response bauen
    clause_stats = await _get_clause_stats(db, draft.id)

    return ComposerDraftResponse(
        id=draft.id,
        document_type_id=draft.document_type_id,
        document_type_name=doc_type.name,
        country_code=draft.country_code,
        name=draft.name,
        form_data=json.loads(draft.form_data) if draft.form_data else None,
        clause_count=clause_stats["total"],
        global_clause_count=clause_stats["global"],
        local_clause_count=clause_stats["local"],
        deviation_count=clause_stats["deviation"],
        created_at=draft.created_at,
        updated_at=draft.updated_at
    )


@router.get("/drafts/{draft_id}", response_model=ComposerDraftResponse, tags=["composer"])
async def get_composer_draft(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Lädt einen Composer-Draft mit Statistiken."""
    draft = await get_draft_for_user(db, draft_id, str(current_user.id))

    doc_type = await db.get(DocumentType, draft.document_type_id)
    clause_stats = await _get_clause_stats(db, draft.id)

    return ComposerDraftResponse(
        id=draft.id,
        document_type_id=draft.document_type_id,
        document_type_name=doc_type.name if doc_type else "Unbekannt",
        country_code=draft.country_code,
        name=draft.name,
        form_data=json.loads(draft.form_data) if draft.form_data else None,
        clause_count=clause_stats["total"],
        global_clause_count=clause_stats["global"],
        local_clause_count=clause_stats["local"],
        deviation_count=clause_stats["deviation"],
        created_at=draft.created_at,
        updated_at=draft.updated_at
    )


@router.put("/drafts/{draft_id}/form-data", tags=["composer"])
async def update_draft_form_data(
    draft_id: int,
    update: FormDataUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Aktualisiert die Formulardaten eines Drafts (Auto-Save)."""
    draft = await get_draft_for_user(db, draft_id, str(current_user.id))
    draft.form_data = json.dumps(update.form_data)
    await db.commit()
    return {"status": "updated", "updated_at": draft.updated_at}


async def _get_clause_stats(db: AsyncSession, draft_id: int) -> dict:
    """Zählt Klauseln nach Origin."""
    result = await db.execute(
        select(
            DocumentClauseInstance.clause_origin,
            func.count(DocumentClauseInstance.id)
        )
        .where(DocumentClauseInstance.document_draft_id == draft_id)
        .group_by(DocumentClauseInstance.clause_origin)
    )
    counts = {row[0]: row[1] for row in result.all()}
    return {
        "total": sum(counts.values()),
        "global": counts.get(ClauseOrigin.GLOBAL.value, 0),
        "local": counts.get(ClauseOrigin.LOCAL.value, 0),
        "deviation": counts.get(ClauseOrigin.DEVIATION.value, 0),
    }


# ══════════════════════════════════════════════════════════════════════════════
# CLAUSE INSTANCE MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/drafts/{draft_id}/clauses", response_model=ClauseInstanceListResponse, tags=["composer"])
async def get_draft_clauses(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Lädt alle Klausel-Instanzen eines Drafts.

    Bei globalen Klauseln wird der Content aus der Clause-Tabelle geladen.
    """
    draft = await get_draft_for_user(db, draft_id, str(current_user.id))

    result = await db.execute(
        select(DocumentClauseInstance)
        .where(DocumentClauseInstance.document_draft_id == draft_id)
        .order_by(DocumentClauseInstance.display_order)
    )
    instances = result.scalars().all()

    # Content für globale Klauseln laden
    clauses_response = []
    for inst in instances:
        content_html = inst.content_html

        # Bei global: Content aus Clause-Tabelle
        if inst.clause_origin == ClauseOrigin.GLOBAL.value and inst.source_clause_id:
            clause = await db.get(Clause, inst.source_clause_id)
            if clause:
                content_html = clause.content_html

        clauses_response.append(ClauseInstanceResponse(
            id=inst.id,
            origin=ClauseOriginEnum(inst.clause_origin),
            source_clause_id=inst.source_clause_id,
            source_clause_version=inst.source_clause_version,
            title=inst.title,
            content_html=content_html,
            display_order=inst.display_order,
            is_editable=inst.is_editable,
            visual_style=inst.visual_style,
            variant_group_id=inst.variant_group_id,
            selected_variant_id=inst.selected_variant_id,
            is_condition_met=inst.is_condition_met,
            deviated_at=inst.deviated_at,
            deviated_by_user_id=inst.deviated_by_user_id,
            deviated_reason=inst.deviated_reason,
            original_content_snapshot=inst.original_content_snapshot,
            promoted_to_clause_id=inst.promoted_to_clause_id,
            promoted_at=inst.promoted_at,
            created_at=inst.created_at,
            updated_at=inst.updated_at
        ))

    return ClauseInstanceListResponse(
        clauses=clauses_response,
        total=len(clauses_response),
        draft_id=draft_id
    )


@router.post("/drafts/{draft_id}/clauses", response_model=ClauseInstanceResponse, tags=["composer"])
async def add_clause_to_draft(
    draft_id: int,
    clause_data: ClauseInstanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Fügt eine Klausel zum Draft hinzu.

    Zwei Modi:
    1. source_clause_id gegeben → Globale Klausel aus Bibliothek referenzieren
    2. content_html gegeben → Lokale Klausel erstellen
    """
    draft = await get_draft_for_user(db, draft_id, str(current_user.id))

    # Position bestimmen
    if clause_data.position is not None:
        position = clause_data.position
        # Bestehende Klauseln nach hinten verschieben
        await db.execute(
            DocumentClauseInstance.__table__.update()
            .where(and_(
                DocumentClauseInstance.document_draft_id == draft_id,
                DocumentClauseInstance.display_order >= position
            ))
            .values(display_order=DocumentClauseInstance.display_order + 1)
        )
    else:
        # Ans Ende
        result = await db.execute(
            select(func.max(DocumentClauseInstance.display_order))
            .where(DocumentClauseInstance.document_draft_id == draft_id)
        )
        max_order = result.scalar() or -1
        position = max_order + 1

    # Global oder Local?
    if clause_data.source_clause_id:
        # Globale Klausel
        clause = await db.get(Clause, clause_data.source_clause_id)
        if not clause:
            raise HTTPException(status_code=404, detail="Klausel nicht in Bibliothek gefunden")

        instance = DocumentClauseInstance(
            document_draft_id=draft_id,
            clause_origin=ClauseOrigin.GLOBAL.value,
            source_clause_id=clause.id,
            source_clause_version=clause.version,
            title=clause.title,
            content_html=None,
            display_order=position
        )
        content_html = clause.content_html
    else:
        # Lokale Klausel
        instance = DocumentClauseInstance(
            document_draft_id=draft_id,
            clause_origin=ClauseOrigin.LOCAL.value,
            source_clause_id=None,
            title=clause_data.title,
            content_html=clause_data.content_html or "",
            display_order=position
        )
        content_html = instance.content_html

    db.add(instance)
    await db.commit()
    await db.refresh(instance)

    return ClauseInstanceResponse(
        id=instance.id,
        origin=ClauseOriginEnum(instance.clause_origin),
        source_clause_id=instance.source_clause_id,
        source_clause_version=instance.source_clause_version,
        title=instance.title,
        content_html=content_html,
        display_order=instance.display_order,
        is_editable=instance.is_editable,
        visual_style=instance.visual_style,
        created_at=instance.created_at,
        updated_at=instance.updated_at
    )


@router.put("/drafts/{draft_id}/clauses/{instance_id}", response_model=ClauseInstanceResponse, tags=["composer"])
async def update_clause_instance(
    draft_id: int,
    instance_id: int,
    update: ClauseInstanceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Aktualisiert eine Klausel-Instanz.

    WICHTIG: Nur für local/deviation erlaubt!
    Globale Klauseln müssen erst "aufgebrochen" werden (deviate).
    """
    instance = await get_clause_instance(db, draft_id, instance_id, str(current_user.id))

    if instance.clause_origin == ClauseOrigin.GLOBAL.value:
        raise HTTPException(
            status_code=400,
            detail="Globale Klauseln können nicht direkt bearbeitet werden. "
                   "Verwenden Sie den 'deviate'-Endpoint, um die Klausel aufzubrechen."
        )

    if update.title is not None:
        instance.title = update.title
    if update.content_html is not None:
        instance.content_html = update.content_html

    await db.commit()
    await db.refresh(instance)

    return ClauseInstanceResponse(
        id=instance.id,
        origin=ClauseOriginEnum(instance.clause_origin),
        source_clause_id=instance.source_clause_id,
        source_clause_version=instance.source_clause_version,
        title=instance.title,
        content_html=instance.content_html,
        display_order=instance.display_order,
        is_editable=instance.is_editable,
        visual_style=instance.visual_style,
        deviated_at=instance.deviated_at,
        deviated_reason=instance.deviated_reason,
        created_at=instance.created_at,
        updated_at=instance.updated_at
    )


@router.delete("/drafts/{draft_id}/clauses/{instance_id}", tags=["composer"])
async def remove_clause_from_draft(
    draft_id: int,
    instance_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Entfernt eine Klausel-Instanz vom Draft."""
    instance = await get_clause_instance(db, draft_id, instance_id, str(current_user.id))

    deleted_order = instance.display_order
    await db.delete(instance)

    # Reihenfolge anpassen
    await db.execute(
        DocumentClauseInstance.__table__.update()
        .where(and_(
            DocumentClauseInstance.document_draft_id == draft_id,
            DocumentClauseInstance.display_order > deleted_order
        ))
        .values(display_order=DocumentClauseInstance.display_order - 1)
    )

    await db.commit()
    return {"status": "deleted", "instance_id": instance_id}


@router.patch("/drafts/{draft_id}/clauses/reorder", tags=["composer"])
async def reorder_draft_clauses(
    draft_id: int,
    request: ReorderRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Ändert die Reihenfolge der Klauseln.

    Input: Liste von {instance_id, position}
    """
    await get_draft_for_user(db, draft_id, str(current_user.id))

    for item in request.new_order:
        await db.execute(
            DocumentClauseInstance.__table__.update()
            .where(and_(
                DocumentClauseInstance.document_draft_id == draft_id,
                DocumentClauseInstance.id == item.instance_id
            ))
            .values(display_order=item.position)
        )

    await db.commit()
    return {"status": "reordered", "items": len(request.new_order)}


# ══════════════════════════════════════════════════════════════════════════════
# DEVIATION FLOW (Phase 2)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/drafts/{draft_id}/clauses/{instance_id}/deviate", response_model=DeviateResponse, tags=["composer"])
async def deviate_clause(
    draft_id: int,
    instance_id: int,
    request: DeviateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    "Schloss öffnen" - Wandelt Global → Deviation um.

    1. Prüft dass instance.origin == "global"
    2. Kopiert content_html von source_clause
    3. Setzt origin = "deviation"
    4. Setzt deviated_at, deviated_by_user_id

    Ab jetzt ist die Klausel editierbar.
    """
    instance = await get_clause_instance(db, draft_id, instance_id, str(current_user.id))

    if instance.clause_origin != ClauseOrigin.GLOBAL.value:
        raise HTTPException(
            status_code=400,
            detail="Nur globale Klauseln können aufgebrochen werden"
        )

    if not instance.source_clause_id:
        raise HTTPException(
            status_code=400,
            detail="Keine Quell-Klausel verknüpft"
        )

    # Original-Klausel laden
    source_clause = await db.get(Clause, instance.source_clause_id)
    if not source_clause:
        raise HTTPException(status_code=404, detail="Quell-Klausel nicht gefunden")

    # Content kopieren
    instance.content_html = source_clause.content_html
    instance.original_content_snapshot = source_clause.content_html

    # Origin ändern
    instance.clause_origin = ClauseOrigin.DEVIATION.value
    instance.deviated_at = datetime.now(timezone.utc)
    instance.deviated_by_user_id = current_user.id
    instance.deviated_reason = request.reason

    await db.commit()
    await db.refresh(instance)

    return DeviateResponse(
        id=instance.id,
        origin=ClauseOriginEnum.DEVIATION,
        content_html=instance.content_html,
        deviated_at=instance.deviated_at,
        message="Klausel wurde aufgebrochen und kann jetzt bearbeitet werden"
    )


# ══════════════════════════════════════════════════════════════════════════════
# PROMOTION FLOW (Phase 3)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/drafts/{draft_id}/clauses/{instance_id}/promote", response_model=PromoteResponse, tags=["composer"])
async def promote_to_library(
    draft_id: int,
    instance_id: int,
    request: PromoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    "In Bibliothek aufnehmen" - Erstellt neue globale Klausel.

    1. Prüft dass instance.origin == "local" oder "deviation"
    2. Erstellt neue Clause in clauses-Tabelle (Status: pending)
    3. Setzt instance.promoted_to_clause_id
    4. Optional: Wandelt instance zu "global" um

    Erfordert Approval-Workflow.
    """
    instance = await get_clause_instance(db, draft_id, instance_id, str(current_user.id))

    if instance.clause_origin == ClauseOrigin.GLOBAL.value:
        raise HTTPException(
            status_code=400,
            detail="Globale Klauseln können nicht erneut promotet werden"
        )

    if not instance.content_html:
        raise HTTPException(
            status_code=400,
            detail="Klausel hat keinen Inhalt"
        )

    # Neue globale Klausel erstellen (Status: pending)
    new_clause = Clause(
        title=request.title,
        content_html=instance.content_html,
        country_code=request.country_code,
        category=request.category,
        version=1,
        is_active=False,  # Noch nicht aktiv
        approval_status="pending",
        approval_requested_at=datetime.now(timezone.utc),
        approval_requested_by=current_user.email
    )
    db.add(new_clause)
    await db.flush()

    # Instance aktualisieren
    instance.promoted_to_clause_id = new_clause.id
    instance.promoted_at = datetime.now(timezone.utc)
    instance.promoted_by_user_id = current_user.id

    # Optional: zu global umwandeln
    if request.convert_to_global:
        instance.clause_origin = ClauseOrigin.GLOBAL.value
        instance.source_clause_id = new_clause.id
        instance.source_clause_version = 1
        instance.content_html = None

    await db.commit()

    # Benachrichtige Admins über ausstehende Freigabe
    try:
        from app.api.v1.endpoints.user.notifications import notify_admins_clause_pending
        await notify_admins_clause_pending(
            db=db,
            clause_id=new_clause.id,
            clause_title=request.title,
            submitted_by=getattr(current_user, 'full_name', current_user.email),
        )
    except Exception:
        pass  # Notification-Fehler sollten nicht den Hauptflow blockieren

    return PromoteResponse(
        status="submitted",
        new_clause_id=new_clause.id,
        approval_required=True,
        message="Klausel wurde zur Prüfung eingereicht. Nach Freigabe steht sie in der Bibliothek bereit."
    )


# ══════════════════════════════════════════════════════════════════════════════
# LIBRARY SEARCH
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/library", response_model=LibrarySearchResponse, tags=["composer"])
async def search_library(
    country_code: str = Query(default="DE", pattern="^(DE|IT)$"),
    category: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Durchsucht die Klausel-Bibliothek für Drag & Drop.

    Gibt nur aktive und freigegebene Klauseln zurück.
    """
    # Base Query (Tenant-isoliert: nur eigene + globale Klauseln)
    query = select(Clause).where(
        and_(
            Clause.is_active == True,
            or_(
                Clause.country_code == country_code,
                Clause.country_code == None  # Länderübergreifende Klauseln
            ),
            Clause.approval_status.in_(["active", "approved"]),
            or_(
                Clause.user_id == current_user.id,
                Clause.user_id == None,
            ),
        )
    )

    # Filter: Kategorie
    if category:
        query = query.where(Clause.category == category)

    # Filter: Suche
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                Clause.title.ilike(search_pattern),
                Clause.content_html.ilike(search_pattern)
            )
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Pagination
    query = query.order_by(Clause.category, Clause.title)
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    clauses = result.scalars().all()

    # Response bauen
    clauses_response = []
    for clause in clauses:
        # Prüfen ob Varianten existieren (vereinfacht)
        has_variants = False  # TODO: ClauseVariantGroup abfragen
        variant_count = 0

        clauses_response.append(LibraryClauseResponse(
            id=clause.id,
            title=clause.title,
            category=clause.category,
            preview=strip_html_tags(clause.content_html, 150),
            version=clause.version,
            is_approved=clause.approval_status in ["active", "approved"],
            has_variants=has_variants,
            variant_count=variant_count
        ))

    return LibrarySearchResponse(
        clauses=clauses_response,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/library/categories", tags=["composer"])
async def get_library_categories(
    country_code: str = Query(default="DE", pattern="^(DE|IT)$"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Gibt alle verfügbaren Kategorien in der Bibliothek zurück (Tenant-isoliert)."""
    result = await db.execute(
        select(Clause.category, func.count(Clause.id))
        .where(
            and_(
                Clause.is_active == True,
                or_(
                    Clause.country_code == country_code,
                    Clause.country_code == None
                ),
                Clause.category != None,
                or_(
                    Clause.user_id == current_user.id,
                    Clause.user_id == None,
                ),
            )
        )
        .group_by(Clause.category)
        .order_by(Clause.category)
    )

    categories = [
        {"name": row[0], "count": row[1]}
        for row in result.all()
    ]

    return {"categories": categories}
