import os
from contextlib import asynccontextmanager

from app.models import ActivityLog, BoardColumn, PlanTask, Project, TaskComment
from app.schemas import (
    ActivityOut,
    ColumnCreate,
    ColumnOut,
    CommentCreate,
    CommentOut,
    MemberOut,
    ProjectCreate,
    ProjectOut,
    TaskCreate,
    TaskMove,
    TaskOut,
    TaskUpdate,
)
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from productsuite_auth import User, create_auth_dependencies
from productsuite_database import build_engine, build_session_factory, init_db
from productsuite_shared import register_error_handlers
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload


def _record_activity(db: Session, project_id: int, actor_name: str, summary: str) -> None:
    db.add(ActivityLog(project_id=project_id, actor_name=actor_name, summary=summary))


def _load_project(db: Session, project_id: int, org_id: int) -> Project:
    stmt = (
        select(Project)
        .options(
            selectinload(Project.columns),
            selectinload(Project.tasks).selectinload(PlanTask.comments),
            selectinload(Project.activities),
        )
        .where(Project.id == project_id, Project.organization_id == org_id)
    )
    project = db.scalar(stmt)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


def _to_project_out(db: Session, project: Project) -> ProjectOut:
    users = db.scalars(select(User).where(User.organization_id == project.organization_id)).all()
    user_map = {u.id: u.full_name for u in users}
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        columns=[
            ColumnOut(
                id=c.id,
                project_id=c.project_id,
                name=c.name,
                position=c.position,
                is_done_column=c.is_done_column,
            )
            for c in project.columns
        ],
        tasks=[
            TaskOut(
                id=t.id,
                project_id=t.project_id,
                column_id=t.column_id,
                assignee_id=t.assignee_id,
                assignee_name=user_map.get(t.assignee_id) if t.assignee_id else None,
                title=t.title,
                description=t.description,
                priority=t.priority,
                due_date=t.due_date,
                labels=t.labels or [],
                position=t.position,
                comments=[
                    CommentOut(
                        id=cm.id,
                        task_id=cm.task_id,
                        author_id=cm.author_id,
                        author_name=cm.author_name,
                        body=cm.body,
                        created_at=cm.created_at,
                    )
                    for cm in t.comments
                ],
            )
            for t in sorted(project.tasks, key=lambda item: (item.column_id, item.position))
        ],
        activities=[
            ActivityOut(
                id=a.id, actor_name=a.actor_name, summary=a.summary, created_at=a.created_at
            )
            for a in project.activities[:30]
        ],
    )


