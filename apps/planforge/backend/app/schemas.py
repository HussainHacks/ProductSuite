from datetime import date, datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=2000)


class ColumnCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    is_done_column: bool = False


class ColumnOut(BaseModel):
    id: int
    project_id: int
    name: str
    position: int
    is_done_column: bool


class TaskCreate(BaseModel):
    column_id: int
    title: str = Field(min_length=1, max_length=240)
    description: str = Field(default="", max_length=4000)
    priority: str = Field(default="medium", pattern="^(low|medium|high|urgent)$")
    due_date: date | None = None
    labels: list[str] = Field(default_factory=list)
    assignee_id: int | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    description: str | None = Field(default=None, max_length=4000)
    priority: str | None = Field(default=None, pattern="^(low|medium|high|urgent)$")
    due_date: date | None = None
    clear_due_date: bool = False
    labels: list[str] | None = None
    assignee_id: int | None = None
    clear_assignee: bool = False


class TaskMove(BaseModel):
    target_column_id: int
    position: int = 0


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class CommentOut(BaseModel):
    id: int
    task_id: int
    author_id: int
    author_name: str
    body: str
    created_at: datetime


class TaskOut(BaseModel):
    id: int
    project_id: int
    column_id: int
    assignee_id: int | None
    assignee_name: str | None = None
    title: str
    description: str
    priority: str
    due_date: date | None
    labels: list[str]
    position: int
    comments: list[CommentOut] = Field(default_factory=list)


class ActivityOut(BaseModel):
    id: int
    actor_name: str
    summary: str
    created_at: datetime


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str
    columns: list[ColumnOut]
    tasks: list[TaskOut]
    activities: list[ActivityOut]


class MemberOut(BaseModel):
    id: int
    full_name: str
    email: str
