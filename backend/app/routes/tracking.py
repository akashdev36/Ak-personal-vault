from fastapi import APIRouter, HTTPException
from app.models.schemas import TrackingEntry, TrackingResponse
from app.services.supabase import save_tracking_entry, get_tracking_entries
from datetime import datetime

router = APIRouter()

@router.post("/log", response_model=TrackingResponse)
async def log_entry(entry: TrackingEntry):
    """
    Log a tracking entry (sleep, water, gym, etc.)
    """
    try:
        entry_dict = entry.dict()
        if not entry_dict.get("timestamp"):
            entry_dict["timestamp"] = datetime.now().isoformat()
        
        result = await save_tracking_entry(entry_dict)
        return TrackingResponse(**result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}")
async def get_entries(user_id: str, type: str = None, limit: int = 30):
    """
    Get tracking entries for a user
    - Optional filter by type (sleep, water, gym, etc.)
    - Default limit: 30 entries
    """
    try:
        entries = await get_tracking_entries(user_id, type, limit)
        return {"entries": entries, "count": len(entries)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
