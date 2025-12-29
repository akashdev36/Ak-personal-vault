import google.generativeai as genai
import os
import json
from typing import Optional
from dotenv import load_dotenv

# Ensure .env is loaded
load_dotenv()

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)
    print(f"✅ Gemini configured with API key")
else:
    print(f"❌ No GEMINI_API_KEY found!")

# Use Gemini 2.0 Flash Experimental
model = genai.GenerativeModel('gemini-2.0-flash')

async def chat_with_ai(message: str, context: Optional[str] = None) -> dict:
    """
    Send message to Gemini AI and extract structured data
    """
    
    # System prompt for extracting tracking data
    prompt = f"""
You are a personal tracking assistant. Analyze the user's message and extract tracking data if present.

User message: "{message}"

Extract data in this JSON format:
{{
    "response": "Your friendly response to the user",
    "extracted_data": {{
        "sleep_hours": null,
        "water_liters": null,
        "gym_session": null,
        "mood": null,
        "work_hours": null,
        "learning_hours": null
    }}
}}

Rules:
- Only extract data that's clearly mentioned
- Be conversational and encouraging
- If asking a question, make it specific and helpful

Previous context: {context or "First conversation"}
"""

    try:
        response = model.generate_content(prompt)
        result = json.loads(response.text)
        return result
    except json.JSONDecodeError:
        # Fallback if AI doesn't return valid JSON
        return {
            "response": response.text,
            "extracted_data": None
        }
    except Exception as e:
        print(f"❌ Gemini API Error: {str(e)}")
        return {
            "response": f"I'm having trouble processing that. Could you rephrase?",
            "extracted_data": None,
            "error": str(e)
        }

async def generate_insights(tracking_data: list) -> list[str]:
    """
    Generate AI insights from tracking data
    """
    
    prompt = f"""
Analyze this tracking data and provide 2-3 helpful insights:

Data: {json.dumps(tracking_data, indent=2)}

Return insights as a JSON array of strings. Focus on:
- Patterns and correlations
- Achievements and progress
- Helpful suggestions

Format: ["insight 1", "insight 2", "insight 3"]
"""

    try:
        response = model.generate_content(prompt)
        insights = json.loads(response.text)
        return insights
    except:
        return [
            "Keep tracking to see patterns!",
            "Consistency is key to progress.",
            "Great job staying engaged!"
        ]
