from datetime import datetime
from typing import Any

from app.models import FieldType
from pydantic import BaseModel, Field


class ColumnCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    field_type: FieldType
    required: bool = False
    options: list[str] = Field(default_factory=list)


class ColumnOut(BaseModel):
    id: int
    key: str
    name: str
    field_type: FieldType
    required: bool
    options: list[str]
    position: int


class DataListCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=1000)
    template: str | None = Field(
        default=None, pattern="^(issue_tracker|asset_inventory|event_contacts)$"
    )


class RecordOut(BaseModel):
    id: int
    list_id: int
    values: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class RecordUpsert(BaseModel):
    values: dict[str, Any] = Field(default_factory=dict)


class DataListOut(BaseModel):
    id: int
    name: str
    description: str
    columns: list[ColumnOut]
    record_count: int = 0
