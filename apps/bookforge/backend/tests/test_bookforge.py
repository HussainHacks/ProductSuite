from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.main import create_app
from fastapi.testclient import TestClient
from productsuite_testing import register_and_login


def test_bookforge_double_booking_and_dst_handling(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'bookforge.db'}"
    app = create_app(db_url)
    with TestClient(app) as client:
        owner = register_and_login(
            client, email="owner@bf.test", organization_name="Wellness Clinic"
        )
        slug = client.get("/api/org-slug", headers=owner["headers"]).json()["slug"]

        # Create 30-min service with 15-min after-buffer
        svc = client.post(
            "/api/services",
            headers=owner["headers"],
            json={
                "name": "Initial Consultation",
                "duration_minutes": 30,
                "buffer_before_minutes": 0,
                "buffer_after_minutes": 15,
            },
        ).json()

        # Create staff in America/New_York with Monday working hours
        staff = client.post(
            "/api/staff",
            headers=owner["headers"],
            json={
                "name": "Dr. Lee",
                "email": "lee@clinic.test",
                "timezone": "America/New_York",
                "service_ids": [svc["id"]],
                "working_hours": [{"day_of_week": 0, "start_time": "09:00", "end_time": "12:00"}],
            },
        ).json()

        # Monday 2026-03-09 (day after US DST spring-forward, EDT = UTC-4)
        monday = date(2026, 3, 9)
        slots = client.get(
            f"/api/public/booking/{slug}/slots",
            params={
                "service_id": svc["id"],
                "staff_id": staff["id"],
                "target_date": monday.isoformat(),
                "customer_timezone": "America/New_York",
            },
        ).json()
        assert len(slots) > 0

        # Book 09:00 EDT = 13:00 UTC
        start_edt = datetime(2026, 3, 9, 9, 0, tzinfo=ZoneInfo("America/New_York"))
        book_res = client.post(
            f"/api/public/booking/{slug}/book",
            json={
                "service_id": svc["id"],
                "staff_id": staff["id"],
                "start_utc": start_edt.isoformat(),
                "customer_name": "Jane Doe",
                "customer_email": "jane@example.com",
                "customer_timezone": "America/New_York",
            },
        )
        assert book_res.status_code == 201
        appt_id = book_res.json()["id"]

        # Overlapping booking at 09:30 EDT (conflicts with 15-min after-buffer!) MUST be 409
        overlap_res = client.post(
            f"/api/public/booking/{slug}/book",
            json={
                "service_id": svc["id"],
                "staff_id": staff["id"],
                "start_utc": (start_edt + timedelta(minutes=30)).isoformat(),
                "customer_name": "Bob Smith",
                "customer_email": "bob@example.com",
                "customer_timezone": "America/New_York",
            },
        )
        assert overlap_res.status_code == 409

        # Cancel appointment and verify local notification recorded
        cancel_res = client.post(f"/api/appointments/{appt_id}/cancel", headers=owner["headers"])
        assert cancel_res.status_code == 200
        assert cancel_res.json()["status"] == "cancelled"

        notifs = client.get("/api/notifications", headers=owner["headers"]).json()
        assert len(notifs) == 2  # booked + cancelled
