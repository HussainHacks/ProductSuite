import csv
import io
import os
import re
from contextlib import asynccontextmanager
from datetime import date

from app.models import DataList, FieldType, ListColumn, ListRecord
from app.schemas import (
    ColumnCreate,
    ColumnOut,
    DataListCreate,
    DataListOut,
    RecordOut,
    RecordUpsert,
)
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from productsuite_auth import User, create_auth_dependencies
from productsuite_database import build_engine, build_session_factory, init_db
from productsuite_shared import register_error_handlers, sanitize_csv_cell
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_URL_RE = re.compile(r"^https?://[^\s]+$", re.IGNORECASE)

_TEMPLATES: dict[str, list[dict]] = {
    "issue_tracker": [
        {"name": "Title", "field_type": FieldType.TEXT, "required": True},
        {
            "name": "Status",
            "field_type": FieldType.SINGLE_SELECT,
            "options": ["Open", "In Progress", "Resolved"],
        },
        {
            "name": "Priority",
            "field_type": FieldType.SINGLE_SELECT,
            "options": ["Low", "Medium", "High"],
        },
        {"name": "Reported Date", "field_type": FieldType.DATE},
        {"name": "Resolved", "field_type": FieldType.BOOLEAN},
    ],
    "asset_inventory": [
        {"name": "Asset Name", "field_type": FieldType.TEXT, "required": True},
        {"name": "Serial Number", "field_type": FieldType.TEXT},
        {"name": "Cost", "field_type": FieldType.NUMBER},
        {"name": "Purchase Date", "field_type": FieldType.DATE},
        {"name": "Active", "field_type": FieldType.BOOLEAN},
    ],
    "event_contacts": [
        {"name": "Full Name", "field_type": FieldType.TEXT, "required": True},
        {"name": "Email", "field_type": FieldType.EMAIL, "required": True},
        {"name": "Website", "field_type": FieldType.URL},
        {
            "name": "Tags",
            "field_type": FieldType.MULTIPLE_SELECT,
            "options": ["Speaker", "VIP", "Staff"],
        },
    ],
}


def _slug_key(name: str, existing_keys: set[str]) -> str:
    base = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") or "col"
    candidate = base
    i = 1
    while candidate in existing_keys:
        i += 1
        candidate = f"{base}_{i}"
    return candidate


def _validate_value(col: ListColumn, raw):
    ftype = FieldType(col.field_type)
    empty = raw is None or raw == "" or raw == []
    if empty:
        if col.required:
            raise HTTPException(status_code=422, detail=f"Field '{col.name}' is required.")
        return None

    if ftype == FieldType.TEXT:
        return str(raw).strip()

    if ftype == FieldType.NUMBER:
        try:
            return float(raw)
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=422, detail=f"Field '{col.name}' must be a number."
            ) from exc

    if ftype == FieldType.DATE:
        try:
            date.fromisoformat(str(raw))
        except ValueError as exc:
            raise HTTPException(
                status_code=422, detail=f"Field '{col.name}' must be YYYY-MM-DD."
            ) from exc
        return str(raw)

    if ftype == FieldType.BOOLEAN:
        if isinstance(raw, bool):
            return raw
        if str(raw).lower() in ("true", "1", "yes"):
            return True
        if str(raw).lower() in ("false", "0", "no"):
            return False
        raise HTTPException(status_code=422, detail=f"Field '{col.name}' must be boolean.")

    if ftype == FieldType.EMAIL:
        val = str(raw).strip()
        if not _EMAIL_RE.match(val):
            raise HTTPException(
                status_code=422, detail=f"Field '{col.name}' must be a valid email."
            )
        return val

    if ftype == FieldType.URL:
        val = str(raw).strip()
        if not _URL_RE.match(val):
            raise HTTPException(
                status_code=422, detail=f"Field '{col.name}' must start with http:// or https://."
            )
        return val

    if ftype == FieldType.SINGLE_SELECT:
        val = str(raw)
        if col.options and val not in col.options:
            raise HTTPException(status_code=422, detail=f"Invalid option '{val}' for '{col.name}'.")
        return val

    if ftype == FieldType.MULTIPLE_SELECT:
        vals = (
            raw if isinstance(raw, list) else [s.strip() for s in str(raw).split(";") if s.strip()]
        )
        if col.options and any(v not in col.options for v in vals):
            raise HTTPException(status_code=422, detail=f"Invalid option(s) for '{col.name}'.")
        return vals

    return raw


