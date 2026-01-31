"""
Team Management API endpoints.

Provides CRUD operations for teams and team membership,
as well as document sharing within teams.
"""

from __future__ import annotations
from typing import Any, Annotated, Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from pydantic import BaseModel

from app.db import get_db
from app.api import deps
from app.models import core as core_models
from app.models import enterprise as models

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    country_code: str = "DE"
    allow_member_invites: bool = False


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    allow_member_invites: Optional[bool] = None


class TeamResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    country_code: str
    is_active: bool
    allow_member_invites: bool
    created_by: str
    created_at: datetime
    member_count: int = 0
    my_role: Optional[str] = None

    class Config:
        from_attributes = True


class TeamMemberResponse(BaseModel):
    id: int
    user_id: str
    role: str
    joined_at: datetime
    invited_by: Optional[str] = None

    class Config:
        from_attributes = True


class AddMemberRequest(BaseModel):
    user_id: str
    role: str = "member"  # owner, admin, member, viewer


class UpdateMemberRoleRequest(BaseModel):
    role: str


class ShareDocumentRequest(BaseModel):
    document_id: Optional[int] = None
    draft_id: Optional[int] = None
    can_view: bool = True
    can_edit: bool = False
    can_download: bool = True
    note: Optional[str] = None


class TeamShareResponse(BaseModel):
    id: int
    document_id: Optional[int]
    draft_id: Optional[int]
    can_view: bool
    can_edit: bool
    can_download: bool
    shared_by: str
    shared_at: datetime
    note: Optional[str] = None

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

async def get_user_role_in_team(db: AsyncSession, team_id: int, user_id: str) -> Optional[str]:
    """Get the user's role in a team, or None if not a member."""
    result = await db.execute(
        select(models.TeamMember.role).where(
            and_(
                models.TeamMember.team_id == team_id,
                models.TeamMember.user_id == user_id,
            )
        )
    )
    row = result.scalar_one_or_none()
    return row


async def check_team_permission(
    db: AsyncSession,
    team_id: int,
    user_id: str,
    required_roles: List[str],
) -> bool:
    """Check if user has one of the required roles in the team."""
    role = await get_user_role_in_team(db, team_id, user_id)
    return role in required_roles


# ═══════════════════════════════════════════════════════════════════════════
# TEAM CRUD
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/", response_model=List[TeamResponse])
async def list_my_teams(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    country_code: Optional[str] = None,
) -> Any:
    """
    List all teams the current user is a member of.
    """
    user_id = str(current_user.id)

    # Get teams where user is a member
    query = (
        select(models.Team, models.TeamMember.role)
        .join(models.TeamMember, models.Team.id == models.TeamMember.team_id)
        .where(models.TeamMember.user_id == user_id)
    )

    if country_code:
        query = query.where(models.Team.country_code == country_code)

    query = query.order_by(models.Team.name)

    result = await db.execute(query)
    rows = result.all()

    teams = []
    for team, role in rows:
        # Get member count
        count_result = await db.execute(
            select(func.count(models.TeamMember.id)).where(
                models.TeamMember.team_id == team.id
            )
        )
        member_count = count_result.scalar() or 0

        teams.append(TeamResponse(
            id=team.id,
            name=team.name,
            description=team.description,
            country_code=team.country_code,
            is_active=team.is_active,
            allow_member_invites=team.allow_member_invites,
            created_by=team.created_by,
            created_at=team.created_at,
            member_count=member_count,
            my_role=role,
        ))

    return teams


