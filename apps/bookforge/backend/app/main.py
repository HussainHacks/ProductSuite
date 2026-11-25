import os
from contextlib import asynccontextmanager
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.models import (
    Appointment,
    BookingNotification,
    BookingService,
    StaffMember,
    WorkingHours,
)
from app.schemas import (
    AppointmentCreate,
    AppointmentOut,
    AppointmentReschedule,
    NotificationOut,
    ServiceCreate,
    ServiceOut,
    SlotOut,
    StaffCreate,
    StaffOut,
    WorkingHoursEntry,
)
from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from productsuite_auth import Organization, SlidingWindowRateLimiter, User, create_auth_dependencies
from productsuite_database import build_engine, build_session_factory, init_db
from productsuite_shared import register_error_handlers
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

_public_booking_limiter = SlidingWindowRateLimiter(max_requests=30, window_seconds=60)


def _validate_tz(tz_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name)
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid IANA timezone: '{tz_name}'.",
        ) from exc


def _parse_hhmm(hhmm: str) -> time:
    h, m = map(int, hhmm.split(":"))
    return time(hour=h, minute=m)


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _check_slot_available(
    db: Session,
    *,
    staff: StaffMember,
    service: BookingService,
    start_utc: datetime,
    exclude_appointment_id: int | None = None,
) -> datetime:
    start_utc = _ensure_utc(start_utc)
    end_utc = start_utc + timedelta(minutes=service.duration_minutes)

    # Check staff working hours in staff's explicit timezone (handles DST)
    staff_tz = _validate_tz(staff.timezone)
    local_start = start_utc.astimezone(staff_tz)
    local_end = end_utc.astimezone(staff_tz)
    if local_start.date() != local_end.date():
        raise HTTPException(
            status_code=409, detail="Appointment cannot span across midnight in staff timezone."
        )

    day_hours = [wh for wh in staff.working_hours if wh.day_of_week == local_start.weekday()]
    within_hours = False
    for wh in day_hours:
        wh_start = datetime.combine(local_start.date(), _parse_hhmm(wh.start_time), tzinfo=staff_tz)
        wh_end = datetime.combine(local_start.date(), _parse_hhmm(wh.end_time), tzinfo=staff_tz)
        if local_start >= wh_start and local_end <= wh_end:
            within_hours = True
            break

    if not within_hours:
        raise HTTPException(
            status_code=409,
            detail="Requested time is outside the staff member's configured working hours.",
        )

    # Check overlap including service buffers against confirmed appointments
    req_window_start = start_utc - timedelta(minutes=service.buffer_before_minutes)
    req_window_end = end_utc + timedelta(minutes=service.buffer_after_minutes)

    existing_stmt = select(Appointment).where(
        Appointment.staff_id == staff.id,
        Appointment.status == "confirmed",
    )
    if exclude_appointment_id is not None:
        existing_stmt = existing_stmt.where(Appointment.id != exclude_appointment_id)

    for appt in db.scalars(existing_stmt).all():
        appt_svc = db.get(BookingService, appt.service_id)
        buf_before = appt_svc.buffer_before_minutes if appt_svc else 0
        buf_after = appt_svc.buffer_after_minutes if appt_svc else 0
        appt_start = _ensure_utc(appt.start_utc) - timedelta(minutes=buf_before)
        appt_end = _ensure_utc(appt.end_utc) + timedelta(minutes=buf_after)
        if req_window_start < appt_end and req_window_end > appt_start:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This time slot overlaps with an existing appointment or buffer.",
            )

    return end_utc


def _create_notification(
    db: Session, *, org_id: int, appointment: Appointment, event_type: str, message: str
) -> None:
    db.add(
        BookingNotification(
            organization_id=org_id,
            appointment_id=appointment.id,
            recipient_email=appointment.customer_email,
            event_type=event_type,
            message=message,
        )
    )


def _to_appointment_out(db: Session, appt: Appointment) -> AppointmentOut:
    svc = db.get(BookingService, appt.service_id)
    staff = db.get(StaffMember, appt.staff_id)
    return AppointmentOut(
        id=appt.id,
        service_id=appt.service_id,
        service_name=svc.name if svc else "",
        staff_id=appt.staff_id,
        staff_name=staff.name if staff else "",
        customer_name=appt.customer_name,
        customer_email=appt.customer_email,
        customer_timezone=appt.customer_timezone,
        start_utc=_ensure_utc(appt.start_utc),
        end_utc=_ensure_utc(appt.end_utc),
        status=appt.status,
        notes=appt.notes,
    )


