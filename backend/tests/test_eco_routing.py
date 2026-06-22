import pytest
from app.models.user import User

def test_calculate_route_endpoint(auth_client, officer_token):
    # Retrieve auth user and compute route
    headers = {"Authorization": f"Bearer {officer_token}"}
    response = auth_client.get(
        "/public/calculate-route?start_lat=12.9177&start_lng=77.6225&end_lat=12.9750&end_lng=77.6063",
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "standard_route" in data
    assert "eco_route" in data
    assert "stats" in data
    
    stats = data["stats"]
    assert "std_dist_km" in stats
    assert "eco_dist_km" in stats
    assert "std_time_mins" in stats
    assert "eco_time_mins" in stats
    assert "co2_saved_kg" in stats
    assert "fuel_saved_liters" in stats

def test_record_commute_officer_simulated(auth_client, officer_token):
    headers = {"Authorization": f"Bearer {officer_token}"}
    payload = {
        "co2_saved": 2.45,
        "fuel_saved": 0.85,
        "time_saved": 12.0
    }
    response = auth_client.post("/public/record-commute", json=payload, headers=headers)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["eco_co2_offset"] == 2.45
    assert res_data["eco_fuel_saved"] == 0.85
    assert res_data["eco_time_saved"] == 12.0

def test_record_commute_registered_user_persisted(auth_client):
    import random
    email = f"eco.commute{random.randint(10000, 99999)}@parksense.ai"
    # 1. Register a new user
    reg_response = auth_client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "securepassword",
            "full_name": "Eco Driver",
        },
    )
    assert reg_response.status_code == 200
    token = reg_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get initial info
    me_resp = auth_client.get("/auth/me", headers=headers)
    assert me_resp.status_code == 200
    initial_user = me_resp.json()
    assert initial_user["eco_co2_offset"] == 0.0
    assert initial_user["eco_fuel_saved"] == 0.0
    assert initial_user["eco_time_saved"] == 0.0

    # 3. Post commute
    payload = {
        "co2_saved": 1.75,
        "fuel_saved": 0.65,
        "time_saved": 8.0
    }
    response = auth_client.post("/public/record-commute", json=payload, headers=headers)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["eco_co2_offset"] == 1.75
    assert res_data["eco_fuel_saved"] == 0.65
    assert res_data["eco_time_saved"] == 8.0

    # 4. Fetch me endpoint again to verify it is database-persisted
    me_resp_after = auth_client.get("/auth/me", headers=headers)
    assert me_resp_after.status_code == 200
    updated_user = me_resp_after.json()
    assert updated_user["eco_co2_offset"] == 1.75
    assert updated_user["eco_fuel_saved"] == 0.65
    assert updated_user["eco_time_saved"] == 8.0
