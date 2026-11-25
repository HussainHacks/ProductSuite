from datetime import date, datetime

from productsuite_database import Base, TimestampMixin
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship


class TaskList(Base, TimestampMixin):
    """A user-created list for organizing personal tasks."""

    __tablename__ = "tf_lists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    color: Mapped[str] = mapped_column(String(24), default="sky", nullable=False)

    tasks: Mapped[list["TaskItem"]] = relationship("TaskItem", back_populates="task_list")


class TaskItem(Base, TimestampMixin):
    """A personal task with priority, due date, recurrence, and completion tracking."""

    __tablename__ = "tf_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    list_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("tf_lists.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    priority: Mapped[str] = mapped_column(String(16), default="medium", nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    recurrence: Mapped[str] = mapped_column(String(16), default="none", nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    task_list: Mapped[TaskList | None] = relationship("TaskList", back_populates="tasks")


class UserPreference(Base, TimestampMixin):
    """Persistent per-user TaskForge preferences."""

    __tablename__ = "tf_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    default_view: Mapped[str] = mapped_column(String(32), default="today", nullable=False)
    show_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    default_priority: Mapped[str] = mapped_column(String(16), default="medium", nullable=False)
