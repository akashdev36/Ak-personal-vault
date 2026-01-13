"""
AI Provider Abstraction Layer
Allows easy switching between different AI models (Gemini, OpenAI, Claude, etc.)
"""

from abc import ABC, abstractmethod
from typing import Optional
import os


class AIProvider(ABC):
    """
    Abstract base class for AI providers.
    Implement this interface to add support for new AI models.
    """
    
    @abstractmethod
    async def chat(self, message: str, context: Optional[str] = None) -> dict:
        """
        Send a chat message and get a response with extracted data.
        
        Returns:
            dict: {
                "response": str,
                "extracted_data": Optional[dict]
            }
        """
        pass
    
    @abstractmethod
    async def generate_insights(self, tracking_data: list) -> list[str]:
        """
        Generate insights from tracking data.
        
        Returns:
            list[str]: List of insight strings
        """
        pass
    
    @abstractmethod
    async def generate_daily_quote(self, user_name: str = "you") -> str:
        """
        Generate a personalized motivational quote.
        
        Args:
            user_name: Name to include in the quote
            
        Returns:
            str: The motivational quote
        """
        pass


def get_ai_provider() -> AIProvider:
    """
    Factory function to get the configured AI provider.
    
    Set AI_PROVIDER in .env to switch providers:
    - "gemini" (default)
    - "openrouter" (free Mistral model)
    - "openai" (future)
    - "claude" (future)
    """
    provider_name = os.getenv("AI_PROVIDER", "openrouter").lower()
    
    if provider_name == "gemini":
        from app.services.providers.gemini_provider import GeminiProvider
        return GeminiProvider()
    
    elif provider_name == "openrouter":
        from app.services.providers.openrouter_provider import OpenRouterProvider
        return OpenRouterProvider()
    
    # Future providers can be added here:
    # elif provider_name == "openai":
    #     from app.services.providers.openai_provider import OpenAIProvider
    #     return OpenAIProvider()
    #
    # elif provider_name == "claude":
    #     from app.services.providers.claude_provider import ClaudeProvider
    #     return ClaudeProvider()
    
    else:
        raise ValueError(f"Unknown AI provider: {provider_name}. Supported: gemini, openrouter")


# Singleton instance
_ai_provider: Optional[AIProvider] = None


def get_ai() -> AIProvider:
    """Get the singleton AI provider instance."""
    global _ai_provider
    if _ai_provider is None:
        _ai_provider = get_ai_provider()
    return _ai_provider