def create_app(database_url: str | None = None) -> FastAPI:
    db_url = database_url or os.environ.get(
        "PRODUCTSUITE_DATABASE_URL", "sqlite:///./planforge_local.db"
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

    app = FastAPI(title="PlanForge API", version="0.1.0", lifespan=lifespan)
    cors_origins = os.environ.get(
        "PRODUCTSUITE_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
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
        return {"status": "ok", "service": "planforge"}

    @app.get("/api/members", response_model=list[MemberOut])
    def list_members(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        users = db.scalars(
            select(User).where(User.organization_id == current_user.organization_id)
        ).all()
        return [MemberOut(id=u.id, full_name=u.full_name, email=u.email) for u in users]

    @app.get("/api/projects", response_model=list[ProjectOut])
    def list_projects(
        current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
    ):
        stmt = (
            select(Project)
            .options(
                selectinload(Project.columns),
                selectinload(Project.tasks).selectinload(PlanTask.comments),
                selectinload(Project.activities),
            )
            .where(Project.organization_id == current_user.organization_id)
            .order_by(Project.created_at.desc())
        )
        return [_to_project_out(db, p) for p in db.scalars(stmt).all()]

    @app.post("/api/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
    def create_project(
        body: ProjectCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        project = Project(
            organization_id=current_user.organization_id,
            name=body.name.strip(),
            description=body.description.strip(),
        )
        db.add(project)
        db.flush()

        for idx, (col_name, is_done) in enumerate(
            [("To Do", False), ("In Progress", False), ("Done", True)]
        ):
            db.add(
                BoardColumn(
                    project_id=project.id, name=col_name, position=idx, is_done_column=is_done
                )
            )
        _record_activity(
            db, project.id, current_user.full_name, f"Created project '{project.name}'"
        )
        db.commit()
        return _to_project_out(db, _load_project(db, project.id, current_user.organization_id))

    @app.get("/api/projects/{project_id}", response_model=ProjectOut)
    def get_project(
        project_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        return _to_project_out(db, _load_project(db, project_id, current_user.organization_id))

    @app.post(
        "/api/projects/{project_id}/columns",
        response_model=ColumnOut,
        status_code=status.HTTP_201_CREATED,
    )
    def add_column(
        project_id: int,
        body: ColumnCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        project = _load_project(db, project_id, current_user.organization_id)
        col = BoardColumn(
            project_id=project.id,
            name=body.name.strip(),
            position=len(project.columns),
            is_done_column=body.is_done_column,
        )
        db.add(col)
        _record_activity(db, project.id, current_user.full_name, f"Added column '{col.name}'")
        db.commit()
        db.refresh(col)
        return ColumnOut(
            id=col.id,
            project_id=col.project_id,
            name=col.name,
            position=col.position,
            is_done_column=col.is_done_column,
        )

    @app.post(
        "/api/projects/{project_id}/tasks",
        response_model=TaskOut,
        status_code=status.HTTP_201_CREATED,
    )
    def create_task(
        project_id: int,
        body: TaskCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        project = _load_project(db, project_id, current_user.organization_id)
        col = next((c for c in project.columns if c.id == body.column_id), None)
        if col is None:
            raise HTTPException(status_code=404, detail="Column not found in project.")
        if body.assignee_id is not None:
            assignee = db.scalar(
                select(User).where(
                    User.id == body.assignee_id,
                    User.organization_id == current_user.organization_id,
                )
            )
            if assignee is None:
                raise HTTPException(status_code=404, detail="Assignee not found in organization.")

        pos = len([t for t in project.tasks if t.column_id == col.id])
        task = PlanTask(
            project_id=project.id,
            column_id=col.id,
            assignee_id=body.assignee_id,
            title=body.title.strip(),
            description=body.description.strip(),
            priority=body.priority,
            due_date=body.due_date,
            labels=[lbl.strip() for lbl in body.labels if lbl.strip()],
            position=pos,
        )
        db.add(task)
        _record_activity(
            db, project.id, current_user.full_name, f"Created task '{task.title}' in {col.name}"
        )
        db.commit()
        db.expire_all()
        refreshed = _load_project(db, project.id, current_user.organization_id)
        out = _to_project_out(db, refreshed)
        return next(t for t in out.tasks if t.id == task.id)

    @app.patch("/api/projects/{project_id}/tasks/{task_id}", response_model=TaskOut)
    def update_task(
        project_id: int,
        task_id: int,
        body: TaskUpdate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        project = _load_project(db, project_id, current_user.organization_id)
        task = next((t for t in project.tasks if t.id == task_id), None)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found.")

        if body.title is not None:
            task.title = body.title.strip()
        if body.description is not None:
            task.description = body.description.strip()
        if body.priority is not None:
            task.priority = body.priority
        if body.clear_due_date:
            task.due_date = None
        elif body.due_date is not None:
            task.due_date = body.due_date
        if body.labels is not None:
            task.labels = [lbl.strip() for lbl in body.labels if lbl.strip()]
        if body.clear_assignee:
            task.assignee_id = None
        elif body.assignee_id is not None:
            assignee = db.scalar(
                select(User).where(
                    User.id == body.assignee_id,
                    User.organization_id == current_user.organization_id,
                )
            )
            if assignee is None:
                raise HTTPException(status_code=404, detail="Assignee not found.")
            task.assignee_id = body.assignee_id

        _record_activity(db, project.id, current_user.full_name, f"Updated task '{task.title}'")
        db.commit()
        db.expire_all()
        out = _to_project_out(db, _load_project(db, project.id, current_user.organization_id))
        return next(t for t in out.tasks if t.id == task.id)

    @app.post("/api/projects/{project_id}/tasks/{task_id}/move", response_model=TaskOut)
    def move_task(
        project_id: int,
        task_id: int,
        body: TaskMove,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        project = _load_project(db, project_id, current_user.organization_id)
        task = next((t for t in project.tasks if t.id == task_id), None)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found.")
        target_col = next((c for c in project.columns if c.id == body.target_column_id), None)
        if target_col is None:
            raise HTTPException(status_code=404, detail="Target column not found.")

        task.column_id = target_col.id
        task.position = max(0, body.position)
        _record_activity(
            db,
            project.id,
            current_user.full_name,
            f"Moved '{task.title}' to {target_col.name}",
        )
        db.commit()
        db.expire_all()
        out = _to_project_out(db, _load_project(db, project.id, current_user.organization_id))
        return next(t for t in out.tasks if t.id == task.id)

    @app.delete(
        "/api/projects/{project_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT
    )
    def delete_task(
        project_id: int,
        task_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        project = _load_project(db, project_id, current_user.organization_id)
        task = next((t for t in project.tasks if t.id == task_id), None)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found.")
        _record_activity(db, project.id, current_user.full_name, f"Deleted task '{task.title}'")
        db.delete(task)
        db.commit()

    @app.post(
        "/api/projects/{project_id}/tasks/{task_id}/comments",
        response_model=CommentOut,
        status_code=status.HTTP_201_CREATED,
    )
    def add_comment(
        project_id: int,
        task_id: int,
        body: CommentCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        project = _load_project(db, project_id, current_user.organization_id)
        task = next((t for t in project.tasks if t.id == task_id), None)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found.")

        cm = TaskComment(
            task_id=task.id,
            author_id=current_user.id,
            author_name=current_user.full_name,
            body=body.body.strip(),
        )
        db.add(cm)
        _record_activity(db, project.id, current_user.full_name, f"Commented on '{task.title}'")
        db.commit()
        db.refresh(cm)
        return CommentOut(
            id=cm.id,
            task_id=cm.task_id,
            author_id=cm.author_id,
            author_name=cm.author_name,
            body=cm.body,
            created_at=cm.created_at,
        )

    return app


app = create_app()
