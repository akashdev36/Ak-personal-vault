from supabase import create_client, Client
import os
from typing import Optional

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL", "")
supabase_key = os.getenv("SUPABASE_KEY", "")

# Only initialize if keys are provided AND not placeholders
if (supabase_url and supabase_key and 
    not supabase_url.startswith("https://your-project") and
    supabase_key != "your_supabase_anon_key"):
    try:
        supabase: Client = create_client(supabase_url, supabase_key)
        print("✅ Supabase connected!")
    except Exception as e:
        supabase = None
        print(f"⚠️  Supabase connection failed: {e}")
else:
    supabase = None
    print("⚠️  Supabase not configured - using mock mode")

# Database operations
async def save_tracking_entry(entry: dict) -> dict:
    """Save a tracking entry to database"""
    if not supabase:
        print(f"📝 Mock: Would save tracking entry: {entry['type']} = {entry.get('value')}")
        return {**entry, "id": "mock-id-123"}
    
    result = supabase.table("tracking_logs").insert(entry).execute()
    return result.data[0] if result.data else None

async def get_tracking_entries(user_id: str, type: Optional[str] = None, limit: int = 30):
    """Get tracking entries for a user"""
    if not supabase:
        print(f"📝 Mock: Would get tracking entries for {user_id}")
        return []
    
    query = supabase.table("tracking_logs").select("*").eq("user_id", user_id)
    
    if type:
        query = query.eq("type", type)
    
    result = query.order("timestamp", desc=True).limit(limit).execute()
    return result.data

async def save_chat_message(user_id: str, role: str, message: str):
    """Save chat message to history"""
    if not supabase:
        print(f"📝 Mock: Would save chat from {user_id}: {message[:50]}...")
        return {"id": "mock-msg-123", "user_id": user_id, "role": role, "message": message}
    
    entry = {
        "user_id": user_id,
        "role": role,
        "message": message
    }
    result = supabase.table("chat_messages").insert(entry).execute()
    return result.data[0] if result.data else None

async def get_chat_history(user_id: str, limit: int = 10):
    """Get recent chat history"""
    if not supabase:
        print(f"📝 Mock: Would get chat history for {user_id}")
        return []
    
    result = supabase.table("chat_messages") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()
    return result.data
