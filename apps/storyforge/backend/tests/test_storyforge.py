from app.main import create_app
from fastapi.testclient import TestClient
from productsuite_testing import register_and_login


def test_storyforge_publish_reorder_and_public_link(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'storyforge.db'}"
    app = create_app(db_url)
    with TestClient(app) as client:
        owner = register_and_login(client, email="sf@test.com", organization_name="StoryOrg")

        story = client.post(
            "/api/stories",
            headers=owner["headers"],
            json={"title": "Annual Impact Report", "subtitle": "2026 Highlights"},
        ).json()
        sid = story["id"]
        slug = story["public_slug"]

        c1 = client.post(
            f"/api/stories/{sid}/cards",
            headers=owner["headers"],
            json={"card_type": "heading", "title": "Executive Summary"},
        ).json()
        c2 = client.post(
            f"/api/stories/{sid}/cards",
            headers=owner["headers"],
            json={"card_type": "paragraph", "body": "We achieved 99.9% uptime."},
        ).json()

        # Reorder cards
        reordered = client.put(
            f"/api/stories/{sid}/cards/reorder",
            headers=owner["headers"],
            json={"card_ids": [c2["id"], c1["id"]]},
        ).json()
        assert [c["id"] for c in reordered] == [c2["id"], c1["id"]]

        # Unpublished story returns 404 publicly
        assert client.get(f"/api/public/stories/{slug}").status_code == 404

        # Publish and switch layout
        client.patch(
            f"/api/stories/{sid}",
            headers=owner["headers"],
            json={"is_published": True, "layout": "editorial_grid"},
        )
        pub = client.get(f"/api/public/stories/{slug}")
        assert pub.status_code == 200
        assert pub.json()["layout"] == "editorial_grid"
        assert len(pub.json()["cards"]) == 2
