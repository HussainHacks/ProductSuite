import os
import re
import secrets
from contextlib import asynccontextmanager

from app.models import Story, StoryCard
from app.schemas import (
    CardCreate,
    CardOut,
    PublicStoryOut,
    ReorderCardsRequest,
    StoryCreate,
    StoryOut,
    StoryUpdate,
)
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from productsuite_auth import User, create_auth_dependencies
from productsuite_database import build_engine, build_session_factory, init_db
from productsuite_shared import register_error_handlers
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

_SAFE_URL_RE = re.compile(r"^https?://[^\s]+$", re.IGNORECASE)


def _validate_media_url(card_type: str, url: str) -> str:
    cleaned = url.strip()
    if not cleaned:
        if card_type in ("image", "link"):
            raise HTTPException(
                status_code=422, detail=f"Card type '{card_type}' requires a valid http(s) URL."
            )
        return ""
    if not _SAFE_URL_RE.match(cleaned):
        raise HTTPException(status_code=422, detail="URLs must begin with http:// or https://.")
    return cleaned


def _to_card_out(c: StoryCard) -> CardOut:
    return CardOut(
        id=c.id,
        story_id=c.story_id,
        card_type=c.card_type,  # type: ignore[arg-type]
        title=c.title,
        body=c.body,
        media_url=c.media_url,
        position=c.position,
    )


def _load_story(db: Session, story_id: int, org_id: int) -> Story:
    stmt = (
        select(Story)
        .options(selectinload(Story.cards))
        .where(Story.id == story_id, Story.organization_id == org_id)
    )
    story = db.scalar(stmt)
    if story is None:
        raise HTTPException(status_code=404, detail="Story not found.")
    return story


def _to_story_out(s: Story) -> StoryOut:
    return StoryOut(
        id=s.id,
        title=s.title,
        subtitle=s.subtitle,
        layout=s.layout,  # type: ignore[arg-type]
        is_published=s.is_published,
        public_slug=s.public_slug,
        created_at=s.created_at,
        updated_at=s.updated_at,
        cards=[_to_card_out(c) for c in s.cards],
    )


def create_app(database_url: str | None = None) -> FastAPI:
    db_url = database_url or os.environ.get(
        "PRODUCTSUITE_DATABASE_URL", "sqlite:///./storyforge_local.db"
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

    app = FastAPI(title="StoryForge API", version="0.1.0", lifespan=lifespan)
    cors_origins = os.environ.get(
        "PRODUCTSUITE_CORS_ORIGINS", "http://localhost:5177,http://127.0.0.1:5177"
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
        return {"status": "ok", "service": "storyforge"}

    @app.get("/api/stories", response_model=list[StoryOut])
    def list_stories(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        stmt = (
            select(Story)
            .options(selectinload(Story.cards))
            .where(Story.organization_id == current_user.organization_id)
            .order_by(Story.updated_at.desc())
        )
        return [_to_story_out(s) for s in db.scalars(stmt).all()]

    @app.post("/api/stories", response_model=StoryOut, status_code=status.HTTP_201_CREATED)
    def create_story(
        body: StoryCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        story = Story(
            organization_id=current_user.organization_id,
            created_by_id=current_user.id,
            title=body.title.strip(),
            subtitle=body.subtitle.strip(),
            layout=body.layout,
            public_slug=secrets.token_urlsafe(8),
        )
        db.add(story)
        db.commit()
        return _to_story_out(_load_story(db, story.id, current_user.organization_id))

    @app.patch("/api/stories/{story_id}", response_model=StoryOut)
    def update_story(
        story_id: int,
        body: StoryUpdate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        story = _load_story(db, story_id, current_user.organization_id)
        if body.title is not None:
            story.title = body.title.strip()
        if body.subtitle is not None:
            story.subtitle = body.subtitle.strip()
        if body.layout is not None:
            story.layout = body.layout
        if body.is_published is not None:
            story.is_published = body.is_published
        db.commit()
        return _to_story_out(_load_story(db, story.id, current_user.organization_id))

    @app.delete("/api/stories/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_story(
        story_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        story = _load_story(db, story_id, current_user.organization_id)
        db.delete(story)
        db.commit()

    @app.post(
        "/api/stories/{story_id}/cards",
        response_model=CardOut,
        status_code=status.HTTP_201_CREATED,
    )
    def add_card(
        story_id: int,
        body: CardCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        story = _load_story(db, story_id, current_user.organization_id)
        safe_url = _validate_media_url(body.card_type, body.media_url)
        card = StoryCard(
            story_id=story.id,
            card_type=body.card_type,
            title=body.title.strip(),
            body=body.body.strip(),
            media_url=safe_url,
            position=len(story.cards),
        )
        db.add(card)
        db.commit()
        db.refresh(card)
        return _to_card_out(card)

    @app.delete("/api/stories/{story_id}/cards/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_card(
        story_id: int,
        card_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        story = _load_story(db, story_id, current_user.organization_id)
        card = next((c for c in story.cards if c.id == card_id), None)
        if card is None:
            raise HTTPException(status_code=404, detail="Card not found.")
        db.delete(card)
        db.commit()

    @app.put("/api/stories/{story_id}/cards/reorder", response_model=list[CardOut])
    def reorder_cards(
        story_id: int,
        body: ReorderCardsRequest,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        story = _load_story(db, story_id, current_user.organization_id)
        by_id = {c.id: c for c in story.cards}
        if set(body.card_ids) != set(by_id.keys()) or len(body.card_ids) != len(by_id):
            raise HTTPException(status_code=422, detail="Invalid card_ids list.")
        for idx, cid in enumerate(body.card_ids):
            by_id[cid].position = idx
        db.commit()
        db.expire_all()
        refreshed = _load_story(db, story_id, current_user.organization_id)
        return [_to_card_out(c) for c in refreshed.cards]

    @app.get("/api/public/stories/{slug}", response_model=PublicStoryOut)
    def get_public_story(slug: str, db: Session = Depends(get_db)):
        stmt = (
            select(Story)
            .options(selectinload(Story.cards))
            .where(Story.public_slug == slug, Story.is_published.is_(True))
        )
        story = db.scalar(stmt)
        if story is None:
            raise HTTPException(status_code=404, detail="Published story not found.")
        return PublicStoryOut(
            title=story.title,
            subtitle=story.subtitle,
            layout=story.layout,  # type: ignore[arg-type]
            public_slug=story.public_slug,
            cards=[_to_card_out(c) for c in story.cards],
        )

    return app


app = create_app()
