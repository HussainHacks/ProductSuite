import os
from contextlib import asynccontextmanager

from app.models import Whiteboard
from app.schemas import BoardCreate, BoardElement, BoardOut, BoardSave
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from productsuite_auth import User, create_auth_dependencies
from productsuite_database import build_engine, build_session_factory, init_db
from productsuite_shared import register_error_handlers
from sqlalchemy import select
from sqlalchemy.orm import Session


def _to_board_out(b: Whiteboard) -> BoardOut:
    return BoardOut(
        id=b.id,
        title=b.title,
        version=b.version,
        viewport_x=b.viewport_x,
        viewport_y=b.viewport_y,
        viewport_zoom=b.viewport_zoom,
        elements=[BoardElement(**el) for el in (b.elements or [])],
        created_at=b.created_at,
        updated_at=b.updated_at,
    )


def create_app(database_url: str | None = None) -> FastAPI:
    db_url = database_url or os.environ.get(
        "PRODUCTSUITE_DATABASE_URL", "sqlite:///./boardforge_local.db"
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

    app = FastAPI(title="BoardForge API", version="0.1.0", lifespan=lifespan)
    cors_origins = os.environ.get(
        "PRODUCTSUITE_CORS_ORIGINS", "http://localhost:5176,http://127.0.0.1:5176"
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
        return {"status": "ok", "service": "boardforge"}

    @app.get("/api/boards", response_model=list[BoardOut])
    def list_boards(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        boards = db.scalars(
            select(Whiteboard)
            .where(Whiteboard.organization_id == current_user.organization_id)
            .order_by(Whiteboard.updated_at.desc())
        ).all()
        return [_to_board_out(b) for b in boards]

    @app.post("/api/boards", response_model=BoardOut, status_code=status.HTTP_201_CREATED)
    def create_board(
        body: BoardCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        board = Whiteboard(
            organization_id=current_user.organization_id,
            created_by_id=current_user.id,
            title=body.title.strip(),
            elements=[],
        )
        db.add(board)
        db.commit()
        db.refresh(board)
        return _to_board_out(board)

    @app.get("/api/boards/{board_id}", response_model=BoardOut)
    def get_board(
        board_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        board = db.scalar(
            select(Whiteboard).where(
                Whiteboard.id == board_id,
                Whiteboard.organization_id == current_user.organization_id,
            )
        )
        if board is None:
            raise HTTPException(status_code=404, detail="Board not found.")
        return _to_board_out(board)

    @app.put("/api/boards/{board_id}", response_model=BoardOut)
    def save_board(
        board_id: int,
        body: BoardSave,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        board = db.scalar(
            select(Whiteboard).where(
                Whiteboard.id == board_id,
                Whiteboard.organization_id == current_user.organization_id,
            )
        )
        if board is None:
            raise HTTPException(status_code=404, detail="Board not found.")

        if body.title is not None:
            board.title = body.title.strip()
        board.viewport_x = body.viewport_x
        board.viewport_y = body.viewport_y
        board.viewport_zoom = body.viewport_zoom
        board.elements = [el.model_dump() for el in body.elements]
        board.version += 1
        db.commit()
        db.refresh(board)
        return _to_board_out(board)

    @app.delete("/api/boards/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_board(
        board_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        board = db.scalar(
            select(Whiteboard).where(
                Whiteboard.id == board_id,
                Whiteboard.organization_id == current_user.organization_id,
            )
        )
        if board is None:
            raise HTTPException(status_code=404, detail="Board not found.")
        db.delete(board)
        db.commit()

    return app


app = create_app()
