from datetime import datetime
from typing import Any

from app.models import QuestionType
from pydantic import BaseModel, Field


class QuestionCreate(BaseModel):
    prompt: str = Field(min_length=1, max_length=500)
    question_type: QuestionType
    required: bool = False
    options: list[str] = Field(default_factory=list)


class QuestionUpdate(BaseModel):
    prompt: str | None = Field(default=None, min_length=1, max_length=500)
    question_type: QuestionType | None = None
    required: bool | None = None
    options: list[str] | None = None


class QuestionOut(BaseModel):
    id: int
    form_id: int
    prompt: str
    question_type: QuestionType
    required: bool
    options: list[str]
    position: int


class ReorderQuestionsRequest(BaseModel):
    question_ids: list[int] = Field(min_length=1)


class FormCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)


class FormUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    is_published: bool | None = None


class FormOut(BaseModel):
    id: int
    title: str
    description: str
    is_published: bool
    public_slug: str
    created_at: datetime
    updated_at: datetime
    questions: list[QuestionOut] = Field(default_factory=list)
    response_count: int = 0


class PublicFormOut(BaseModel):
    title: str
    description: str
    public_slug: str
    questions: list[QuestionOut]


class SubmitResponseRequest(BaseModel):
    respondent_label: str = Field(default="Anonymous", max_length=120)
    answers: dict[str, Any] = Field(default_factory=dict)


class FormResponseOut(BaseModel):
    id: int
    form_id: int
    respondent_label: str
    answers: dict[str, Any]
    created_at: datetime


class QuestionSummary(BaseModel):
    question_id: int
    prompt: str
    question_type: QuestionType
    total_answers: int
    breakdown: dict[str, int] = Field(default_factory=dict)
    average_rating: float | None = None
    sample_values: list[str] = Field(default_factory=list)


class FormSummaryOut(BaseModel):
    form_id: int
    title: str
    total_responses: int
    questions: list[QuestionSummary]
