from fastapi import APIRouter, HTTPException
from app.models.schemas import ChatMessage, ChatResponse
from app.services.gemini import chat_with_ai
from app.services.supabase import save_chat_message, get_chat_history, save_tracking_entry
from datetime import datetime

router = APIRouter()

@router.post("/", response_model=ChatResponse)
async def send_message(message: ChatMessage):
    """
    Send a message to the AI assistant
    - Saves to chat history
    - Extracts tracking data if present
    - Returns AI response
    """
    try:
        # Get recent chat history for context
        history = await get_chat_history(message.user_id, limit=5)
        context = " ".join([h["message"] for h in reversed(history)])
        
        # Get AI response
        ai_response = await chat_with_ai(message.message, context)
        
        # Save user message
        await save_chat_message(message.user_id, "user", message.message)
        
        # Save AI response
        await save_chat_message(message.user_id, "assistant", ai_response["response"])
        
        # If AI extracted tracking data, save it
        if ai_response.get("extracted_data"):
            extracted = ai_response["extracted_data"]
            
            for key, value in extracted.items():
                if value is not None:
                    # Map field names to types
                    type_map = {
                        "sleep_hours": "sleep",
                        "water_liters": "water",
                        "gym_session": "gym",
                        "mood": "mood",
                        "work_hours": "work",
                        "learning_hours": "learning"
                    }
                    
                    if key in type_map:
                        entry = {
                            "user_id": message.user_id,
                            "type": type_map[key],
                            "value": value if isinstance(value, (int, float)) else 1,
                            "notes": str(value) if isinstance(value, str) else None,
                            "timestamp": datetime.now().isoformat()
                        }
                        await save_tracking_entry(entry)
        
        return ChatResponse(
            response=ai_response["response"],
            extracted_data=ai_response.get("extracted_data"),
            timestamp=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{user_id}")
async def get_history(user_id: str, limit: int = 20):
    """Get chat history for a user"""
    try:
        history = await get_chat_history(user_id, limit)
        return {"history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
