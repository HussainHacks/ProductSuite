from fastapi import FastAPI
from fastapi.testclient import TestClient
from productsuite_auth import create_auth_dependencies, hash_password, verify_password
from productsuite_shared import sanitize_csv_cell
from productsuite_testing import create_in_memory_db, register_and_login


def test_password_hashing_and_verification():
    hashed = hash_password("MySecurePass!23")
    assert hashed.startswith("pbkdf2_sha256$")
    assert verify_password("MySecurePass!23", hashed) is True
    assert verify_password("wrong", hashed) is False


def test_csv_formula_sanitization():
    assert sanitize_csv_cell("=CMD()") == "'=CMD()"
    assert sanitize_csv_cell("+1+1") == "'+1+1"
    assert sanitize_csv_cell("-2") == "'-2"
    assert sanitize_csv_cell("@SUM(A1)") == "'@SUM(A1)"
    assert sanitize_csv_cell("normal text") == "normal text"
    assert sanitize_csv_cell(None) == ""


def test_auth_register_login_me():
    _, SessionLocal = create_in_memory_db()

    def get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    auth_router, _ = create_auth_dependencies(get_db)
    app.include_router(auth_router)
    client = TestClient(app)

    auth = register_and_login(client, email="alice@acme.test", organization_name="Acme Corp")
    me_resp = client.get("/api/auth/me", headers=auth["headers"])
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "alice@acme.test"
    assert me_resp.json()["organization_name"] == "Acme Corp"

    login_resp = client.post(
        "/api/auth/login",
        json={"email": "alice@acme.test", "password": "StrongPass123!"},
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()
