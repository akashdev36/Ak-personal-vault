from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime

# Chat models
class ChatMessage(BaseModel):
    message: str
    user_id: str

class ChatResponse(BaseModel):
    response: str
    extracted_data: Optional[dict] = None
    timestamp: datetime

# Tracking models
class TrackingEntry(BaseModel):
    user_id: str
    type: Literal["sleep", "water", "gym", "mood", "work", "learning"]
    value: float
    notes: Optional[str] = None
    timestamp: Optional[datetime] = None

class TrackingResponse(BaseModel):
    id: str
    user_id: str
    type: str
    value: float
    notes: Optional[str]
    timestamp: datetime

# Analytics models
class DashboardData(BaseModel):
    sleep_avg: float
    water_avg: float
    gym_count: int
    mood_avg: float
    insights: list[str]
