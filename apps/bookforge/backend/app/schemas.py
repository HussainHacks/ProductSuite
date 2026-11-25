from datetime import datetime

from pydantic import BaseModel, Field


class ServiceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=1000)
    duration_minutes: int = Field(ge=5, le=480)
    buffer_before_minutes: int = Field(default=0, ge=0, le=120)
    buffer_after_minutes: int = Field(default=0, ge=0, le=120)


class ServiceOut(BaseModel):
    id: int
    name: str
    description: str
    duration_minutes: int
    buffer_before_minutes: int
    buffer_after_minutes: int
    is_active: bool
    staff_ids: list[int] = Field(default_factory=list)


class WorkingHoursEntry(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(pattern=r"^\d{2}:\d{2}$")


class StaffCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=5, max_length=255)
    timezone: str = Field(default="America/Chicago", max_length=64)
    service_ids: list[int] = Field(default_factory=list)
    working_hours: list[WorkingHoursEntry] = Field(default_factory=list)


class StaffOut(BaseModel):
    id: int
    name: str
    email: str
    timezone: str
    service_ids: list[int]
    working_hours: list[WorkingHoursEntry]


class AppointmentCreate(BaseModel):
    service_id: int
    staff_id: int
    start_utc: datetime
    customer_name: str = Field(min_length=1, max_length=120)
    customer_email: str = Field(min_length=5, max_length=255)
    customer_timezone: str = Field(default="UTC", max_length=64)
    notes: str = Field(default="", max_length=1000)


class AppointmentReschedule(BaseModel):
    start_utc: datetime


class AppointmentOut(BaseModel):
    id: int
    service_id: int
    service_name: str
    staff_id: int
    staff_name: str
    customer_name: str
    customer_email: str
    customer_timezone: str
    start_utc: datetime
    end_utc: datetime
    status: str
    notes: str


class NotificationOut(BaseModel):
    id: int
    appointment_id: int
    recipient_email: str
    event_type: str
    message: str
    created_at: datetime


class SlotOut(BaseModel):
    start_utc: datetime
    end_utc: datetime
    display_local: str
