from datetime import datetime

from productsuite_database import Base, TimestampMixin
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

staff_services_table = Table(
    "bf_staff_services",
    Base.metadata,
    Column("staff_id", Integer, ForeignKey("bf_staff.id", ondelete="CASCADE"), primary_key=True),
    Column(
        "service_id", Integer, ForeignKey("bf_services.id", ondelete="CASCADE"), primary_key=True
    ),
)


class BookingService(Base, TimestampMixin):
    """A bookable service offered by an organization."""

    __tablename__ = "bf_services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    buffer_before_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    buffer_after_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    staff_members: Mapped[list["StaffMember"]] = relationship(
        "StaffMember", secondary=staff_services_table, back_populates="services"
    )


class StaffMember(Base, TimestampMixin):
    """A staff member who delivers services within a specific timezone."""

    __tablename__ = "bf_staff"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), default="America/Chicago", nullable=False)

    services: Mapped[list[BookingService]] = relationship(
        "BookingService", secondary=staff_services_table, back_populates="staff_members"
    )
    working_hours: Mapped[list["WorkingHours"]] = relationship(
        "WorkingHours", back_populates="staff", cascade="all, delete-orphan"
    )


class WorkingHours(Base, TimestampMixin):
    """Weekly recurring working hours for a staff member (0=Monday .. 6=Sunday)."""

    __tablename__ = "bf_working_hours"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    staff_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bf_staff.id", ondelete="CASCADE"), nullable=False, index=True
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM

    staff: Mapped[StaffMember] = relationship("StaffMember", back_populates="working_hours")


class Appointment(Base, TimestampMixin):
    """A scheduled appointment stored with UTC timestamps."""

    __tablename__ = "bf_appointments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    service_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bf_services.id", ondelete="CASCADE"), nullable=False
    )
    staff_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bf_staff.id", ondelete="CASCADE"), nullable=False, index=True
    )
    customer_name: Mapped[str] = mapped_column(String(120), nullable=False)
    customer_email: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_timezone: Mapped[str] = mapped_column(String(64), default="UTC", nullable=False)
    start_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="confirmed", nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)


class BookingNotification(Base, TimestampMixin):
    """Local notification record for booking events (no external email/SMS)."""

    __tablename__ = "bf_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    appointment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bf_appointments.id", ondelete="CASCADE"), nullable=False
    )
    recipient_email: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
