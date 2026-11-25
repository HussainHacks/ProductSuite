# ProductSuite Roadmap

## Phase 0: Foundation (Completed)
- Monorepo structure, proprietary licensing, dependency audit, shared Python & TypeScript packages, Docker Compose template, and test/lint tooling.

## Phases 1–7: Core Applications
1. **FormForge** — Form builder, 9 question types, publishing, anonymous public responses, summaries, CSV export.
2. **TaskForge** — Personal task manager, lists, priorities, due dates, recurrence, search/filters, persistent preferences.
3. **PlanForge** — Project boards, Kanban + List + Overview views, drag-and-drop, assignees, labels, comments, activity log.
4. **BookForge** — Services, staff, working hours, buffers, timezone-aware slot generation, double-booking prevention, local notification records.
5. **DataForge** — Flexible custom lists (EAV/JSON schema-driven without dynamic DDL), 8 field types, sorting, filtering, templates, CSV import/export.
6. **BoardForge** — Infinite pan/zoom canvas, sticky notes, text, shapes, connectors, freehand drawing, undo/redo, persistence, PNG/SVG export.
7. **StoryForge** — Interactive visual story/report/presentation editor, content cards, reordering, layouts, shareable public links, print/PDF export.

## Phase 8: Ecosystem Integration
- Unified navigation switcher across all 7 apps, shared auth verification, cross-app build & test suite.

## Future Enhancements (Post-v1.0)
- Real-time WebSocket collaboration for BoardForge and PlanForge.
- Optional SMTP/SMS provider adapters for BookForge notifications.
- SAML/OIDC enterprise SSO adapter in `packages/authentication`.
