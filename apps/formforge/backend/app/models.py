from enum import StrEnum

from productsuite_database import Base, TimestampMixin
from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship


class QuestionType(StrEnum):
    SHORT_TEXT = "short_text"
    LONG_TEXT = "long_text"
    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"
    DROPDOWN = "dropdown"
    RATING = "rating"
    DATE = "date"
    NUMBER = "number"
    EMAIL = "email"


class Form(Base, TimestampMixin):
    """A form owned by an organization."""

    __tablename__ = "ff_forms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    public_slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)

    questions: Mapped[list["FormQuestion"]] = relationship(
        "FormQuestion",
        back_populates="form",
        cascade="all, delete-orphan",
        order_by="FormQuestion.position",
    )
    responses: Mapped[list["FormResponse"]] = relationship(
        "FormResponse",
        back_populates="form",
        cascade="all, delete-orphan",
        order_by="FormResponse.created_at.desc()",
    )


class FormQuestion(Base, TimestampMixin):
    """An individual question inside a form."""

    __tablename__ = "ff_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    form_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("ff_forms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    prompt: Mapped[str] = mapped_column(String(500), nullable=False)
    question_type: Mapped[str] = mapped_column(String(32), nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    options: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    form: Mapped[Form] = relationship("Form", back_populates="questions")


class FormResponse(Base, TimestampMixin):
    """A submitted response to a published form."""

    __tablename__ = "ff_responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    form_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("ff_forms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    respondent_label: Mapped[str] = mapped_column(String(120), default="Anonymous", nullable=False)
    answers: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    form: Mapped[Form] = relationship("Form", back_populates="responses")
