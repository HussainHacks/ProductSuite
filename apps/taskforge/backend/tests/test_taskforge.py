from datetime import date, timedelta

from app.main import create_app
from fastapi.testclient import TestClient
from productsuite_testing import register_and_login


def test_taskforge_lifecycle_and_persistence(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'taskforge.db'}"
    app = create_app(db_url)

    with TestClient(app) as client:
        u1 = register_and_login(client, email="u1@tf.test", organization_name="Org1")
        u2 = register_and_login(client, email="u2@tf.test", organization_name="Org2")

        # Create list
        lst = client.post(
            "/api/lists", headers=u1["headers"], json={"name": "Work", "color": "sky"}
        ).json()
        assert lst["name"] == "Work"

        # Create recurring task due today
        today = date.today().isoformat()
        t1 = client.post(
            "/api/tasks",
            headers=u1["headers"],
            json={
                "title": "Daily standup notes",
                "list_id": lst["id"],
                "priority": "high",
                "due_date": today,
                "recurrence": "daily",
                "notes": "Prepare blockers",
            },
        ).json()

        # User 2 cannot access User 1's task
        assert (
            client.patch(
                f"/api/tasks/{t1['id']}", headers=u2["headers"], json={"title": "Hacked"}
            ).status_code
            == 404
        )

        # Today view shows t1
        today_tasks = client.get("/api/tasks?view=today", headers=u1["headers"]).json()
        assert len(today_tasks) == 1

        # Complete recurring task -> marks t1 complete AND creates tomorrow's occurrence
        comp = client.post(f"/api/tasks/{t1['id']}/complete", headers=u1["headers"]).json()
        assert comp["is_completed"] is True
        assert comp["completed_at"] is not None

        all_tasks = client.get("/api/tasks?view=all", headers=u1["headers"]).json()
        assert len(all_tasks) == 2
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        assert any(t["due_date"] == tomorrow and not t["is_completed"] for t in all_tasks)

        # Preferences persist
        pref = client.patch(
            "/api/preferences",
            headers=u1["headers"],
            json={"default_view": "upcoming", "show_completed": True, "default_priority": "urgent"},
        ).json()
        assert pref["default_view"] == "upcoming"

    # Restart app against same DB to verify persistence
    app_restarted = create_app(db_url)
    with TestClient(app_restarted) as client2:
        login = client2.post(
            "/api/auth/login", json={"email": "u1@tf.test", "password": "StrongPass123!"}
        ).json()
        headers = {"Authorization": f"Bearer {login['access_token']}"}
        assert len(client2.get("/api/tasks?view=all", headers=headers).json()) == 2
        assert client2.get("/api/preferences", headers=headers).json()["default_view"] == "upcoming"
