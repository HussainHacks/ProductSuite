from productsuite_database import Base, build_session_factory
from sqlalchemy.pool import StaticPool


def create_in_memory_db():
    """Create an isolated in-memory SQLite engine and session factory for tests."""
    from sqlalchemy import create_engine, event

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    return engine, build_session_factory(engine)


def register_and_login(
    client,
    *,
    email: str = "owner@example.com",
    password: str = "StrongPass123!",
    full_name: str = "Test Owner",
    organization_name: str = "Acme Workspace",
) -> dict:
    """Register a test user and return auth headers + user payload."""
    resp = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": full_name,
            "organization_name": organization_name,
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    return {
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
        "user": data["user"],
        "token": data["access_token"],
    }
