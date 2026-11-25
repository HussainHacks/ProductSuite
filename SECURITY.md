# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in **ProductSuite**, please report it responsibly. Do **not** open a public GitHub issue for security vulnerabilities.

- **Security Contact:** `[SECURITY_CONTACT_EMAIL]`
- **PGP Key / Advisory Process:** Contact the repository owner directly via `[SECURITY_CONTACT_EMAIL]` with a detailed description, reproduction steps, and affected application(s).

## Security Architecture

ProductSuite enforces the following security controls across all seven applications:

1. **Password Hashing:** Salted PBKDF2-HMAC-SHA256 (600,000 iterations) with constant-time comparison (`hmac.compare_digest`).
2. **Authentication & Sessions:** Signed HMAC-SHA256 JWT tokens with configurable expiration and environment-supplied signing secrets (`PRODUCTSUITE_SECRET_KEY`). No hardcoded production secrets.
3. **Authorization & Tenant Isolation:** Every private API endpoint enforces server-side user and organization ownership checks. Users cannot access another organization's private data.
4. **Public Sharing Boundaries:** Public endpoints (e.g., FormForge form submission, BookForge booking pages, StoryForge published stories) expose *only* explicitly published items and never leak private owner/organization metadata.
5. **Input Validation & Injection Prevention:** Strict Pydantic v2 schema validation, SQLAlchemy parameterized queries, CSV formula injection sanitization (`=`, `+`, `-`, `@` prefix escaping), and safe file-upload validation.
6. **Rate Limiting:** Sliding-window rate limiting on public submission/booking endpoints.
7. **Secure Error Handling:** Production error responses omit internal stack traces and database details.