def create_app(database_url: str | None = None) -> FastAPI:
    db_url = database_url or os.environ.get(
        "PRODUCTSUITE_DATABASE_URL", "sqlite:///./bookforge_local.db"
    )
    engine = build_engine(db_url)
    SessionLocal = build_session_factory(engine)

    def get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        init_db(engine)
        yield

    app = FastAPI(title="BookForge API", version="0.1.0", lifespan=lifespan)
    cors_origins = os.environ.get(
        "PRODUCTSUITE_CORS_ORIGINS", "http://localhost:5174,http://127.0.0.1:5174"
    ).split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in cors_origins if o.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)

    auth_router, get_current_user = create_auth_dependencies(get_db)
    app.include_router(auth_router)

    @app.get("/api/health")
    def health():
        return {"status": "ok", "service": "bookforge"}

    @app.get("/api/org-slug")
    def get_org_slug(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        org = db.get(Organization, current_user.organization_id)
        return {"slug": org.slug if org else "", "name": org.name if org else ""}

    @app.get("/api/services", response_model=list[ServiceOut])
    def list_services(
        current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
    ):
        stmt = (
            select(BookingService)
            .options(selectinload(BookingService.staff_members))
            .where(BookingService.organization_id == current_user.organization_id)
        )
        return [
            ServiceOut(
                id=s.id,
                name=s.name,
                description=s.description,
                duration_minutes=s.duration_minutes,
                buffer_before_minutes=s.buffer_before_minutes,
                buffer_after_minutes=s.buffer_after_minutes,
                is_active=s.is_active,
                staff_ids=[st.id for st in s.staff_members],
            )
            for s in db.scalars(stmt).all()
        ]

    @app.post("/api/services", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
    def create_service(
        body: ServiceCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        svc = BookingService(
            organization_id=current_user.organization_id,
            name=body.name.strip(),
            description=body.description.strip(),
            duration_minutes=body.duration_minutes,
            buffer_before_minutes=body.buffer_before_minutes,
            buffer_after_minutes=body.buffer_after_minutes,
        )
        db.add(svc)
        db.commit()
        db.refresh(svc)
        return ServiceOut(
            id=svc.id,
            name=svc.name,
            description=svc.description,
            duration_minutes=svc.duration_minutes,
            buffer_before_minutes=svc.buffer_before_minutes,
            buffer_after_minutes=svc.buffer_after_minutes,
            is_active=svc.is_active,
            staff_ids=[],
        )

    @app.get("/api/staff", response_model=list[StaffOut])
    def list_staff(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        stmt = (
            select(StaffMember)
            .options(selectinload(StaffMember.services), selectinload(StaffMember.working_hours))
            .where(StaffMember.organization_id == current_user.organization_id)
        )
        return [
            StaffOut(
                id=st.id,
                name=st.name,
                email=st.email,
                timezone=st.timezone,
                service_ids=[s.id for s in st.services],
                working_hours=[
                    WorkingHoursEntry(
                        day_of_week=wh.day_of_week,
                        start_time=wh.start_time,
                        end_time=wh.end_time,
                    )
                    for wh in st.working_hours
                ],
            )
            for st in db.scalars(stmt).all()
        ]

    @app.post("/api/staff", response_model=StaffOut, status_code=status.HTTP_201_CREATED)
    def create_staff(
        body: StaffCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        _validate_tz(body.timezone)
        staff = StaffMember(
            organization_id=current_user.organization_id,
            name=body.name.strip(),
            email=body.email.strip().lower(),
            timezone=body.timezone,
        )
        if body.service_ids:
            services = db.scalars(
                select(BookingService).where(
                    BookingService.id.in_(body.service_ids),
                    BookingService.organization_id == current_user.organization_id,
                )
            ).all()
            staff.services = list(services)

        hours = body.working_hours or [
            WorkingHoursEntry(day_of_week=d, start_time="09:00", end_time="17:00") for d in range(5)
        ]
        for wh in hours:
            staff.working_hours.append(
                WorkingHours(
                    day_of_week=wh.day_of_week,
                    start_time=wh.start_time,
                    end_time=wh.end_time,
                )
            )

        db.add(staff)
        db.commit()
        db.refresh(staff)
        return StaffOut(
            id=staff.id,
            name=staff.name,
            email=staff.email,
            timezone=staff.timezone,
            service_ids=[s.id for s in staff.services],
            working_hours=[
                WorkingHoursEntry(
                    day_of_week=wh.day_of_week, start_time=wh.start_time, end_time=wh.end_time
                )
                for wh in staff.working_hours
            ],
        )

    @app.get("/api/appointments", response_model=list[AppointmentOut])
    def list_appointments(
        current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
    ):
        appts = db.scalars(
            select(Appointment)
            .where(Appointment.organization_id == current_user.organization_id)
            .order_by(Appointment.start_utc.asc())
        ).all()
        return [_to_appointment_out(db, a) for a in appts]

    @app.post("/api/appointments/{appointment_id}/reschedule", response_model=AppointmentOut)
    def reschedule_appointment(
        appointment_id: int,
        body: AppointmentReschedule,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        appt = db.scalar(
            select(Appointment).where(
                Appointment.id == appointment_id,
                Appointment.organization_id == current_user.organization_id,
            )
        )
        if appt is None:
            raise HTTPException(status_code=404, detail="Appointment not found.")

        staff = db.scalar(
            select(StaffMember)
            .options(selectinload(StaffMember.working_hours))
            .where(StaffMember.id == appt.staff_id)
        )
        svc = db.get(BookingService, appt.service_id)
        if not staff or not svc:
            raise HTTPException(status_code=404, detail="Related staff or service not found.")

        new_start = _ensure_utc(body.start_utc)
        new_end = _check_slot_available(
            db, staff=staff, service=svc, start_utc=new_start, exclude_appointment_id=appt.id
        )
        appt.start_utc = new_start
        appt.end_utc = new_end
        _create_notification(
            db,
            org_id=current_user.organization_id,
            appointment=appt,
            event_type="rescheduled",
            message=f"Appointment rescheduled to {new_start.isoformat()}",
        )
        db.commit()
        db.refresh(appt)
        return _to_appointment_out(db, appt)

    @app.post("/api/appointments/{appointment_id}/cancel", response_model=AppointmentOut)
    def cancel_appointment(
        appointment_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        appt = db.scalar(
            select(Appointment).where(
                Appointment.id == appointment_id,
                Appointment.organization_id == current_user.organization_id,
            )
        )
        if appt is None:
            raise HTTPException(status_code=404, detail="Appointment not found.")
        appt.status = "cancelled"
        _create_notification(
            db,
            org_id=current_user.organization_id,
            appointment=appt,
            event_type="cancelled",
            message="Your appointment has been cancelled.",
        )
        db.commit()
        db.refresh(appt)
        return _to_appointment_out(db, appt)

    @app.get("/api/notifications", response_model=list[NotificationOut])
    def list_notifications(
        current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
    ):
        rows = db.scalars(
            select(BookingNotification)
            .where(BookingNotification.organization_id == current_user.organization_id)
            .order_by(BookingNotification.created_at.desc())
        ).all()
        return [
            NotificationOut(
                id=n.id,
                appointment_id=n.appointment_id,
                recipient_email=n.recipient_email,
                event_type=n.event_type,
                message=n.message,
                created_at=n.created_at,
            )
            for n in rows
        ]

    # Public Booking Endpoints
    @app.get("/api/public/booking/{org_slug}")
    def get_public_booking_page(org_slug: str, db: Session = Depends(get_db)):
        org = db.scalar(select(Organization).where(Organization.slug == org_slug))
        if org is None:
            raise HTTPException(status_code=404, detail="Booking page not found.")
        services = db.scalars(
            select(BookingService)
            .options(selectinload(BookingService.staff_members))
            .where(
                BookingService.organization_id == org.id,
                BookingService.is_active.is_(True),
            )
        ).all()
        staff = db.scalars(
            select(StaffMember)
            .options(selectinload(StaffMember.services), selectinload(StaffMember.working_hours))
            .where(StaffMember.organization_id == org.id)
        ).all()
        return {
            "organization_name": org.name,
            "slug": org.slug,
            "services": [
                ServiceOut(
                    id=s.id,
                    name=s.name,
                    description=s.description,
                    duration_minutes=s.duration_minutes,
                    buffer_before_minutes=s.buffer_before_minutes,
                    buffer_after_minutes=s.buffer_after_minutes,
                    is_active=s.is_active,
                    staff_ids=[st.id for st in s.staff_members],
                )
                for s in services
            ],
            "staff": [{"id": st.id, "name": st.name, "timezone": st.timezone} for st in staff],
        }

    @app.get("/api/public/booking/{org_slug}/slots", response_model=list[SlotOut])
    def get_available_slots(
        org_slug: str,
        service_id: int,
        staff_id: int,
        target_date: date,
        customer_timezone: str = Query(default="UTC"),
        db: Session = Depends(get_db),
    ):
        org = db.scalar(select(Organization).where(Organization.slug == org_slug))
        if org is None:
            raise HTTPException(status_code=404, detail="Booking page not found.")
        svc = db.scalar(
            select(BookingService).where(
                BookingService.id == service_id, BookingService.organization_id == org.id
            )
        )
        staff = db.scalar(
            select(StaffMember)
            .options(selectinload(StaffMember.working_hours))
            .where(StaffMember.id == staff_id, StaffMember.organization_id == org.id)
        )
        if svc is None or staff is None:
            raise HTTPException(status_code=404, detail="Service or staff not found.")

        staff_tz = _validate_tz(staff.timezone)
        cust_tz = _validate_tz(customer_timezone)
        day_hours = [wh for wh in staff.working_hours if wh.day_of_week == target_date.weekday()]
        slots: list[SlotOut] = []

        for wh in day_hours:
            cursor = datetime.combine(target_date, _parse_hhmm(wh.start_time), tzinfo=staff_tz)
            end_bound = datetime.combine(target_date, _parse_hhmm(wh.end_time), tzinfo=staff_tz)
            while cursor + timedelta(minutes=svc.duration_minutes) <= end_bound:
                start_utc = cursor.astimezone(UTC)
                try:
                    end_utc = _check_slot_available(
                        db, staff=staff, service=svc, start_utc=start_utc
                    )
                    slots.append(
                        SlotOut(
                            start_utc=start_utc,
                            end_utc=end_utc,
                            display_local=start_utc.astimezone(cust_tz).strftime("%H:%M %Z"),
                        )
                    )
                except HTTPException:
                    pass
                cursor += timedelta(minutes=30)

        return slots

    @app.post(
        "/api/public/booking/{org_slug}/book",
        response_model=AppointmentOut,
        status_code=status.HTTP_201_CREATED,
    )
    def book_appointment(
        org_slug: str,
        body: AppointmentCreate,
        request: Request,
        db: Session = Depends(get_db),
    ):
        client_ip = request.client.host if request.client else "unknown"
        if not _public_booking_limiter.allow(f"book:{org_slug}:{client_ip}"):
            raise HTTPException(status_code=429, detail="Too many booking requests.")

        org = db.scalar(select(Organization).where(Organization.slug == org_slug))
        if org is None:
            raise HTTPException(status_code=404, detail="Booking page not found.")
        svc = db.scalar(
            select(BookingService).where(
                BookingService.id == body.service_id, BookingService.organization_id == org.id
            )
        )
        staff = db.scalar(
            select(StaffMember)
            .options(selectinload(StaffMember.working_hours), selectinload(StaffMember.services))
            .where(StaffMember.id == body.staff_id, StaffMember.organization_id == org.id)
        )
        if svc is None or staff is None:
            raise HTTPException(status_code=404, detail="Service or staff member not found.")
        if all(s.id != svc.id for s in staff.services):
            raise HTTPException(
                status_code=422, detail="Selected staff member does not offer this service."
            )

        _validate_tz(body.customer_timezone)
        start_utc = _ensure_utc(body.start_utc)
        end_utc = _check_slot_available(db, staff=staff, service=svc, start_utc=start_utc)

        appt = Appointment(
            organization_id=org.id,
            service_id=svc.id,
            staff_id=staff.id,
            customer_name=body.customer_name.strip(),
            customer_email=body.customer_email.strip().lower(),
            customer_timezone=body.customer_timezone,
            start_utc=start_utc,
            end_utc=end_utc,
            status="confirmed",
            notes=body.notes.strip(),
        )
        db.add(appt)
        db.flush()
        _create_notification(
            db,
            org_id=org.id,
            appointment=appt,
            event_type="booked",
            message=f"Confirmed {svc.name} with {staff.name} at {start_utc.isoformat()}",
        )
        db.commit()
        db.refresh(appt)
        return _to_appointment_out(db, appt)

    return app


app = create_app()
