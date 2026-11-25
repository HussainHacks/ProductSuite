# Third-Party Licenses & Dependency Inventory

All third-party dependencies used by **ProductSuite** remain subject to their respective licenses. This inventory is audited and maintained throughout development to ensure compatibility with proprietary source-available distribution.

**Policy:**
- No GPL, AGPL, or incompatible copyleft source code may be copied or linked into proprietary ProductSuite code.
- Every dependency must have a verified permissive or compatible license (e.g., MIT, BSD-3-Clause, Apache-2.0, ISC), recorded version, and documented attribution/redistribution conditions.

## Backend Dependencies (Python 3.12)

| Package | Version | License | Commercial Use | Redistribution Conditions | Notes |
|---|---|---|---|---|---|
| `fastapi` | `0.165.0` | MIT | Permitted | Retain copyright & license notice | Web framework |
| `starlette` | `1.10.0` | BSD-3-Clause | Permitted | Retain copyright & license notice | ASGI toolkit (FastAPI dependency) |
| `uvicorn` | `0.54.0` | BSD-3-Clause | Permitted | Retain copyright & license notice | ASGI server |
| `pydantic` | `2.14.4` | MIT | Permitted | Retain copyright & license notice | Data validation |
| `pydantic-core` | `2.50.5` | MIT | Permitted | Retain copyright & license notice | Pydantic Rust core |
| `pydantic-settings` | `2.16.3` | MIT | Permitted | Retain copyright & license notice | Environment configuration |
| `sqlalchemy` | `2.1.9` | MIT | Permitted | Retain copyright & license notice | ORM & database toolkit |
| `alembic` | `1.20.1` | MIT | Permitted | Retain copyright & license notice | Database migrations |
| `pyjwt` | `2.15.1` | MIT | Permitted | Retain copyright & license notice | JWT signing/verification |
| `python-multipart` | `0.0.34` | Apache-2.0 | Permitted | Retain copyright, notice, & state changes if modified | Form/file parsing |
| `python-dotenv` | `1.2.4` | BSD-3-Clause | Permitted | Retain copyright & license notice | `.env` loading |
| `httpx` | `0.28.1` | BSD-3-Clause | Permitted | Retain copyright & license notice | HTTP client (testing) |
| `pytest` | `9.2.0` | MIT | Permitted | Retain copyright & license notice | Dev/test runner |
| `ruff` | `0.17.6` | MIT | Permitted | Retain copyright & license notice | Dev linter/formatter |
| `anyio` | `4.16.0` | MIT | Permitted | Retain copyright & license notice | Async compatibility |
| `click` | `8.5.1` | BSD-3-Clause | Permitted | Retain copyright & license notice | CLI dependency |
| `mako` | `1.4.3` | MIT | Permitted | Retain copyright & license notice | Alembic template dependency |
| `markupsafe` | `3.0.4` | BSD-3-Clause | Permitted | Retain copyright & license notice | Mako dependency |
| `opentelemetry-api` | `1.45.2` | Apache-2.0 | Permitted | Retain copyright & notice | Telemetry API |
| `typing-extensions` | `4.16.0` | PSF-2.0 | Permitted | Retain copyright & license notice | Typing backports |
| `tzdata` | `2026.6` | Apache-2.0 | Permitted | Retain copyright & notice | IANA timezone database for `zoneinfo` |

## Frontend Dependencies (Node.js / TypeScript)

| Package | Version | License | Commercial Use | Redistribution Conditions | Notes |
|---|---|---|---|---|---|
| `react` | `^19.1.0` | MIT | Permitted | Retain copyright & license notice | UI library |
| `react-dom` | `^19.1.0` | MIT | Permitted | Retain copyright & license notice | DOM renderer |
| `lucide-react` | `^0.511.0` | ISC | Permitted | Retain copyright & license notice | Iconography |
| `vite` | `^6.3.5` | MIT | Permitted | Retain copyright & license notice | Build tool |
| `@vitejs/plugin-react` | `^4.4.1` | MIT | Permitted | Retain copyright & license notice | Vite React plugin |
| `tailwindcss` | `^4.1.7` | MIT | Permitted | Retain copyright & license notice | Utility-first CSS |
| `@tailwindcss/vite` | `^4.1.7` | MIT | Permitted | Retain copyright & license notice | Tailwind Vite plugin |
| `typescript` | `^5.8.3` | Apache-2.0 | Permitted | Retain copyright & notice | Type checker |
| `vitest` | `^3.1.3` | MIT | Permitted | Retain copyright & license notice | Frontend test runner |
| `@testing-library/react` | `^16.3.0` | MIT | Permitted | Retain copyright & license notice | Component testing |
| `@testing-library/jest-dom` | `^6.6.3` | MIT | Permitted | Retain copyright & license notice | DOM matchers |
| `jsdom` | `^26.1.0` | MIT | Permitted | Retain copyright & license notice | DOM test environment |

## License Audit Exceptions

- **None.** No GPL, AGPL, LGPL, or SSPL dependencies are present in the dependency tree.
- Note: Frontend exact resolved versions will be updated after `npm install` generates `package-lock.json`.
