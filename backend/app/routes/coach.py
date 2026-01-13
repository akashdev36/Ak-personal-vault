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
    
    Uses OpenRouter's free models with automatic fallback.
    Tries multiple models in order if one is unavailable (503 error).
    """
    # Try these models in order if one fails
    FALLBACK_MODELS = [
        os.getenv("OPENROUTER_MODEL", "mistralai/devstral-2512:free"),
        "meta-llama/llama-3.2-3b-instruct:free",
        "nvidia/nemotron-nano-9b-v2:free"
    ]
    
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY not configured")
    
    # Format the conversation prompt
    prompt = CONVERSATION_PARTNER_PROMPT.format(message=request.message)
    
    # Common request configuration
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ak-personal-vault.vercel.app",
        "X-Title": "Ak Personal Vault",
    }
    
    last_error = None
    
    # Try each model until one works
    for model in FALLBACK_MODELS:
        try:
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
            
            print(f"✅ Conversation response using {model}")
            
            return CoachingResponse(feedback=feedback)
            
        except requests.exceptions.HTTPError as e:
            # If 503 (service unavailable), try next model
            if e.response.status_code == 503:
                print(f"⚠️ Model {model} unavailable (503), trying next...")
                last_error = e
                continue
            else:
                # Other HTTP errors, don't retry
                print(f"❌ HTTP error {e.response.status_code}: {e}")
                raise HTTPException(status_code=500, detail=str(e))
                
        except Exception as e:
            # Network or other errors, try next model
            print(f"⚠️ Error with {model}: {e}, trying next...")
            last_error = e
            continue
    
    # All models failed
    print(f"❌ All models failed. Last error: {last_error}")
    raise HTTPException(
        status_code=503, 
        detail="All AI models temporarily unavailable. Please try again in a moment."
    )