def _load_list(db: Session, list_id: int, org_id: int) -> DataList:
    stmt = (
        select(DataList)
        .options(selectinload(DataList.columns), selectinload(DataList.records))
        .where(DataList.id == list_id, DataList.organization_id == org_id)
    )
    lst = db.scalar(stmt)
    if lst is None:
        raise HTTPException(status_code=404, detail="List not found.")
    return lst


def _to_list_out(lst: DataList) -> DataListOut:
    return DataListOut(
        id=lst.id,
        name=lst.name,
        description=lst.description,
        columns=[
            ColumnOut(
                id=c.id,
                key=c.key,
                name=c.name,
                field_type=FieldType(c.field_type),
                required=c.required,
                options=c.options or [],
                position=c.position,
            )
            for c in lst.columns
        ],
        record_count=len(lst.records),
    )


def create_app(database_url: str | None = None) -> FastAPI:
    db_url = database_url or os.environ.get(
        "PRODUCTSUITE_DATABASE_URL", "sqlite:///./dataforge_local.db"
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

    app = FastAPI(title="DataForge API", version="0.1.0", lifespan=lifespan)
    cors_origins = os.environ.get(
        "PRODUCTSUITE_CORS_ORIGINS", "http://localhost:5175,http://127.0.0.1:5175"
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
        return {"status": "ok", "service": "dataforge"}

    @app.get("/api/lists", response_model=list[DataListOut])
    def list_data_lists(
        current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
    ):
        stmt = (
            select(DataList)
            .options(selectinload(DataList.columns), selectinload(DataList.records))
            .where(DataList.organization_id == current_user.organization_id)
            .order_by(DataList.created_at.desc())
        )
        return [_to_list_out(lst) for lst in db.scalars(stmt).all()]

    @app.post("/api/lists", response_model=DataListOut, status_code=status.HTTP_201_CREATED)
    def create_data_list(
        body: DataListCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        lst = DataList(
            organization_id=current_user.organization_id,
            name=body.name.strip(),
            description=body.description.strip(),
        )
        db.add(lst)
        db.flush()

        if body.template and body.template in _TEMPLATES:
            existing_keys: set[str] = set()
            for idx, col_def in enumerate(_TEMPLATES[body.template]):
                key = _slug_key(col_def["name"], existing_keys)
                existing_keys.add(key)
                db.add(
                    ListColumn(
                        list_id=lst.id,
                        key=key,
                        name=col_def["name"],
                        field_type=col_def["field_type"].value,
                        required=col_def.get("required", False),
                        options=col_def.get("options", []),
                        position=idx,
                    )
                )

        db.commit()
        return _to_list_out(_load_list(db, lst.id, current_user.organization_id))

    @app.delete("/api/lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_data_list(
        list_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        lst = _load_list(db, list_id, current_user.organization_id)
        db.delete(lst)
        db.commit()

    @app.post(
        "/api/lists/{list_id}/columns",
        response_model=ColumnOut,
        status_code=status.HTTP_201_CREATED,
    )
    def add_column(
        list_id: int,
        body: ColumnCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        lst = _load_list(db, list_id, current_user.organization_id)
        key = _slug_key(body.name, {c.key for c in lst.columns})
        col = ListColumn(
            list_id=lst.id,
            key=key,
            name=body.name.strip(),
            field_type=body.field_type.value,
            required=body.required,
            options=[o.strip() for o in body.options if o.strip()],
            position=len(lst.columns),
        )
        db.add(col)
        db.commit()
        db.refresh(col)
        return ColumnOut(
            id=col.id,
            key=col.key,
            name=col.name,
            field_type=FieldType(col.field_type),
            required=col.required,
            options=col.options or [],
            position=col.position,
        )

    @app.delete("/api/lists/{list_id}/columns/{col_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_column(
        list_id: int,
        col_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        lst = _load_list(db, list_id, current_user.organization_id)
        col = next((c for c in lst.columns if c.id == col_id), None)
        if col is None:
            raise HTTPException(status_code=404, detail="Column not found.")
        db.delete(col)
        db.commit()

    @app.get("/api/lists/{list_id}/records", response_model=list[RecordOut])
    def list_records(
        list_id: int,
        q: str | None = None,
        filter_key: str | None = None,
        filter_val: str | None = None,
        sort_by: str | None = None,
        sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        lst = _load_list(db, list_id, current_user.organization_id)
        records = list(lst.records)

        if q and q.strip():
            needle = q.strip().lower()
            records = [
                r
                for r in records
                if any(needle in str(v).lower() for v in r.values.values() if v is not None)
            ]

        if filter_key and filter_val is not None and filter_val != "":
            records = [
                r
                for r in records
                if str(r.values.get(filter_key, "")).lower() == filter_val.lower()
            ]

        if sort_by:
            records.sort(
                key=lambda r: str(r.values.get(sort_by, "")).lower(),
                reverse=(sort_dir == "desc"),
            )

        return [
            RecordOut(
                id=r.id,
                list_id=r.list_id,
                values=r.values,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
            for r in records
        ]

    @app.post(
        "/api/lists/{list_id}/records",
        response_model=RecordOut,
        status_code=status.HTTP_201_CREATED,
    )
    def create_record(
        list_id: int,
        body: RecordUpsert,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        lst = _load_list(db, list_id, current_user.organization_id)
        validated: dict[str, object] = {}
        for col in lst.columns:
            val = _validate_value(col, body.values.get(col.key))
            if val is not None:
                validated[col.key] = val

        rec = ListRecord(list_id=lst.id, values=validated)
        db.add(rec)
        db.commit()
        db.refresh(rec)
        return RecordOut(
            id=rec.id,
            list_id=rec.list_id,
            values=rec.values,
            created_at=rec.created_at,
            updated_at=rec.updated_at,
        )

    @app.patch("/api/lists/{list_id}/records/{record_id}", response_model=RecordOut)
    def update_record(
        list_id: int,
        record_id: int,
        body: RecordUpsert,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        lst = _load_list(db, list_id, current_user.organization_id)
        rec = next((r for r in lst.records if r.id == record_id), None)
        if rec is None:
            raise HTTPException(status_code=404, detail="Record not found.")

        merged = dict(rec.values)
        merged.update(body.values)
        validated: dict[str, object] = {}
        for col in lst.columns:
            val = _validate_value(col, merged.get(col.key))
            if val is not None:
                validated[col.key] = val
        rec.values = validated
        db.commit()
        db.refresh(rec)
        return RecordOut(
            id=rec.id,
            list_id=rec.list_id,
            values=rec.values,
            created_at=rec.created_at,
            updated_at=rec.updated_at,
        )

    @app.delete("/api/lists/{list_id}/records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_record(
        list_id: int,
        record_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        lst = _load_list(db, list_id, current_user.organization_id)
        rec = next((r for r in lst.records if r.id == record_id), None)
        if rec is None:
            raise HTTPException(status_code=404, detail="Record not found.")
        db.delete(rec)
        db.commit()

    @app.get("/api/lists/{list_id}/export.csv")
    def export_csv(
        list_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        lst = _load_list(db, list_id, current_user.organization_id)
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([sanitize_csv_cell(c.name) for c in lst.columns])
        for rec in lst.records:
            row = []
            for c in lst.columns:
                val = rec.values.get(c.key, "")
                if isinstance(val, list):
                    val = "; ".join(str(v) for v in val)
                row.append(sanitize_csv_cell(val))
            writer.writerow(row)
        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="list-{lst.id}.csv"'},
        )

    @app.post("/api/lists/{list_id}/import.csv")
    async def import_csv(
        list_id: int,
        file: UploadFile = File(...),
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        lst = _load_list(db, list_id, current_user.organization_id)
        raw_bytes = await file.read()
        text = raw_bytes.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        col_by_name = {c.name.lower(): c for c in lst.columns}
        col_by_key = {c.key.lower(): c for c in lst.columns}

        imported = 0
        for row in reader:
            row_values: dict[str, object] = {}
            for header, cell_val in row.items():
                if not header:
                    continue
                col = col_by_name.get(header.strip().lower()) or col_by_key.get(
                    header.strip().lower()
                )
                if col:
                    row_values[col.key] = cell_val
            validated: dict[str, object] = {}
            for col in lst.columns:
                val = _validate_value(col, row_values.get(col.key))
                if val is not None:
                    validated[col.key] = val
            db.add(ListRecord(list_id=lst.id, values=validated))
            imported += 1

        db.commit()
        return {"imported": imported}

    return app


app = create_app()
