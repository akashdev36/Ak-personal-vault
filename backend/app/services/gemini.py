"""
AI Service - Backward Compatible Wrapper

This module provides backward compatibility with the old API while using
the new provider-based architecture internally.

To switch AI providers, set AI_PROVIDER in .env:
- "gemini" (default)
- "openai" (future)
- "claude" (future)
"""

from typing import Optional
from app.services.ai_provider import get_ai

# Get the configured AI provider
_provider = None


def _get_provider():
    global _provider
    if _provider is None:
        _provider = get_ai()
    return _provider


async def chat_with_ai(message: str, context: Optional[str] = None) -> dict:
    """
    Send message to AI and extract structured data.
    Backward compatible wrapper.
    """
    return await _get_provider().chat(message, context)


async def generate_insights(tracking_data: list) -> list[str]:
    """
    Generate AI insights from tracking data.
    Backward compatible wrapper.
    """
    return await _get_provider().generate_insights(tracking_data)


async def generate_daily_quote(user_name: str = "Akash") -> str:
    """
    Generate a personalized motivational quote.
    Backward compatible wrapper.
    """
    return await _get_provider().generate_daily_quote(user_name)
