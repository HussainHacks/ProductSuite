# BookForge

**BookForge** is a proprietary appointment scheduling and booking application inspired by Microsoft Bookings.

## Features
- Service types with configurable duration and before/after buffers.
- Staff members with explicit IANA timezones and weekly working hours.
- DST-safe UTC slot calculation and server-side double-booking prevention.
- Public customer booking pages (`?book=<organization-slug>`).
- Appointment rescheduling, cancellation, and local notification records.

## Setup
```bash
PYTHONPATH=apps/bookforge/backend .venv/Scripts/uvicorn app.main:app --port 8004
npm run dev --workspace=@productsuite/bookforge-frontend
```

## Tests
- Backend: `pytest apps/bookforge/backend/tests`
- Frontend: `npm run test --workspace=@productsuite/bookforge-frontend`

## Known Limitations
- Notifications are stored as local database records rather than dispatched via external SMTP/SMS.
