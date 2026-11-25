from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

LayoutType = Literal["vertical_scroll", "horizontal_slides", "editorial_grid"]
CardType = Literal["heading", "paragraph", "image", "link", "callout"]


class CardCreate(BaseModel):
    card_type: CardType
    title: str = Field(default="", max_length=240)
    body: str = Field(default="", max_length=8000)
    media_url: str = Field(default="", max_length=1000)


class CardOut(BaseModel):
    id: int
    story_id: int
    card_type: CardType
    title: str
    body: str
    media_url: str
    position: int


class ReorderCardsRequest(BaseModel):
    card_ids: list[int] = Field(min_length=1)


class StoryCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    subtitle: str = Field(default="", max_length=400)
    layout: LayoutType = "vertical_scroll"


class StoryUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    subtitle: str | None = Field(default=None, max_length=400)
    layout: LayoutType | None = None
    is_published: bool | None = None


class StoryOut(BaseModel):
    id: int
    title: str
    subtitle: str
    layout: LayoutType
    is_published: bool
    public_slug: str
    created_at: datetime
    updated_at: datetime
    cards: list[CardOut] = Field(default_factory=list)


class PublicStoryOut(BaseModel):
    title: str
    subtitle: str
    layout: LayoutType
    public_slug: str
    cards: list[CardOut]
