from fastapi import APIRouter

from app.data.loader import get_data_store
from app.models.forecaster import ParkPredictForecaster

router = APIRouter(tags=["Predictions"])


@router.get("/predictions")
def get_predictions():
    store = get_data_store()
    df = store.load()
    forecaster = ParkPredictForecaster()
    result = forecaster.forecast(df)
    return result.model_dump(mode="json")
