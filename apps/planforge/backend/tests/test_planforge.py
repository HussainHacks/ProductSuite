from app.main import create_app
from fastapi.testclient import TestClient
from productsuite_testing import register_and_login


def test_planforge_kanban_workflow(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'planforge.db'}"
    app = create_app(db_url)
    with TestClient(app) as client:
        owner = register_and_login(client, email="pm@pf.test", organization_name="PlanOrg")
        other = register_and_login(client, email="other@pf.test", organization_name="OtherOrg")

        proj = client.post(
            "/api/projects",
            headers=owner["headers"],
            json={"name": "Q4 Launch", "description": "Product launch board"},
        ).json()
        pid = proj["id"]
        assert len(proj["columns"]) == 3
        todo_col, prog_col, done_col = proj["columns"]

        # Cross-org isolation
        assert client.get(f"/api/projects/{pid}", headers=other["headers"]).status_code == 404

        # Add custom column
        review_col = client.post(
            f"/api/projects/{pid}/columns",
            headers=owner["headers"],
            json={"name": "Review", "is_done_column": False},
        ).json()
        assert review_col["name"] == "Review"

        # Create task assigned to owner
        task = client.post(
            f"/api/projects/{pid}/tasks",
            headers=owner["headers"],
            json={
                "column_id": todo_col["id"],
                "title": "Finalize release notes",
                "priority": "high",
                "labels": ["docs", "launch"],
                "assignee_id": owner["user"]["id"],
            },
        ).json()
        assert task["assignee_name"] == "Test Owner"

        # Move task to Done column
        moved = client.post(
            f"/api/projects/{pid}/tasks/{task['id']}/move",
            headers=owner["headers"],
            json={"target_column_id": done_col["id"], "position": 0},
        ).json()
        assert moved["column_id"] == done_col["id"]

        # Add comment
        cm = client.post(
            f"/api/projects/{pid}/tasks/{task['id']}/comments",
            headers=owner["headers"],
            json={"body": "Ready for review!"},
        )
        assert cm.status_code == 201

        # Verify activity log and persistence
        full_proj = client.get(f"/api/projects/{pid}", headers=owner["headers"]).json()
        assert len(full_proj["activities"]) >= 4
        assert len(full_proj["tasks"][0]["comments"]) == 1
