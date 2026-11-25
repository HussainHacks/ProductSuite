# PlanForge

**PlanForge** is a proprietary project planning and Kanban board application inspired by Microsoft Planner.

## Features
- Multi-project management with customizable board columns.
- Kanban board (with drag-and-drop), List view, and Project Overview with completion progress.
- Task assignees, priorities, due dates, labels, descriptions, and comments.
- Automatic project activity history.
- Search and priority filtering.

## Setup
```bash
PYTHONPATH=apps/planforge/backend .venv/Scripts/uvicorn app.main:app --port 8003
npm run dev --workspace=@productsuite/planforge-frontend
```

## Tests
- Backend: `pytest apps/planforge/backend/tests`
- Frontend: `npm run test --workspace=@productsuite/planforge-frontend`

## Known Limitations
- Board updates use request/response polling rather than WebSocket push in v0.1.0.
