from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.deps import current_user, require_admin
from app.logic import services
from app.models import User
from app.models.service import ServiceCreate, ServicePublic, ServiceUpdate

router = APIRouter(tags=["services"])


@router.get("/organizations/{organization_id}/services", response_model=list[ServicePublic])
def list_services(
    organization_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    return [services.to_public(session, service) for service in services.list_services(session, organization_id)]


@router.post("/organizations/{organization_id}/services", status_code=201, response_model=ServicePublic)
def create_service(
    organization_id: str,
    body: ServiceCreate,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    service = services.create_service(session, organization_id, body)
    session.commit()
    return services.to_public(session, service)


@router.patch("/services/{service_id}", response_model=ServicePublic)
def update_service(
    service_id: str,
    body: ServiceUpdate,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    service = services.get_service(session, service_id)
    require_admin(service.organization_id, user)
    services.update_service(session, service, body)
    session.commit()
    return services.to_public(session, service)
