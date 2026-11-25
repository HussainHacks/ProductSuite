# TaskForge

**TaskForge** is a proprietary personal task manager inspired by Microsoft To Do.

## Features
- Smart views: Today, Upcoming, All Tasks, Completed History.
- Custom task lists with task counts.
- Priorities (`low`, `medium`, `high`, `urgent`), due dates, and notes.
- Recurring tasks (`daily`, `weekly`, `monthly`) that automatically schedule the next occurrence upon completion.
- Search, priority filtering, and persistent user preferences.

## Setup
```bash
PYTHONPATH=apps/taskforge/backend .venv/Scripts/uvicorn app.main:app --port 8002
npm run dev --workspace=@productsuite/taskforge-frontend
```

## Tests
- Backend: `pytest apps/taskforge/backend/tests`
- Frontend: `npm run test --workspace=@productsuite/taskforge-frontend`

## Known Limitations
- Subtasks and file attachments are planned for a future release.
