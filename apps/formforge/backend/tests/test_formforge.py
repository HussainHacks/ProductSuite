from app.main import create_app
from fastapi.testclient import TestClient
from productsuite_testing import register_and_login


def _make_client():
    app = create_app("sqlite:///:memory:")
    # Use a shared in-memory DB via StaticPool by overriding dependency?
    # Better: pass a temp sqlite file or StaticPool via create_in_memory_db.
    return app


def test_formforge_full_workflow(tmp_path):
    db_path = tmp_path / "formforge_test.db"
    app = create_app(f"sqlite:///{db_path}")
    with TestClient(app) as client:
        owner = register_and_login(client, email="owner@ff.test", organization_name="FormOrg")
        other = register_and_login(client, email="other@ff.test", organization_name="OtherOrg")

        # Create form
        create_res = client.post(
            "/api/forms",
            headers=owner["headers"],
            json={"title": "Customer Feedback", "description": "Tell us what you think"},
        )
        assert create_res.status_code == 201
        form = create_res.json()
        form_id = form["id"]
        slug = form["public_slug"]

        # Cross-org isolation
        assert client.get(f"/api/forms/{form_id}", headers=other["headers"]).status_code == 404

        # Add questions covering multiple types
        q1 = client.post(
            f"/api/forms/{form_id}/questions",
            headers=owner["headers"],
            json={"prompt": "Your Email", "question_type": "email", "required": True},
        ).json()
        q2 = client.post(
            f"/api/forms/{form_id}/questions",
            headers=owner["headers"],
            json={
                "prompt": "Satisfaction",
                "question_type": "rating",
                "required": True,
            },
        ).json()
        q3 = client.post(
            f"/api/forms/{form_id}/questions",
            headers=owner["headers"],
            json={
                "prompt": "Favorite Features",
                "question_type": "multiple_choice",
                "required": False,
                "options": ["Speed", "UI", "Reliability"],
            },
        ).json()

        # Reorder questions (put q3 first)
        reorder_res = client.put(
            f"/api/forms/{form_id}/questions/reorder",
            headers=owner["headers"],
            json={"question_ids": [q3["id"], q1["id"], q2["id"]]},
        )
        assert reorder_res.status_code == 200
        assert [q["id"] for q in reorder_res.json()] == [q3["id"], q1["id"], q2["id"]]

        # Unpublished form is not accessible publicly
        assert client.get(f"/api/public/forms/{slug}").status_code == 404

        # Publish form
        pub_res = client.patch(
            f"/api/forms/{form_id}",
            headers=owner["headers"],
            json={"is_published": True},
        )
        assert pub_res.status_code == 200
        assert pub_res.json()["is_published"] is True

        # Anonymous public fetch works
        public_form = client.get(f"/api/public/forms/{slug}")
        assert public_form.status_code == 200
        assert len(public_form.json()["questions"]) == 3

        # Missing required field rejected
        bad_submit = client.post(
            f"/api/public/forms/{slug}/submit",
            json={"answers": {str(q1["id"]): "not-an-email"}},
        )
        assert bad_submit.status_code == 422

        # Valid anonymous submission
        ok_submit = client.post(
            f"/api/public/forms/{slug}/submit",
            json={
                "respondent_label": "=CMD()",
                "answers": {
                    str(q1["id"]): "user@example.com",
                    str(q2["id"]): 5,
                    str(q3["id"]): ["Speed", "UI"],
                },
            },
        )
        assert ok_submit.status_code == 201

        # Owner views responses & summary
        responses = client.get(f"/api/forms/{form_id}/responses", headers=owner["headers"]).json()
        assert len(responses) == 1

        summary = client.get(f"/api/forms/{form_id}/summary", headers=owner["headers"]).json()
        assert summary["total_responses"] == 1
        rating_summary = next(q for q in summary["questions"] if q["question_id"] == q2["id"])
        assert rating_summary["average_rating"] == 5.0

        # CSV export sanitizes formula injection
        csv_res = client.get(f"/api/forms/{form_id}/export.csv", headers=owner["headers"])
        assert csv_res.status_code == 200
        assert "'=CMD()" in csv_res.text
        assert "user@example.com" in csv_res.text
