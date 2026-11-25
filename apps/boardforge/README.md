# BoardForge

**BoardForge** is a proprietary visual whiteboard application inspired by Microsoft Whiteboard.

## Features
- Infinite SVG canvas with pan and zoom.
- Sticky notes, text labels, rectangles, circles, connectors, and freehand drawing.
- Move, edit text, recolor, and delete elements.
- Client-side Undo/Redo history stack.
- Board persistence with optimistic version tracking and SVG export.

## Setup
```bash
PYTHONPATH=apps/boardforge/backend .venv/Scripts/uvicorn app.main:app --port 8006
npm run dev --workspace=@productsuite/boardforge-frontend
```

## Tests
- Backend: `pytest apps/boardforge/backend/tests`
- Frontend: `npm run test --workspace=@productsuite/boardforge-frontend`

## Known Limitations
- Single-user canvas in v0.1.0; real-time multi-user WebSocket sync is planned for a future release.
