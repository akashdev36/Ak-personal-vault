"""
OpenRouter AI Provider Implementation
Uses free Mistral model via OpenRouter API
"""

import requests
import json
import os
from typing import Optional
from dotenv import load_dotenv
from app.services.ai_provider import AIProvider
from app.services.prompts import (
    get_daily_quote_prompt,
    get_daily_quote_fallback,
    CONVERSATION_PARTNER_PROMPT
)

load_dotenv()


class OpenRouterProvider(AIProvider):
    """
    OpenRouter AI Provider using free Mistral model.
    """
    
    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.model = os.getenv("OPENROUTER_MODEL", "mistralai/devstral-2512:free")
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY not found in environment variables")
        
        print(f"✅ OpenRouter Provider initialized with model: {self.model}")
    
    def _make_request(self, messages: list) -> str:
        """Make a request to OpenRouter API."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://ak-personal-vault.vercel.app",
            "X-Title": "Ak Personal Vault",
        }
        
        data = {
            "model": self.model,
            "messages": messages
        }
        
        try:
            response = requests.post(
                self.base_url,
                headers=headers,
                data=json.dumps(data),
                timeout=30
            )
            response.raise_for_status()
            result = response.json()
            return result['choices'][0]['message']['content']
        except requests.exceptions.RequestException as e:
            print(f"❌ OpenRouter API Error: {str(e)}")
            raise
    
    async def chat(self, message: str, context: Optional[str] = None) -> dict:
        """
        Send a chat message to OpenRouter and extract structured data.
        """
        # Build chat messages
        messages = [
            {
                "role": "system",
                "content": """You are a personal tracking assistant. Analyze the user's message and extract tracking data if present.

Extract data in this JSON format:
{
    "response": "Your friendly response to the user",
    "extracted_data": {
        "sleep_hours": null,
        "water_liters": null,
        "gym_session": null,
        "mood": null,
        "work_hours": null,
        "learning_hours": null
    }
}

Rules:
- Only extract data that's clearly mentioned
- Be conversational and encouraging
- IMPORTANT: Return ONLY the JSON object, no markdown formatting"""
            }
        ]
        
        if context and context != "First conversation":
            messages.append({
                "role": "assistant",
                "content": f"Previous context: {context}"
            })
        
        messages.append({
            "role": "user",
            "content": message
        })
        
        try:
            response_text = self._make_request(messages)
            
            # Clean response
            response_text = response_text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            result = json.loads(response_text)
            return result
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON Parse Error: {e}")
            return {
                "response": response_text if 'response_text' in locals() else "I'm having trouble processing that.",
                "extracted_data": None
            }
        except Exception as e:
            print(f"❌ OpenRouter Error: {str(e)}")
            return {
                "response": "I'm having trouble processing that. Could you rephrase?",
                "extracted_data": None,
                "error": str(e)
            }
    
    async def generate_insights(self, tracking_data: list) -> list[str]:
        """
        Generate AI insights from tracking data.
        """
        messages = [
            {
                "role": "user",
                "content": f"""Analyze this tracking data and provide 2-3 helpful insights:

Data: {json.dumps(tracking_data, indent=2)}

Return insights as a JSON array of strings. Focus on:
- Patterns and correlations
- Achievements and progress
- Helpful suggestions

Format: ["insight 1", "insight 2", "insight 3"]"""
            }
        ]
        
        try:
            response_text = self._make_request(messages)
            
            # Clean response
            response_text = response_text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
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
        
        messages = [
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        try:
            quote = self._make_request(messages)
            quote = quote.strip()
            # Remove quotes if present
            if quote.startswith('"') and quote.endswith('"'):
                quote = quote[1:-1]
            if quote.startswith("'") and quote.endswith("'"):
                quote = quote[1:-1]
            return quote
        except Exception as e:
            print(f"❌ Quote generation error: {e}")
            return get_daily_quote_fallback(user_name)
