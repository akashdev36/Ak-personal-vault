from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import chat, tracking, analytics, quotes, coach
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Debug: Print if API key is loaded
gemini_key = os.getenv("GEMINI_API_KEY")
if gemini_key:
    print(f"✅ Gemini API key loaded (starts with: {gemini_key[:10]}...)")
else:
    print("❌ Gemini API key NOT found in environment!")

app = FastAPI(
    title="Personal Tracker API",
    description="AI-powered personal tracking and assistant",
    version="1.0.0"
)

# CORS - Allow frontend to call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Local development
        os.getenv("FRONTEND_URL", ""),  # Production
        "https://ak-personal-vault.vercel.app",  # Your deployed frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router, prefix="/api/chat", tags=["AI Chat"])
app.include_router(tracking.router, prefix="/api/tracking", tags=["Tracking"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(quotes.router, prefix="/api/quotes", tags=["Quotes"])
app.include_router(coach.router, prefix="/api/coach", tags=["Conversation Partner"])

@app.get("/")
def root():
    return {
        "message": "Personal Tracker API is running!",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}
