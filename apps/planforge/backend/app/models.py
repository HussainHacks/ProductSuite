from datetime import date

from productsuite_database import Base, TimestampMixin
from sqlalchemy import JSON, Boolean, Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship


class Project(Base, TimestampMixin):
    """A project board workspace belonging to an organization."""

    __tablename__ = "pf_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)

    columns: Mapped[list["BoardColumn"]] = relationship(
        "BoardColumn",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="BoardColumn.position",
    )
    tasks: Mapped[list["PlanTask"]] = relationship(
        "PlanTask", back_populates="project", cascade="all, delete-orphan"
    )
    activities: Mapped[list["ActivityLog"]] = relationship(
        "ActivityLog",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="ActivityLog.created_at.desc()",
    )


class BoardColumn(Base, TimestampMixin):
    """A column/bucket on a project Kanban board."""

    __tablename__ = "pf_columns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pf_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_done_column: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    project: Mapped[Project] = relationship("Project", back_populates="columns")
    tasks: Mapped[list["PlanTask"]] = relationship(
        "PlanTask", back_populates="column", order_by="PlanTask.position"
    )


class PlanTask(Base, TimestampMixin):
    """A task card inside a PlanForge project column."""

    __tablename__ = "pf_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pf_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    column_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pf_columns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assignee_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    priority: Mapped[str] = mapped_column(String(16), default="medium", nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    labels: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    project: Mapped[Project] = relationship("Project", back_populates="tasks")
    column: Mapped[BoardColumn] = relationship("BoardColumn", back_populates="tasks")
    comments: Mapped[list["TaskComment"]] = relationship(
        "TaskComment",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskComment.created_at.asc()",
    )


class TaskComment(Base, TimestampMixin):
    """A discussion comment on a PlanTask."""

    __tablename__ = "pf_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pf_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    author_name: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    task: Mapped[PlanTask] = relationship("PlanTask", back_populates="comments")


class ActivityLog(Base, TimestampMixin):
    """Audit trail of project actions."""

    __tablename__ = "pf_activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pf_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    actor_name: Mapped[str] = mapped_column(String(120), nullable=False)
    summary: Mapped[str] = mapped_column(String(300), nullable=False)

    project: Mapped[Project] = relationship("Project", back_populates="activities")