@router.post("/", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    team_data: TeamCreate,
) -> Any:
    """
    Create a new team. The creator becomes the owner.
    """
    user_id = str(current_user.id)

    # Create team
    team = models.Team(
        name=team_data.name,
        description=team_data.description,
        country_code=team_data.country_code,
        allow_member_invites=team_data.allow_member_invites,
        created_by=user_id,
    )
    db.add(team)
    await db.flush()

    # Add creator as owner
    membership = models.TeamMember(
        team_id=team.id,
        user_id=user_id,
        role="owner",
    )
    db.add(membership)
    await db.commit()
    await db.refresh(team)

    return TeamResponse(
        id=team.id,
        name=team.name,
        description=team.description,
        country_code=team.country_code,
        is_active=team.is_active,
        allow_member_invites=team.allow_member_invites,
        created_by=team.created_by,
        created_at=team.created_at,
        member_count=1,
        my_role="owner",
    )


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    team_id: int,
) -> Any:
    """
    Get team details. User must be a member.
    """
    user_id = str(current_user.id)

    # Get team with user's role
    result = await db.execute(
        select(models.Team, models.TeamMember.role)
        .join(models.TeamMember, models.Team.id == models.TeamMember.team_id)
        .where(
            and_(
                models.Team.id == team_id,
                models.TeamMember.user_id == user_id,
            )
        )
    )
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team nicht gefunden oder kein Zugriff",
        )

    team, role = row

    # Get member count
    count_result = await db.execute(
        select(func.count(models.TeamMember.id)).where(
            models.TeamMember.team_id == team.id
        )
    )
    member_count = count_result.scalar() or 0

    return TeamResponse(
        id=team.id,
        name=team.name,
        description=team.description,
        country_code=team.country_code,
        is_active=team.is_active,
        allow_member_invites=team.allow_member_invites,
        created_by=team.created_by,
        created_at=team.created_at,
        member_count=member_count,
        my_role=role,
    )


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    team_id: int,
    update_data: TeamUpdate,
) -> Any:
    """
    Update team settings. Requires owner or admin role.
    """
    user_id = str(current_user.id)

    # Check permission
    if not await check_team_permission(db, team_id, user_id, ["owner", "admin"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Keine Berechtigung zum Bearbeiten des Teams",
        )

    # Get team
    result = await db.execute(
        select(models.Team).where(models.Team.id == team_id)
    )
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team nicht gefunden",
        )

    # Update fields
    if update_data.name is not None:
        team.name = update_data.name
    if update_data.description is not None:
        team.description = update_data.description
    if update_data.is_active is not None:
        team.is_active = update_data.is_active
    if update_data.allow_member_invites is not None:
        team.allow_member_invites = update_data.allow_member_invites

    await db.commit()
    await db.refresh(team)

    # Get member count
    count_result = await db.execute(
        select(func.count(models.TeamMember.id)).where(
            models.TeamMember.team_id == team.id
        )
    )
    member_count = count_result.scalar() or 0

    role = await get_user_role_in_team(db, team_id, user_id)

    return TeamResponse(
        id=team.id,
        name=team.name,
        description=team.description,
        country_code=team.country_code,
        is_active=team.is_active,
        allow_member_invites=team.allow_member_invites,
        created_by=team.created_by,
        created_at=team.created_at,
        member_count=member_count,
        my_role=role,
    )


@router.delete("/{team_id}")
async def delete_team(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    team_id: int,
) -> Any:
    """
    Delete a team. Only the owner can delete.
    """
    user_id = str(current_user.id)

    # Check permission - only owner can delete
    if not await check_team_permission(db, team_id, user_id, ["owner"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nur der Team-Eigentümer kann das Team löschen",
        )

    # Delete team (cascade will delete members and shares)
    await db.execute(
        select(models.Team).where(models.Team.id == team_id)
    )
    result = await db.execute(
        select(models.Team).where(models.Team.id == team_id)
    )
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team nicht gefunden",
        )

    await db.delete(team)
    await db.commit()

    return {"message": "Team erfolgreich gelöscht", "id": team_id}


# ═══════════════════════════════════════════════════════════════════════════
# TEAM MEMBERS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/{team_id}/members", response_model=List[TeamMemberResponse])
async def list_team_members(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    team_id: int,
) -> Any:
    """
    List all members of a team. User must be a member.
    """
    user_id = str(current_user.id)

    # Check access
    role = await get_user_role_in_team(db, team_id, user_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kein Zugriff auf dieses Team",
        )

    # Get members
    result = await db.execute(
        select(models.TeamMember)
        .where(models.TeamMember.team_id == team_id)
        .order_by(models.TeamMember.joined_at)
    )
    members = result.scalars().all()

    return [
        TeamMemberResponse(
            id=m.id,
            user_id=m.user_id,
            role=m.role,
            joined_at=m.joined_at,
            invited_by=m.invited_by,
        )
        for m in members
    ]


