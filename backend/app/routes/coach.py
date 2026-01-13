"""
English Coaching Routes
Dedicated endpoint for the Communication Coach feature
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import google.generativeai as genai
import os
from dotenv import load_dotenv
from app.services.prompts import get_english_coaching_prompt

load_dotenv()

router = APIRouter()


class CoachingRequest(BaseModel):
    """Request model for coaching"""
    message: str
    user_id: str


class CoachingResponse(BaseModel):
    """Response model for coaching"""
    feedback: str


# Initialize Gemini (lazy loading)
_model = None


def get_model():
    """Get or create the Gemini model instance."""
    global _model
    if _model is None:
        api_key = os.getenv("GEMINI_API_KEY")
        model_name = os.getenv("GEMINI_MODEL", "models/gemini-2.5-flash")
        
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found")
        
        genai.configure(api_key=api_key)
        _model = genai.GenerativeModel(model_name)
    return _model


@router.post("/feedback", response_model=CoachingResponse)
async def get_coaching_feedback(request: CoachingRequest):
    """
    Get English speaking feedback from AI coach.
    
    This endpoint uses a different prompt than the main chat,
    specifically designed for English language coaching.
    """
    try:
        model = get_model()
        
        # Use the English coaching prompt (not health tracking)
        prompt = get_english_coaching_prompt(request.message)
        
        # Get AI response
        response = model.generate_content(prompt)
        feedback = response.text.strip()
        
        print(f"🎓 Coaching feedback for: '{request.message[:50]}...'")
        
        return CoachingResponse(feedback=feedback)
        
    except Exception as e:
        print(f"❌ Coaching error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
