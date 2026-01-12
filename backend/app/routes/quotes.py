from fastapi import APIRouter
from app.services.gemini import generate_daily_quote
from datetime import datetime, date
import json
import os

router = APIRouter()

# Simple file-based cache for daily quote (no DB needed initially)
QUOTE_CACHE_FILE = "daily_quote_cache.json"

def get_cached_quote():
    """Get cached quote if it's from today"""
    try:
        if os.path.exists(QUOTE_CACHE_FILE):
            with open(QUOTE_CACHE_FILE, 'r') as f:
                cache = json.load(f)
                if cache.get("date") == str(date.today()):
                    return cache.get("quote")
    except:
        pass
    return None

def save_quote_to_cache(quote: str):
    """Save quote with today's date"""
    with open(QUOTE_CACHE_FILE, 'w') as f:
        json.dump({
            "date": str(date.today()),
            "quote": quote,
            "generated_at": datetime.now().isoformat()
        }, f)

@router.get("/daily-quote")
async def get_daily_quote():
    """
    Get today's motivational quote.
    Generates a new one if it's a new day, otherwise returns cached quote.
    """
    # Check if we have today's quote cached
    cached_quote = get_cached_quote()
    if cached_quote:
        return {
            "quote": cached_quote,
            "date": str(date.today()),
            "cached": True
        }
    
    # Generate new quote for today
    quote = await generate_daily_quote()
    save_quote_to_cache(quote)
    
    return {
        "quote": quote,
        "date": str(date.today()),
        "cached": False
    }
