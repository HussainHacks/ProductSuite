# ProductSuite Architecture

## Overview

ProductSuite is a monorepo housing seven independent productivity applications sharing a cohesive foundation of authentication, database utilities, UI components, and testing helpers.

## Monorepo Layout

```text
ProductSuite/
  apps/
    formforge/       # Forms & surveys (Port 8001 / 5171)
    taskforge/       # Personal task management (Port 8002 / 5172)
    planforge/       # Project boards & Kanban (Port 8003 / 5173)
    bookforge/       # Appointment scheduling (Port 8004 / 5174)
    dataforge/       # Custom lists & tables (Port 8005 / 5175)
    boardforge/      # Visual whiteboard canvas (Port 8006 / 5176)
    storyforge/      # Interactive stories & presentations (Port 8007 / 5177)
  packages/
    ui/              # Shared React/TypeScript UI primitives, theme, & app switcher
    database/        # Shared SQLAlchemy engine, session, & base model utilities
    authentication/  # Shared password hashing, JWT tokens, auth dependencies, rate limiting
    shared/          # Shared Pydantic schemas, CSV sanitization, audit helpers
    testing/         # Shared pytest fixtures & TestClient factories
  infrastructure/    # Docker Compose & environment templates
  scripts/           # Local dev, test, lint, and build scripts
```

## Technology Stack

- **Frontend:** React 19, Vite 6, TypeScript 5.8, Tailwind CSS 4, Lucide Icons, Vitest + React Testing Library.
- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.x, Pydantic v2, Alembic, Pytest, Ruff.
- **Database:** SQLite for isolated local development and automated testing; PostgreSQL-ready via `DATABASE_URL` and `infrastructure/docker-compose.yml`.

## Design & Isolation Principles

1. **Product Independence:** Each application defines its own domain models, routes, business logic, accent color, and tailored UX—avoiding a generic one-size-fits-all CRUD template.
2. **Tenant Isolation:** Shared authentication binds users to organizations (`organization_id`). Private endpoints filter and authorize strictly by `organization_id` / `user_id`.
3. **Public Surface Discipline:** Public endpoints (FormForge responses, BookForge booking pages, StoryForge published links) are isolated from private data and validate publication status server-side.
4. **No Mandatory External Services:** All seven applications run 100% locally without paid subscriptions or external cloud APIs.
