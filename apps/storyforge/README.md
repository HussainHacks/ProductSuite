# StoryForge

**StoryForge** is a proprietary interactive story, report, and presentation builder inspired by Microsoft Sway.

## Features
- Content cards: Heading, Paragraph, Callout, Image, and Link.
- Three responsive layouts: Vertical Scroll, Horizontal Slides, Editorial Grid.
- Card reordering and live preview.
- Public sharing via `?story=<public_slug>` without requiring viewer accounts.
- Print / PDF export with print-optimized styles.

## Setup
```bash
PYTHONPATH=apps/storyforge/backend .venv/Scripts/uvicorn app.main:app --port 8007
npm run dev --workspace=@productsuite/storyforge-frontend
```

## Tests
- Backend: `pytest apps/storyforge/backend/tests`
- Frontend: `npm run test --workspace=@productsuite/storyforge-frontend`

## Known Limitations
- Media assets use validated external `http(s)://` URLs in v0.1.0; local binary file uploads are planned for a future release.
