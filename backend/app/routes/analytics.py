from fastapi import APIRouter, HTTPException
from app.services.supabase import get_tracking_entries
from app.services.gemini import generate_insights
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/dashboard/{user_id}")
async def get_dashboard(user_id: str, days: int = 7):
    """
    Get dashboard analytics for the last N days
    - Averages for each metric
    - AI-generated insights
    """
    try:
        # Get recent entries (last 7 days by default)
        all_entries = await get_tracking_entries(user_id, limit=100)
        
        # Filter by date range
        cutoff_date = datetime.now() - timedelta(days=days)
        recent_entries = [
            e for e in all_entries 
            if datetime.fromisoformat(e["timestamp"]) > cutoff_date
        ]
        
        # Calculate averages
        sleep_entries = [e for e in recent_entries if e["type"] == "sleep"]
        water_entries = [e for e in recent_entries if e["type"] == "water"]
        gym_entries = [e for e in recent_entries if e["type"] == "gym"]
        mood_entries = [e for e in recent_entries if e["type"] == "mood"]
        
        analytics = {
            "sleep_avg": sum(e["value"] for e in sleep_entries) / len(sleep_entries) if sleep_entries else 0,
            "water_avg": sum(e["value"] for e in water_entries) / len(water_entries) if water_entries else 0,
            "gym_count": len(gym_entries),
            "mood_avg": sum(float(e["notes"] == "happy") for e in mood_entries) / len(mood_entries) if mood_entries else 0,
            "total_entries": len(recent_entries)
        }
        
        # Generate AI insights
        insights = await generate_insights(recent_entries)
        analytics["insights"] = insights
        
        return analytics
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
