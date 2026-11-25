# FormForge

**FormForge** is a proprietary form builder and response collection application inspired by Microsoft Forms.

## Purpose
Create, publish, and share custom forms with anonymous respondents, view aggregated summaries, and export results to CSV.

## Features
- 9 question types: Short Text, Long Text, Single Choice, Multiple Choice, Dropdown, Rating (1–5), Date, Number, Email.
- Required question validation (client and server).
- Question reordering and live form preview.
- Public/draft publication control with unique shareable links.
- Response summaries and CSV export with formula-injection sanitization.
- Organization-level tenant isolation.

## Setup
```bash
# Backend (from ProductSuite root)
PYTHONPATH=apps/formforge/backend .venv/Scripts/uvicorn app.main:app --port 8001

# Frontend
npm run dev --workspace=@productsuite/formforge-frontend
```

## Configuration
- `PRODUCTSUITE_DATABASE_URL` (default: `sqlite:///./formforge_local.db`)
- `PRODUCTSUITE_SECRET_KEY` (JWT signing secret)
- `VITE_API_URL` (default: `http://localhost:8001`)

## Tests
- Backend: `pytest apps/formforge/backend/tests`
- Frontend: `npm run test --workspace=@productsuite/formforge-frontend`

## Known Limitations
- File-upload question type is not included in v0.1.0.
- Rate limiting uses in-memory storage (single-process).
