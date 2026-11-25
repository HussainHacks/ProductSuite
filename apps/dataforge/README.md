# DataForge

**DataForge** is a proprietary structured custom lists and table application inspired by Microsoft Lists.

## Features
- Flexible JSON-backed record storage (no dynamic DDL tables).
- 8 field types: Text, Number, Date, Boolean, Single Select, Multiple Select, Email, URL.
- Built-in templates: Issue Tracker, Asset Inventory, Event Contacts.
- Search, column sorting, filtering, CSV import, and CSV export with formula-injection sanitization.

## Setup
```bash
PYTHONPATH=apps/dataforge/backend .venv/Scripts/uvicorn app.main:app --port 8005
npm run dev --workspace=@productsuite/dataforge-frontend
```

## Tests
- Backend: `pytest apps/dataforge/backend/tests`
- Frontend: `npm run test --workspace=@productsuite/dataforge-frontend`

## Known Limitations
- Gallery and calendar views are planned for a future release; v0.1.0 focuses on Table view.
