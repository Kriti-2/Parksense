import pytest
from datetime import datetime, timedelta
import pandas as pd
from app.models.short_term_forecaster import ShortTermParkPredictForecaster
from app.utilities.constants import BENGALURU_ZONES


def test_feature_engineering_and_prediction():
    # 1. Create a dummy dataframe with enough mock violations across multiple zones
    import random
    random.seed(42)
    
    zones = list(BENGALURU_ZONES.keys())
    rows = []
    base_time = datetime.utcnow()
    
    # Create ~150 random violations over the last 3 days to simulate sparse but present data
    for i in range(150):
        ts = base_time - timedelta(minutes=random.randint(0, 4320))  # within 3 days
        rows.append({
            "id": f"TEST{i:05d}",
            "zone": random.choice(zones),
            "created_datetime": ts,
            "latitude": 12.97,
            "longitude": 77.59
        })
        
    df = pd.DataFrame(rows)
    
    # Instantiate and train
    forecaster = ShortTermParkPredictForecaster()
    forecaster.train(df)
    
    # Verify training status
    assert forecaster.is_trained is True
    
    # Perform prediction
    pred_res = forecaster.predict(df, base_time)
    assert pred_res.interval_minutes == 15
    assert len(pred_res.predictions) == len(BENGALURU_ZONES)
    
    for pred in pred_res.predictions:
        assert pred.zone in BENGALURU_ZONES
        assert isinstance(pred.current_violations, int)
        assert isinstance(pred.predicted_15m, int)
        assert isinstance(pred.predicted_30m, int)
        assert 0.4 <= pred.confidence <= 0.95


def test_fallback_averages_empty_data():
    forecaster = ShortTermParkPredictForecaster()
    
    # Train on empty df
    forecaster.train(pd.DataFrame())
    assert forecaster.is_trained is False
    
    # Verify fallback prediction works without crashing
    pred_res = forecaster.predict(pd.DataFrame(), datetime.utcnow())
    assert len(pred_res.predictions) == len(BENGALURU_ZONES)
    for pred in pred_res.predictions:
        assert pred.predicted_15m == 1  # 0.5 rounded to 1
        assert pred.predicted_30m == 1  # 0.5 + 0.5 = 1
        assert pred.confidence == 0.5


def test_short_term_predictions_route(auth_client):
    response = auth_client.get("/predictions/short-term")
    assert response.status_code == 200
    
    data = response.json()
    assert "generated_at" in data
    assert data["interval_minutes"] == 15
    assert "predictions" in data
    assert len(data["predictions"]) == len(BENGALURU_ZONES)
    
    # Validate structure
    pred = data["predictions"][0]
    assert "zone" in pred
    assert "current_violations" in pred
    assert "predicted_15m" in pred
    assert "predicted_30m" in pred
    assert "confidence" in pred
    assert "latitude" in pred
    assert "longitude" in pred
