from app.main import create_app
from fastapi.testclient import TestClient
from productsuite_testing import register_and_login


def test_boardforge_save_and_reload(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'boardforge.db'}"
    app = create_app(db_url)
    with TestClient(app) as client:
        owner = register_and_login(client, email="wb@test.com", organization_name="BoardOrg")
        other = register_and_login(client, email="other@test.com", organization_name="OtherOrg")

        board = client.post(
            "/api/boards", headers=owner["headers"], json={"title": "Architecture Brainstorm"}
        ).json()
        bid = board["id"]
        assert board["version"] == 1

        # Cross-org isolation
        assert client.get(f"/api/boards/{bid}", headers=other["headers"]).status_code == 404

        elements = [
            {
                "id": "el-1",
                "kind": "sticky",
                "x": 120,
                "y": 80,
                "width": 180,
                "height": 140,
                "text": "API Gateway",
                "color": "#FEF08A",
            },
            {
                "id": "el-2",
                "kind": "rect",
                "x": 380,
                "y": 100,
                "width": 160,
                "height": 100,
                "text": "Worker",
                "color": "#BFDBFE",
            },
            {
                "id": "el-3",
                "kind": "connector",
                "x": 300,
                "y": 150,
                "x2": 380,
                "y2": 150,
                "color": "#334155",
            },
            {
                "id": "el-4",
                "kind": "stroke",
                "points": [[10, 10], [25, 30], [45, 20]],
                "color": "#E11D48",
            },
        ]
        saved = client.put(
            f"/api/boards/{bid}",
            headers=owner["headers"],
            json={"viewport_x": -50, "viewport_y": 20, "viewport_zoom": 1.25, "elements": elements},
        ).json()
        assert saved["version"] == 2
        assert len(saved["elements"]) == 4

        reloaded = client.get(f"/api/boards/{bid}", headers=owner["headers"]).json()
        assert reloaded["viewport_zoom"] == 1.25
        assert reloaded["elements"][0]["text"] == "API Gateway"