@router.post("/{team_id}/members", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_team_member(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    team_id: int,
    member_data: AddMemberRequest,
) -> Any:
    """
    Add a member to the team. Requires owner/admin role, or member role if allow_member_invites.
    """
    user_id = str(current_user.id)

    # Get team and check permission
    result = await db.execute(
        select(models.Team).where(models.Team.id == team_id)
    )
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team nicht gefunden",
        )

    my_role = await get_user_role_in_team(db, team_id, user_id)

    # Check if user can invite
    can_invite = (
        my_role in ["owner", "admin"] or
        (my_role == "member" and team.allow_member_invites)
    )

    if not can_invite:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Keine Berechtigung zum Hinzufügen von Mitgliedern",
        )

    # Check if new member role is valid
    valid_roles = ["member", "viewer"]
    if my_role in ["owner", "admin"]:
        valid_roles.extend(["admin"])

    if member_data.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ungültige Rolle: {member_data.role}",
        )

    # Check if user is already a member
    existing = await db.execute(
        select(models.TeamMember).where(
            and_(
                models.TeamMember.team_id == team_id,
                models.TeamMember.user_id == member_data.user_id,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Benutzer ist bereits Mitglied",
        )

    # Add member
    membership = models.TeamMember(
        team_id=team_id,
        user_id=member_data.user_id,
        role=member_data.role,
        invited_by=user_id,
    )
    db.add(membership)
    await db.commit()
    await db.refresh(membership)

    return TeamMemberResponse(
        id=membership.id,
        user_id=membership.user_id,
        role=membership.role,
        joined_at=membership.joined_at,
        invited_by=membership.invited_by,
    )


@router.put("/{team_id}/members/{member_user_id}", response_model=TeamMemberResponse)
async def update_member_role(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    team_id: int,
    member_user_id: str,
    role_data: UpdateMemberRoleRequest,
) -> Any:
    """
    Update a member's role. Requires owner or admin role.
    """
    user_id = str(current_user.id)

    # Check permission
    my_role = await get_user_role_in_team(db, team_id, user_id)
    if my_role not in ["owner", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Keine Berechtigung zum Ändern von Rollen",
        )

    # Get member
    result = await db.execute(
        select(models.TeamMember).where(
            and_(
                models.TeamMember.team_id == team_id,
                models.TeamMember.user_id == member_user_id,
            )
        )
    )
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mitglied nicht gefunden",
        )

    # Can't change owner's role (only transfer ownership)
    if member.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Eigentümer-Rolle kann nicht geändert werden",
        )

    # Admin can only assign member/viewer roles
    valid_roles = ["member", "viewer"]
    if my_role == "owner":
        valid_roles.append("admin")

    if role_data.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ungültige Rolle: {role_data.role}",
        )

    member.role = role_data.role
    await db.commit()
    await db.refresh(member)

    return TeamMemberResponse(
        id=member.id,
        user_id=member.user_id,
        role=member.role,
        joined_at=member.joined_at,
        invited_by=member.invited_by,
    )


@router.delete("/{team_id}/members/{member_user_id}")
async def remove_team_member(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    team_id: int,
    member_user_id: str,
) -> Any:
    """
    Remove a member from the team. Owner/admin can remove others, members can remove themselves.
    Use "me" as member_user_id to remove the current user (leave team).
    """
    user_id = str(current_user.id)

    # Handle "me" as special identifier for current user
    target_user_id = user_id if member_user_id == "me" else member_user_id

    my_role = await get_user_role_in_team(db, team_id, user_id)
    if not my_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kein Zugriff auf dieses Team",
        )

    # Get member to remove
    result = await db.execute(
        select(models.TeamMember).where(
            and_(
                models.TeamMember.team_id == team_id,
                models.TeamMember.user_id == target_user_id,
            )
        )
    )
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mitglied nicht gefunden",
        )

    # Check permission
    is_removing_self = target_user_id == user_id
    can_remove = is_removing_self or my_role in ["owner", "admin"]

    if not can_remove:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Keine Berechtigung zum Entfernen dieses Mitglieds",
        )

    # Owner can't leave without transferring ownership
    if member.role == "owner" and is_removing_self:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Eigentümer muss Eigentum übertragen bevor er das Team verlässt",
        )

    await db.delete(member)
    await db.commit()

    return {"message": "Mitglied erfolgreich entfernt"}


