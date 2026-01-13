"""
Conversation Partner Routes
Dedicated endpoint for the Communication Coach feature using OpenRouter
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import requests
import json
import os
from dotenv import load_dotenv
from app.services.prompts import CONVERSATION_PARTNER_PROMPT

load_dotenv()

router = APIRouter()


class CoachingRequest(BaseModel):
    """Request model for coaching"""
    message: str
    user_id: str


class CoachingResponse(BaseModel):
    """Response model for coaching"""
    feedback: str


@router.post("/feedback", response_model=CoachingResponse)
async def get_coaching_feedback(request: CoachingRequest):
    """
    Get conversation feedback from AI partner.
    
    Uses OpenRouter's free Mistral model for natural conversation.
    """
    try:
        api_key = os.getenv("OPENROUTER_API_KEY")
        model = os.getenv("OPENROUTER_MODEL", "mistralai/devstral-2512:free")
        
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY not found")
        
        # Format the conversation prompt
        prompt = CONVERSATION_PARTNER_PROMPT.format(message=request.message)
        
        # Make request to OpenRouter
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://ak-personal-vault.vercel.app",
            "X-Title": "Ak Personal Vault",
        }
        
        data = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }
        
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            data=json.dumps(data),
            timeout=30
        )
        
        response.raise_for_status()
        result = response.json()
        feedback = result['choices'][0]['message']['content'].strip()
        
        print(f"💬 Conversation response for: '{request.message[:50]}...'")
        
        return CoachingResponse(feedback=feedback)
        
    except Exception as e:
        print(f"❌ Coaching error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

