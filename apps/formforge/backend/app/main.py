import csv
import io
import os
import re
import secrets
from collections import Counter
from contextlib import asynccontextmanager
from datetime import date

from app.models import Form, FormQuestion, FormResponse, QuestionType
from app.schemas import (
    FormCreate,
    FormOut,
    FormResponseOut,
    FormSummaryOut,
    FormUpdate,
    PublicFormOut,
    QuestionCreate,
    QuestionOut,
    QuestionSummary,
    QuestionUpdate,
    ReorderQuestionsRequest,
    SubmitResponseRequest,
)
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from productsuite_auth import SlidingWindowRateLimiter, User, create_auth_dependencies
from productsuite_database import build_engine, build_session_factory, init_db
from productsuite_shared import register_error_handlers, sanitize_csv_cell
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

_CHOICE_TYPES = {
    QuestionType.SINGLE_CHOICE,
    QuestionType.MULTIPLE_CHOICE,
    QuestionType.DROPDOWN,
}
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_public_submit_limiter = SlidingWindowRateLimiter(max_requests=30, window_seconds=60)


def _to_question_out(q: FormQuestion) -> QuestionOut:
    return QuestionOut(
        id=q.id,
        form_id=q.form_id,
        prompt=q.prompt,
        question_type=QuestionType(q.question_type),
        required=q.required,
        options=q.options or [],
        position=q.position,
    )


def _to_form_out(form: Form) -> FormOut:
    return FormOut(
        id=form.id,
        title=form.title,
        description=form.description,
        is_published=form.is_published,
        public_slug=form.public_slug,
        created_at=form.created_at,
        updated_at=form.updated_at,
        questions=[_to_question_out(q) for q in form.questions],
        response_count=len(form.responses),
    )


def _get_owned_form(db: Session, form_id: int, org_id: int) -> Form:
    stmt = (
        select(Form)
        .options(selectinload(Form.questions), selectinload(Form.responses))
        .where(Form.id == form_id, Form.organization_id == org_id)
    )
    form = db.scalar(stmt)
    if form is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found.")
    return form


def _validate_and_normalize_answer(question: FormQuestion, raw_value):
    qtype = QuestionType(question.question_type)
    is_empty = raw_value is None or raw_value == "" or raw_value == []

    if is_empty:
        if question.required:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Question '{question.prompt}' is required.",
            )
        return None

    if qtype in (QuestionType.SHORT_TEXT, QuestionType.LONG_TEXT):
        return str(raw_value).strip()

    if qtype == QuestionType.EMAIL:
        text = str(raw_value).strip()
        if not _EMAIL_RE.match(text):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Question '{question.prompt}' requires a valid email address.",
            )
        return text

    if qtype == QuestionType.NUMBER:
        try:
            return float(raw_value)
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Question '{question.prompt}' requires a valid number.",
            ) from exc

    if qtype == QuestionType.RATING:
        try:
            rating = int(raw_value)
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Question '{question.prompt}' requires an integer rating (1-5).",
            ) from exc
        if rating < 1 or rating > 5:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Question '{question.prompt}' rating must be between 1 and 5.",
            )
        return rating

    if qtype == QuestionType.DATE:
        try:
            date.fromisoformat(str(raw_value))
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Question '{question.prompt}' requires a valid ISO date (YYYY-MM-DD).",
            ) from exc
        return str(raw_value)

    if qtype in (QuestionType.SINGLE_CHOICE, QuestionType.DROPDOWN):
        val = str(raw_value)
        if question.options and val not in question.options:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid option '{val}' for '{question.prompt}'.",
            )
        return val

    if qtype == QuestionType.MULTIPLE_CHOICE:
        if not isinstance(raw_value, list):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Question '{question.prompt}' expects a list of selections.",
            )
        vals = [str(v) for v in raw_value]
        if question.options:
            invalid = [v for v in vals if v not in question.options]
            if invalid:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Invalid option(s) {invalid} for '{question.prompt}'.",
                )
        return vals

    return raw_value


