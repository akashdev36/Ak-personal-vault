# Personal Tracker Backend

Python FastAPI backend with Gemini AI integration.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Add your API keys to `.env`:
   - Get Gemini API key from: https://makersuite.google.com/app/apikey
   - Get Supabase keys from: https://supabase.com (we'll set this up next!)

4. Run locally:
```bash
uvicorn app.main:app --reload
```

5. Visit API docs: http://localhost:8000/docs

## API Endpoints

- `POST /api/chat` - Send message to AI assistant
- `GET /api/chat/history/{user_id}` - Get chat history
- `POST /api/tracking/log` - Log tracking entry (sleep, water, etc.)
- `GET /api/tracking/{user_id}` - Get tracking entries
- `GET /api/analytics/dashboard/{user_id}` - Get dashboard analytics

## Deployment

Deploy to Render.com:
1. Push code to GitHub
2. Connect Render to your repo
3. Add environment variables in Render dashboard
4. Deploy!
