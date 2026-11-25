import hashlib
import hmac
import os
import secrets
import time
from collections import defaultdict
from datetime import UTC, datetime, timedelta

import jwt

_EPHEMERAL_DEV_SECRET = secrets.token_hex(32)
ALGORITHM = "HS256"
PBKDF2_ITERATIONS = 600_000


def get_secret_key() -> str:
    """Return signing key from environment, or an ephemeral per-process dev key."""
    return os.environ.get("PRODUCTSUITE_SECRET_KEY") or _EPHEMERAL_DEV_SECRET


def hash_password(password: str) -> str:
    """Hash a password using salted PBKDF2-HMAC-SHA256."""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a plaintext password against a stored PBKDF2-HMAC-SHA256 hash."""
    try:
        scheme, iter_str, salt_hex, digest_hex = stored_hash.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        iterations = int(iter_str)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except (ValueError, TypeError):
        return False

    candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(candidate, expected)


def create_access_token(
    *,
    user_id: int,
    organization_id: int,
    email: str,
    role: str = "member",
    expires_minutes: int = 60 * 24,
) -> str:
    """Create a signed JWT access token."""
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "org_id": organization_id,
        "email": email,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expires_minutes)).timestamp()),
    }
    return jwt.encode(payload, get_secret_key(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT access token."""
    return jwt.decode(token, get_secret_key(), algorithms=[ALGORITHM])


class SlidingWindowRateLimiter:
    """Simple in-memory sliding-window rate limiter for public endpoints."""

    def __init__(self, max_requests: int = 60, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        entries = [ts for ts in self._hits[key] if ts > cutoff]
        if len(entries) >= self.max_requests:
            self._hits[key] = entries
            return False
        entries.append(now)
        self._hits[key] = entries
        return True
