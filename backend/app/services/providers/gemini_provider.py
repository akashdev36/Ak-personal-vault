"""
Gemini AI Provider Implementation

Uses prompts from prompts.py for easy customization.
"""

import google.generativeai as genai
import os
import json
from typing import Optional
from dotenv import load_dotenv
from app.services.ai_provider import AIProvider
from app.services.prompts import (
    get_chat_prompt,
    get_insights_prompt,
    get_daily_quote_prompt,
    get_daily_quote_fallback
)

# Ensure .env is loaded
load_dotenv()


class GeminiProvider(AIProvider):
    """
    Google Gemini AI Provider implementation.
    """
    
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        model_name = os.getenv("GEMINI_MODEL", "models/gemini-2.5-flash")
        
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model_name)
        print(f"✅ Gemini Provider initialized with model: {model_name}")
    
    async def chat(self, message: str, context: Optional[str] = None) -> dict:
        """
        Send a chat message to Gemini and extract structured data.
        """
        prompt = get_chat_prompt(message, context or "First conversation")

        try:
            response = self.model.generate_content(prompt)
            response_text = response.text.strip()
            
            # Remove markdown code blocks if present
            response_text = self._clean_json_response(response_text)
            
            result = json.loads(response_text)
            return result
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON Parse Error: {e}")
            return {
                "response": response.text if 'response' in dir() else "I'm having trouble processing that.",
                "extracted_data": None
            }
        except Exception as e:
            print(f"❌ Gemini API Error: {str(e)}")
            return {
                "response": "I'm having trouble processing that. Could you rephrase?",
                "extracted_data": None,
                "error": str(e)
            }
    
    async def generate_insights(self, tracking_data: list) -> list[str]:
        """
        Generate AI insights from tracking data.
        """
        prompt = get_insights_prompt(json.dumps(tracking_data, indent=2))

        try:
            response = self.model.generate_content(prompt)
            response_text = self._clean_json_response(response.text.strip())
            insights = json.loads(response_text)
            return insights
        except:
            return [
                "Keep tracking to see patterns!",
                "Consistency is key to progress.",
                "Great job staying engaged!"
            ]
    
    async def generate_daily_quote(self, user_name: str = "Akash") -> str:
        """
        Generate a personalized motivational quote.
        """
        prompt = get_daily_quote_prompt(user_name)

        try:
            response = self.model.generate_content(prompt)
            quote = response.text.strip()
            # Remove quotes if present
            if quote.startswith('"') and quote.endswith('"'):
                quote = quote[1:-1]
            if quote.startswith("'") and quote.endswith("'"):
                quote = quote[1:-1]
            return quote
        except Exception as e:
            print(f"❌ Quote generation error: {e}")
            return get_daily_quote_fallback(user_name)
    
    def _clean_json_response(self, text: str) -> str:
        """Remove markdown code blocks from response."""
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return text.strip()
