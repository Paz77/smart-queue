from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.logic import organizations
from app.models.organization import OrganizationPublic

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=list[OrganizationPublic])
def list_organizations(session: Session = Depends(get_session)):
    return [OrganizationPublic.model_validate(org) for org in organizations.list_organizations(session)]