def create_app(database_url: str | None = None) -> FastAPI:
    db_url = database_url or os.environ.get(
        "PRODUCTSUITE_DATABASE_URL", "sqlite:///./formforge_local.db"
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

    app = FastAPI(title="FormForge API", version="0.1.0", lifespan=lifespan)
    cors_origins = os.environ.get(
        "PRODUCTSUITE_CORS_ORIGINS", "http://localhost:5171,http://127.0.0.1:5171"
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
        return {"status": "ok", "service": "formforge"}

    @app.get("/api/forms", response_model=list[FormOut])
    def list_forms(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        stmt = (
            select(Form)
            .options(selectinload(Form.questions), selectinload(Form.responses))
            .where(Form.organization_id == current_user.organization_id)
            .order_by(Form.updated_at.desc())
        )
        return [_to_form_out(f) for f in db.scalars(stmt).all()]

    @app.post("/api/forms", response_model=FormOut, status_code=status.HTTP_201_CREATED)
    def create_form(
        body: FormCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        form = Form(
            organization_id=current_user.organization_id,
            created_by_id=current_user.id,
            title=body.title.strip(),
            description=body.description.strip(),
            public_slug=secrets.token_urlsafe(8),
        )
        db.add(form)
        db.commit()
        return _to_form_out(_get_owned_form(db, form.id, current_user.organization_id))

    @app.get("/api/forms/{form_id}", response_model=FormOut)
    def get_form(
        form_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        return _to_form_out(_get_owned_form(db, form_id, current_user.organization_id))

    @app.patch("/api/forms/{form_id}", response_model=FormOut)
    def update_form(
        form_id: int,
        body: FormUpdate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        form = _get_owned_form(db, form_id, current_user.organization_id)
        if body.title is not None:
            form.title = body.title.strip()
        if body.description is not None:
            form.description = body.description.strip()
        if body.is_published is not None:
            form.is_published = body.is_published
        db.commit()
        return _to_form_out(_get_owned_form(db, form.id, current_user.organization_id))

    @app.delete("/api/forms/{form_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_form(
        form_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        form = _get_owned_form(db, form_id, current_user.organization_id)
        db.delete(form)
        db.commit()

    @app.post(
        "/api/forms/{form_id}/questions",
        response_model=QuestionOut,
        status_code=status.HTTP_201_CREATED,
    )
    def add_question(
        form_id: int,
        body: QuestionCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        form = _get_owned_form(db, form_id, current_user.organization_id)
        if body.question_type in _CHOICE_TYPES and len([o for o in body.options if o.strip()]) < 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Choice questions require at least one non-empty option.",
            )
        next_pos = len(form.questions)
        q = FormQuestion(
            form_id=form.id,
            prompt=body.prompt.strip(),
            question_type=body.question_type.value,
            required=body.required,
            options=[o.strip() for o in body.options if o.strip()],
            position=next_pos,
        )
        db.add(q)
        db.commit()
        db.refresh(q)
        return _to_question_out(q)

    @app.patch("/api/forms/{form_id}/questions/{question_id}", response_model=QuestionOut)
    def update_question(
        form_id: int,
        question_id: int,
        body: QuestionUpdate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        form = _get_owned_form(db, form_id, current_user.organization_id)
        q = next((item for item in form.questions if item.id == question_id), None)
        if q is None:
            raise HTTPException(status_code=404, detail="Question not found.")
        if body.prompt is not None:
            q.prompt = body.prompt.strip()
        if body.question_type is not None:
            q.question_type = body.question_type.value
        if body.required is not None:
            q.required = body.required
        if body.options is not None:
            q.options = [o.strip() for o in body.options if o.strip()]
        db.commit()
        db.refresh(q)
        return _to_question_out(q)

    @app.delete(
        "/api/forms/{form_id}/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT
    )
    def delete_question(
        form_id: int,
        question_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        form = _get_owned_form(db, form_id, current_user.organization_id)
        q = next((item for item in form.questions if item.id == question_id), None)
        if q is None:
            raise HTTPException(status_code=404, detail="Question not found.")
        db.delete(q)
        db.flush()
        remaining = [item for item in form.questions if item.id != question_id]
        for idx, item in enumerate(remaining):
            item.position = idx
        db.commit()

    @app.put("/api/forms/{form_id}/questions/reorder", response_model=list[QuestionOut])
    def reorder_questions(
        form_id: int,
        body: ReorderQuestionsRequest,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        form = _get_owned_form(db, form_id, current_user.organization_id)
        by_id = {q.id: q for q in form.questions}
        if set(body.question_ids) != set(by_id.keys()) or len(body.question_ids) != len(by_id):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="question_ids must contain every question ID of the form exactly once.",
            )
        for idx, qid in enumerate(body.question_ids):
            by_id[qid].position = idx
        db.commit()
        db.expire_all()
        refreshed = _get_owned_form(db, form_id, current_user.organization_id)
        return [_to_question_out(q) for q in refreshed.questions]

    @app.get("/api/forms/{form_id}/responses", response_model=list[FormResponseOut])
    def list_responses(
        form_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        form = _get_owned_form(db, form_id, current_user.organization_id)
        return [
            FormResponseOut(
                id=r.id,
                form_id=r.form_id,
                respondent_label=r.respondent_label,
                answers=r.answers,
                created_at=r.created_at,
            )
            for r in form.responses
        ]

    @app.get("/api/forms/{form_id}/summary", response_model=FormSummaryOut)
    def get_summary(
        form_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        form = _get_owned_form(db, form_id, current_user.organization_id)
        summaries: list[QuestionSummary] = []
        for q in form.questions:
            key = str(q.id)
            qtype = QuestionType(q.question_type)
            values = [r.answers.get(key) for r in form.responses if r.answers.get(key) is not None]
            breakdown: dict[str, int] = {}
            avg_rating: float | None = None
            samples: list[str] = []

            if qtype in _CHOICE_TYPES:
                counter: Counter[str] = Counter()
                for val in values:
                    if isinstance(val, list):
                        counter.update(str(v) for v in val)
                    else:
                        counter[str(val)] += 1
                breakdown = dict(counter)
            elif qtype == QuestionType.RATING:
                nums = [int(v) for v in values if isinstance(v, (int, float))]
                if nums:
                    avg_rating = round(sum(nums) / len(nums), 2)
                breakdown = dict(Counter(str(n) for n in nums))
            else:
                samples = [str(v) for v in values[:10]]

            summaries.append(
                QuestionSummary(
                    question_id=q.id,
                    prompt=q.prompt,
                    question_type=qtype,
                    total_answers=len(values),
                    breakdown=breakdown,
                    average_rating=avg_rating,
                    sample_values=samples,
                )
            )

        return FormSummaryOut(
            form_id=form.id,
            title=form.title,
            total_responses=len(form.responses),
            questions=summaries,
        )

    @app.get("/api/forms/{form_id}/export.csv")
    def export_responses_csv(
        form_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        form = _get_owned_form(db, form_id, current_user.organization_id)
        output = io.StringIO()
        writer = csv.writer(output)
        headers = ["Response ID", "Submitted At", "Respondent"] + [q.prompt for q in form.questions]
        writer.writerow([sanitize_csv_cell(h) for h in headers])

        for r in form.responses:
            row = [r.id, r.created_at.isoformat(), r.respondent_label]
            for q in form.questions:
                val = r.answers.get(str(q.id), "")
                if isinstance(val, list):
                    val = "; ".join(str(item) for item in val)
                row.append(val)
            writer.writerow([sanitize_csv_cell(cell) for cell in row])

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="form-{form.id}-responses.csv"'},
        )

    @app.get("/api/public/forms/{slug}", response_model=PublicFormOut)
    def get_public_form(slug: str, db: Session = Depends(get_db)):
        stmt = (
            select(Form)
            .options(selectinload(Form.questions))
            .where(Form.public_slug == slug, Form.is_published.is_(True))
        )
        form = db.scalar(stmt)
        if form is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Published form not found.",
            )
        return PublicFormOut(
            title=form.title,
            description=form.description,
            public_slug=form.public_slug,
            questions=[_to_question_out(q) for q in form.questions],
        )

    @app.post(
        "/api/public/forms/{slug}/submit",
        response_model=FormResponseOut,
        status_code=status.HTTP_201_CREATED,
    )
    def submit_public_form(
        slug: str,
        body: SubmitResponseRequest,
        request: Request,
        db: Session = Depends(get_db),
    ):
        client_ip = request.client.host if request.client else "unknown"
        if not _public_submit_limiter.allow(f"submit:{slug}:{client_ip}"):
            raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again shortly.")

        stmt = (
            select(Form)
            .options(selectinload(Form.questions))
            .where(Form.public_slug == slug, Form.is_published.is_(True))
        )
        form = db.scalar(stmt)
        if form is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Published form not found.",
            )

        normalized_answers: dict[str, object] = {}
        for q in form.questions:
            raw = body.answers.get(str(q.id))
            val = _validate_and_normalize_answer(q, raw)
            if val is not None:
                normalized_answers[str(q.id)] = val

        resp = FormResponse(
            form_id=form.id,
            respondent_label=body.respondent_label.strip() or "Anonymous",
            answers=normalized_answers,
        )
        db.add(resp)
        db.commit()
        db.refresh(resp)
        return FormResponseOut(
            id=resp.id,
            form_id=resp.form_id,
            respondent_label=resp.respondent_label,
            answers=resp.answers,
            created_at=resp.created_at,
        )

    return app


app = create_app()