# ═══════════════════════════════════════════════════════════════════════════
# TEAM DOCUMENT SHARING
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/{team_id}/shares", response_model=List[TeamShareResponse])
async def list_team_shares(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    team_id: int,
) -> Any:
    """
    List all documents/drafts shared with the team.
    """
    user_id = str(current_user.id)

    # Check access
    role = await get_user_role_in_team(db, team_id, user_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kein Zugriff auf dieses Team",
        )

    # Get shares
    result = await db.execute(
        select(models.TeamDocumentShare)
        .where(models.TeamDocumentShare.team_id == team_id)
        .order_by(models.TeamDocumentShare.shared_at.desc())
    )
    shares = result.scalars().all()

    return [
        TeamShareResponse(
            id=s.id,
            document_id=s.document_id,
            draft_id=s.draft_id,
            can_view=s.can_view,
            can_edit=s.can_edit,
            can_download=s.can_download,
            shared_by=s.shared_by,
            shared_at=s.shared_at,
            note=s.note,
        )
        for s in shares
    ]


@router.post("/{team_id}/shares", response_model=TeamShareResponse, status_code=status.HTTP_201_CREATED)
async def share_document_with_team(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    team_id: int,
    share_data: ShareDocumentRequest,
) -> Any:
    """
    Share a document or draft with the team.
    """
    user_id = str(current_user.id)

    # Check access - need to be member to share
    role = await get_user_role_in_team(db, team_id, user_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kein Zugriff auf dieses Team",
        )

    # Viewers can't share
    if role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewer können keine Dokumente teilen",
        )

    # Must provide either document_id or draft_id
    if not share_data.document_id and not share_data.draft_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="document_id oder draft_id erforderlich",
        )

    if share_data.document_id and share_data.draft_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nur document_id ODER draft_id angeben",
        )

    # Check if already shared
    existing_query = select(models.TeamDocumentShare).where(
        models.TeamDocumentShare.team_id == team_id
    )
    if share_data.document_id:
        existing_query = existing_query.where(
            models.TeamDocumentShare.document_id == share_data.document_id
        )
    else:
        existing_query = existing_query.where(
            models.TeamDocumentShare.draft_id == share_data.draft_id
        )

    existing = await db.execute(existing_query)
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dokument ist bereits mit dem Team geteilt",
        )

    # Create share
    share = models.TeamDocumentShare(
        team_id=team_id,
        document_id=share_data.document_id,
        draft_id=share_data.draft_id,
        can_view=share_data.can_view,
        can_edit=share_data.can_edit,
        can_download=share_data.can_download,
        shared_by=user_id,
        note=share_data.note,
    )
    db.add(share)
    await db.commit()
    await db.refresh(share)

    return TeamShareResponse(
        id=share.id,
        document_id=share.document_id,
        draft_id=share.draft_id,
        can_view=share.can_view,
        can_edit=share.can_edit,
        can_download=share.can_download,
        shared_by=share.shared_by,
        shared_at=share.shared_at,
        note=share.note,
    )


@router.delete("/{team_id}/shares/{share_id}")
async def unshare_document(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    team_id: int,
    share_id: int,
) -> Any:
    """
    Remove a document share from the team.
    """
    user_id = str(current_user.id)

    # Get share
    result = await db.execute(
        select(models.TeamDocumentShare).where(
            and_(
                models.TeamDocumentShare.id == share_id,
                models.TeamDocumentShare.team_id == team_id,
            )
        )
    )
    share = result.scalar_one_or_none()

    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Freigabe nicht gefunden",
        )

    # Check permission - owner/admin or the person who shared
    my_role = await get_user_role_in_team(db, team_id, user_id)
    can_remove = my_role in ["owner", "admin"] or share.shared_by == user_id

    if not can_remove:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Keine Berechtigung zum Entfernen der Freigabe",
        )

    await db.delete(share)
    await db.commit()

    return {"message": "Freigabe erfolgreich entfernt"}
