from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class BoardElement(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    kind: Literal["sticky", "text", "rect", "circle", "connector", "stroke"]
    x: float = 0.0
    y: float = 0.0
    width: float = 160.0
    height: float = 120.0
    x2: float | None = None
    y2: float | None = None
    text: str = ""
    color: str = "#FEF08A"
    points: list[list[float]] = Field(default_factory=list)


class BoardCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class BoardSave(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    viewport_x: float = 0.0
    viewport_y: float = 0.0
    viewport_zoom: float = Field(default=1.0, ge=0.2, le=4.0)
    elements: list[BoardElement] = Field(default_factory=list)


class BoardOut(BaseModel):
    id: int
    title: str
    version: int
    viewport_x: float
    viewport_y: float
    viewport_zoom: float
    elements: list[BoardElement]
    created_at: datetime
    updated_at: datetime
