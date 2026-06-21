import pytest

def test_traffic_routes_endpoint(auth_client):
    response = auth_client.get("/public/traffic-routes")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert "features" in data
    assert len(data["features"]) > 0
    
    # Check first route feature structure
    feature = data["features"][0]
    assert feature["type"] == "Feature"
    assert "geometry" in feature
    assert feature["geometry"]["type"] == "LineString"
    assert len(feature["geometry"]["coordinates"]) >= 2
    
    # Check properties
    props = feature["properties"]
    assert "route_name" in props
    assert "congestion_level" in props
    assert props["congestion_level"] in ("high", "medium", "low")
    assert "color" in props
    assert "current_speed_kmh" in props
