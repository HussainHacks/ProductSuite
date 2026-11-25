import calendar
import os
from contextlib import asynccontextmanager
from datetime import UTC, date, datetime, timedelta

from app.models import TaskItem, TaskList, UserPreference
from app.schemas import (
    PreferenceOut,
    PreferenceUpdate,
    Priority,
    Recurrence,
    TaskCreate,
    TaskListCreate,
    TaskListOut,
    TaskOut,
    TaskUpdate,
)
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from productsuite_auth import User, create_auth_dependencies
from productsuite_database import build_engine, build_session_factory, init_db
from productsuite_shared import register_error_handlers
from sqlalchemy import select
from sqlalchemy.orm import Session


def _advance_due_date(base: date | None, recurrence: Recurrence) -> date:
    anchor = base or date.today()
    if recurrence == Recurrence.DAILY:
        return anchor + timedelta(days=1)
    if recurrence == Recurrence.WEEKLY:
        return anchor + timedelta(days=7)
    if recurrence == Recurrence.MONTHLY:
        month = anchor.month % 12 + 1
        year = anchor.year + (1 if anchor.month == 12 else 0)
        last_day = calendar.monthrange(year, month)[1]
        return date(year, month, min(anchor.day, last_day))
    return anchor


def _to_task_out(t: TaskItem) -> TaskOut:
    return TaskOut(
        id=t.id,
        list_id=t.list_id,
        title=t.title,
        notes=t.notes,
        priority=Priority(t.priority),
        due_date=t.due_date,
        recurrence=Recurrence(t.recurrence),
        is_completed=t.is_completed,
        completed_at=t.completed_at,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


def create_app(database_url: str | None = None) -> FastAPI:
    db_url = database_url or os.environ.get(
        "PRODUCTSUITE_DATABASE_URL", "sqlite:///./taskforge_local.db"
    )
    engine = build_engine(db_url)
    SessionLocal = build_session_factory(engine)

    def get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        init_db(engine)
        yield

    app = FastAPI(title="TaskForge API", version="0.1.0", lifespan=lifespan)
    cors_origins = os.environ.get(
        "PRODUCTSUITE_CORS_ORIGINS", "http://localhost:5172,http://127.0.0.1:5172"
    ).split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in cors_origins if o.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)

    auth_router, get_current_user = create_auth_dependencies(get_db)
    app.include_router(auth_router)

    @app.get("/api/health")
    def health():
        return {"status": "ok", "service": "taskforge"}

    @app.get("/api/lists", response_model=list[TaskListOut])
    def list_task_lists(
        current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
    ):
        lists = db.scalars(
            select(TaskList)
            .where(TaskList.user_id == current_user.id)
            .order_by(TaskList.created_at.asc())
        ).all()
        counts = {}
        tasks = db.scalars(
            select(TaskItem).where(
                TaskItem.user_id == current_user.id, TaskItem.is_completed.is_(False)
            )
        ).all()
        for t in tasks:
            if t.list_id is not None:
                counts[t.list_id] = counts.get(t.list_id, 0) + 1
        return [
            TaskListOut(id=lst.id, name=lst.name, color=lst.color, task_count=counts.get(lst.id, 0))
            for lst in lists
        ]

    @app.post("/api/lists", response_model=TaskListOut, status_code=status.HTTP_201_CREATED)
    def create_task_list(
        body: TaskListCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        lst = TaskList(
            user_id=current_user.id,
            organization_id=current_user.organization_id,
            name=body.name.strip(),
            color=body.color,
        )
        db.add(lst)
        db.commit()
        db.refresh(lst)
        return TaskListOut(id=lst.id, name=lst.name, color=lst.color, task_count=0)

    @app.delete("/api/lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_task_list(
        list_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        lst = db.scalar(
            select(TaskList).where(TaskList.id == list_id, TaskList.user_id == current_user.id)
        )
        if lst is None:
            raise HTTPException(status_code=404, detail="Task list not found.")
        db.delete(lst)
        db.commit()

    @app.get("/api/tasks", response_model=list[TaskOut])
    def list_tasks(
        view: str = Query(default="all", pattern="^(today|upcoming|all|completed|list)$"),
        list_id: int | None = None,
        priority: Priority | None = None,
        q: str | None = None,
        include_completed: bool = True,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        stmt = select(TaskItem).where(TaskItem.user_id == current_user.id)
        today = date.today()

        if view == "today":
            stmt = stmt.where(TaskItem.due_date == today)
        elif view == "upcoming":
            stmt = stmt.where(TaskItem.due_date.is_not(None), TaskItem.due_date >= today)
        elif view == "completed":
            stmt = stmt.where(TaskItem.is_completed.is_(True))
        elif view == "list" and list_id is not None:
            stmt = stmt.where(TaskItem.list_id == list_id)

        if view != "completed" and not include_completed:
            stmt = stmt.where(TaskItem.is_completed.is_(False))
        if list_id is not None and view != "list":
            stmt = stmt.where(TaskItem.list_id == list_id)
        if priority is not None:
            stmt = stmt.where(TaskItem.priority == priority.value)
        if q:
            pattern = f"%{q.strip()}%"
            stmt = stmt.where((TaskItem.title.ilike(pattern)) | (TaskItem.notes.ilike(pattern)))

        stmt = stmt.order_by(TaskItem.is_completed.asc(), TaskItem.due_date.asc().nullslast())
        return [_to_task_out(t) for t in db.scalars(stmt).all()]

    @app.post("/api/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
    def create_task(
        body: TaskCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        if body.list_id is not None:
            lst = db.scalar(
                select(TaskList).where(
                    TaskList.id == body.list_id, TaskList.user_id == current_user.id
                )
            )
            if lst is None:
                raise HTTPException(status_code=404, detail="Target list not found.")

        task = TaskItem(
            user_id=current_user.id,
            organization_id=current_user.organization_id,
            list_id=body.list_id,
            title=body.title.strip(),
            notes=body.notes.strip(),
            priority=body.priority.value,
            due_date=body.due_date,
            recurrence=body.recurrence.value,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return _to_task_out(task)

    @app.patch("/api/tasks/{task_id}", response_model=TaskOut)
    def update_task(
        task_id: int,
        body: TaskUpdate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        task = db.scalar(
            select(TaskItem).where(TaskItem.id == task_id, TaskItem.user_id == current_user.id)
        )
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found.")

        if body.title is not None:
            task.title = body.title.strip()
        if body.notes is not None:
            task.notes = body.notes.strip()
        if body.clear_list:
            task.list_id = None
        elif body.list_id is not None:
            lst = db.scalar(
                select(TaskList).where(
                    TaskList.id == body.list_id, TaskList.user_id == current_user.id
                )
            )
            if lst is None:
                raise HTTPException(status_code=404, detail="Target list not found.")
            task.list_id = body.list_id
        if body.priority is not None:
            task.priority = body.priority.value
        if body.clear_due_date:
            task.due_date = None
        elif body.due_date is not None:
            task.due_date = body.due_date
        if body.recurrence is not None:
            task.recurrence = body.recurrence.value

        db.commit()
        db.refresh(task)
        return _to_task_out(task)

    @app.post("/api/tasks/{task_id}/complete", response_model=TaskOut)
    def complete_task(
        task_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        task = db.scalar(
            select(TaskItem).where(TaskItem.id == task_id, TaskItem.user_id == current_user.id)
        )
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found.")

        if not task.is_completed:
            task.is_completed = True
            task.completed_at = datetime.now(UTC)

            rec = Recurrence(task.recurrence)
            if rec != Recurrence.NONE:
                next_task = TaskItem(
                    user_id=task.user_id,
                    organization_id=task.organization_id,
                    list_id=task.list_id,
                    title=task.title,
                    notes=task.notes,
                    priority=task.priority,
                    due_date=_advance_due_date(task.due_date, rec),
                    recurrence=task.recurrence,
                )
                db.add(next_task)

            db.commit()
            db.refresh(task)
        return _to_task_out(task)

    @app.post("/api/tasks/{task_id}/reopen", response_model=TaskOut)
    def reopen_task(
        task_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        task = db.scalar(
            select(TaskItem).where(TaskItem.id == task_id, TaskItem.user_id == current_user.id)
        )
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found.")
        task.is_completed = False
        task.completed_at = None
        db.commit()
        db.refresh(task)
        return _to_task_out(task)

    @app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_task(
        task_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        task = db.scalar(
            select(TaskItem).where(TaskItem.id == task_id, TaskItem.user_id == current_user.id)
        )
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found.")
        db.delete(task)
        db.commit()

    @app.get("/api/preferences", response_model=PreferenceOut)
    def get_preferences(
        current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
    ):
        pref = db.scalar(select(UserPreference).where(UserPreference.user_id == current_user.id))
        if pref is None:
            pref = UserPreference(user_id=current_user.id)
            db.add(pref)
            db.commit()
            db.refresh(pref)
        return PreferenceOut(
            default_view=pref.default_view,
            show_completed=pref.show_completed,
            default_priority=Priority(pref.default_priority),
        )

    @app.patch("/api/preferences", response_model=PreferenceOut)
    def update_preferences(
        body: PreferenceUpdate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        pref = db.scalar(select(UserPreference).where(UserPreference.user_id == current_user.id))
        if pref is None:
            pref = UserPreference(user_id=current_user.id)
            db.add(pref)
        if body.default_view is not None:
            pref.default_view = body.default_view
        if body.show_completed is not None:
            pref.show_completed = body.show_completed
        if body.default_priority is not None:
            pref.default_priority = body.default_priority.value
        db.commit()
        db.refresh(pref)
        return PreferenceOut(
            default_view=pref.default_view,
            show_completed=pref.show_completed,
            default_priority=Priority(pref.default_priority),
        )

    return app


app = create_app()
