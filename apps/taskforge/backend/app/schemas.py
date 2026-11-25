from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class Priority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Recurrence(StrEnum):
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class TaskListCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    color: str = Field(default="sky", max_length=24)


class TaskListOut(BaseModel):
    id: int
    name: str
    color: str
    task_count: int = 0


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    notes: str = Field(default="", max_length=4000)
    list_id: int | None = None
    priority: Priority = Priority.MEDIUM
    due_date: date | None = None
    recurrence: Recurrence = Recurrence.NONE


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    notes: str | None = Field(default=None, max_length=4000)
    list_id: int | None = None
    clear_list: bool = False
    priority: Priority | None = None
    due_date: date | None = None
    clear_due_date: bool = False
    recurrence: Recurrence | None = None


class TaskOut(BaseModel):
    id: int
    list_id: int | None
    title: str
    notes: str
    priority: Priority
    due_date: date | None
    recurrence: Recurrence
    is_completed: bool
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PreferenceUpdate(BaseModel):
    default_view: str | None = Field(default=None, pattern="^(today|upcoming|all|completed)$")
    show_completed: bool | None = None
    default_priority: Priority | None = None


class PreferenceOut(BaseModel):
    default_view: str
    show_completed: bool
    default_priority: Priority
