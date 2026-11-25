from app.main import create_app
from fastapi.testclient import TestClient
from productsuite_testing import register_and_login


def test_dataforge_custom_list_sort_filter_csv(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'dataforge.db'}"
    app = create_app(db_url)
    with TestClient(app) as client:
        owner = register_and_login(client, email="df@test.com", organization_name="DataOrg")

        # Create list from template
        lst = client.post(
            "/api/lists",
            headers=owner["headers"],
            json={"name": "Bug Tracker", "template": "issue_tracker"},
        ).json()
        lid = lst["id"]
        assert len(lst["columns"]) == 5

        # Add custom URL column
        url_col = client.post(
            f"/api/lists/{lid}/columns",
            headers=owner["headers"],
            json={"name": "Ticket Link", "field_type": "url", "required": False},
        ).json()
        assert url_col["key"] == "ticket_link"

        # Invalid URL rejected
        bad_rec = client.post(
            f"/api/lists/{lid}/records",
            headers=owner["headers"],
            json={"values": {"title": "Fix login", "ticket_link": "not-a-url"}},
        )
        assert bad_rec.status_code == 422

        # Create valid records
        client.post(
            f"/api/lists/{lid}/records",
            headers=owner["headers"],
            json={
                "values": {
                    "title": "Beta Bug",
                    "status": "Open",
                    "priority": "High",
                    "resolved": False,
                    "ticket_link": "https://example.com/1",
                }
            },
        )
        client.post(
            f"/api/lists/{lid}/records",
            headers=owner["headers"],
            json={
                "values": {
                    "title": "Alpha Bug",
                    "status": "Resolved",
                    "priority": "Low",
                    "resolved": True,
                }
            },
        )

        # Sort ascending by title
        sorted_recs = client.get(
            f"/api/lists/{lid}/records?sort_by=title&sort_dir=asc", headers=owner["headers"]
        ).json()
        assert [r["values"]["title"] for r in sorted_recs] == ["Alpha Bug", "Beta Bug"]

        # Filter by status=Open
        filtered = client.get(
            f"/api/lists/{lid}/records?filter_key=status&filter_val=Open",
            headers=owner["headers"],
        ).json()
        assert len(filtered) == 1
        assert filtered[0]["values"]["title"] == "Beta Bug"

        # CSV export
        csv_res = client.get(f"/api/lists/{lid}/export.csv", headers=owner["headers"])
        assert csv_res.status_code == 200
        assert "Beta Bug" in csv_res.text
        assert "https://example.com/1" in csv_res.text

        # CSV import
        csv_payload = "Title,Status,Priority\nGamma Bug,Open,Medium\n"
        imp_res = client.post(
            f"/api/lists/{lid}/import.csv",
            headers=owner["headers"],
            files={"file": ("import.csv", csv_payload.encode("utf-8"), "text/csv")},
        )
        assert imp_res.status_code == 200
        assert imp_res.json()["imported"] == 1
