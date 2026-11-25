# ProductSuite

A proprietary, source-available productivity software ecosystem comprising seven independent applications built with FastAPI, SQLAlchemy, React, TypeScript, and Tailwind CSS.

> [!IMPORTANT]
> **Proprietary Software — All Rights Reserved.**
> Public source visibility on GitHub does not grant permission to use, modify, distribute, or commercially operate this software. See [LICENSE](./LICENSE) and [LICENSING.md](./LICENSING.md).

## Applications

| # | Product | Directory | Accent | Inspired By | Description |
|---|---|---|---|---|---|
| 1 | **FormForge** | `apps/formforge` | Indigo (`#4F46E5`) | Forms | Form builder with 9 question types, public response pages, summaries, and CSV export. |
| 2 | **TaskForge** | `apps/taskforge` | Sky (`#0284C7`) | To Do | Personal task manager with Today/Upcoming views, custom lists, priorities, recurrence, and preferences. |
| 3 | **PlanForge** | `apps/planforge` | Emerald (`#059669`) | Planner | Project planning with Kanban board, list view, overview, drag-and-drop, labels, comments, and activity log. |
| 4 | **BookForge** | `apps/bookforge` | Violet (`#7C3AED`) | Bookings | Appointment scheduling with services, staff, timezones, buffers, conflict prevention, and public booking pages. |
| 5 | **DataForge** | `apps/dataforge` | Amber (`#D97706`) | Lists | Flexible custom lists with 8 typed fields, sorting, filtering, templates, and CSV import/export. |
| 6 | **BoardForge** | `apps/boardforge` | Rose (`#E11D48`) | Whiteboard | Interactive infinite canvas with sticky notes, shapes, connectors, drawing, undo/redo, and SVG/PNG export. |
| 7 | **StoryForge** | `apps/storyforge` | Teal (`#0D9488`) | Sway | Visual story, report, and presentation builder with shareable public links and PDF/print export. |

## Quick Start (Local Development)

### Prerequisites
- Python 3.12+ (`uv` recommended)
- Node.js 22+ & npm 10+

### Setup
```bash
# 1. Python environment
uv venv --python 3.12 .venv
# Activate (.venv\Scripts\activate on Windows, source .venv/bin/activate on Linux/macOS)
uv pip install -e packages/database -e packages/authentication -e packages/shared -e packages/testing

# 2. Frontend dependencies
npm install
```

### Running Tests & Checks
```bash
# Python lint & tests
ruff check .
pytest

# Frontend typecheck, tests, and builds
npm run typecheck
npm run test
npm run build
```

## Documentation
- [Architecture](./ARCHITECTURE.md)
- [Licensing](./LICENSING.md) | [Commercial License](./COMMERCIAL_LICENSE.md) | [Third-Party Licenses](./THIRD_PARTY_LICENSES.md)
- [Security Policy](./SECURITY.md)
- [Contributing](./CONTRIBUTING.md)
- [Roadmap](./ROADMAP.md)
- [Changelog](./CHANGELOG.md)
- [Development Log](./DEVELOPMENT_LOG.md)
