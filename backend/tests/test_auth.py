def test_officer_login(auth_client):
    response = auth_client.post(
        "/auth/login",
        json={"username": "officer", "password": "test-pass"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["role"] == "officer"
    assert "access_token" in data


def test_officer_login_invalid(auth_client):
    response = auth_client.post(
        "/auth/login",
        json={"username": "officer", "password": "wrong"},
    )
    assert response.status_code == 401


def test_shift_planner_requires_auth(auth_client):
    response = auth_client.get("/shift-planner")
    assert response.status_code == 401


def test_shift_planner_with_token(auth_client, officer_token):
    response = auth_client.get(
        "/shift-planner",
        headers={"Authorization": f"Bearer {officer_token}"},
    )
    assert response.status_code == 200
    assert "assignments" in response.json()


def test_ingest_requires_auth(auth_client):
    response = auth_client.post(
        "/ingest/violation",
        json={
            "latitude": 12.9352,
            "longitude": 77.6245,
            "vehicle_type": "CAR",
            "violation_types": ["NO PARKING"],
        },
    )
    assert response.status_code == 401


def test_ingest_with_api_key(auth_client):
    response = auth_client.post(
        "/ingest/violation",
        json={
            "latitude": 12.9352,
            "longitude": 77.6245,
            "vehicle_type": "CAR",
            "violation_types": ["NO PARKING"],
        },
        headers={"X-API-Key": "test-ingest-key"},
    )
    assert response.status_code == 200
    assert "ingested" in response.json()


def test_public_analytics_no_auth(auth_client):
    response = auth_client.get("/analytics")
    assert response.status_code == 200


def test_health_exempt(auth_client):
    response = auth_client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_forgot_password_flow(auth_client):
    # 1. Register a user
    register_response = auth_client.post(
        "/auth/register",
        json={
            "email": "forgot.test@parksense.ai",
            "password": "oldpassword123",
            "full_name": "Test User",
        },
    )
    assert register_response.status_code == 200

    # 2. Trigger forgot password
    forgot_response = auth_client.post(
        "/auth/forgot-password",
        json={"email": "forgot.test@parksense.ai"},
    )
    assert forgot_response.status_code == 200
    assert "OTP code" in forgot_response.json()["message"]

    # 3. Retrieve OTP from database directly
    from app.database import SessionLocal
    from app.models.user import User

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "forgot.test@parksense.ai").first()
        assert user is not None
        assert user.otp_code is not None
        otp = user.otp_code
    finally:
        db.close()

    # 4. Verify with invalid OTP
    verify_invalid_response = auth_client.post(
        "/auth/verify-otp",
        json={"email": "forgot.test@parksense.ai", "otp_code": "000000"},
    )
    assert verify_invalid_response.status_code == 400

    # 5. Verify with correct OTP
    verify_valid_response = auth_client.post(
        "/auth/verify-otp",
        json={"email": "forgot.test@parksense.ai", "otp_code": otp},
    )
    assert verify_valid_response.status_code == 200

    # 6. Reset password with incorrect OTP
    reset_invalid_response = auth_client.post(
        "/auth/reset-password",
        json={
            "email": "forgot.test@parksense.ai",
            "otp_code": "000000",
            "new_password": "newpassword123",
        },
    )
    assert reset_invalid_response.status_code == 400

    # 7. Reset password with correct OTP
    reset_valid_response = auth_client.post(
        "/auth/reset-password",
        json={
            "email": "forgot.test@parksense.ai",
            "otp_code": otp,
            "new_password": "newpassword123",
        },
    )
    assert reset_valid_response.status_code == 200

    # 8. Try to login with the new password
    login_response = auth_client.post(
        "/auth/login",
        json={"email": "forgot.test@parksense.ai", "password": "newpassword123"},
    )
    assert login_response.status_code == 200
    assert "access_token" in login_response.json()

