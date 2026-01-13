"""
AI Prompts Configuration

All prompts are defined here for easy customization.
Modify these prompts to change AI behavior without touching provider code.

Variables in prompts use {variable_name} format for string formatting.
"""

# User configuration
USER_NAME = "Akash"


# ============================================================================
# CHAT PROMPTS
# ============================================================================

CHAT_SYSTEM_PROMPT = """
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
- IMPORTANT: Return ONLY the JSON object, no markdown formatting

Previous context: {context}
"""


# ============================================================================
# INSIGHTS PROMPTS
# ============================================================================

INSIGHTS_PROMPT = """
Analyze this tracking data and provide 2-3 helpful insights:

Data: {tracking_data}

Return insights as a JSON array of strings. Focus on:
- Patterns and correlations
- Achievements and progress
- Helpful suggestions

Format: ["insight 1", "insight 2", "insight 3"]
"""


# ============================================================================
# DAILY QUOTE PROMPTS
# ============================================================================

DAILY_QUOTE_PROMPT = """
Generate one powerful, personalized motivational quote for {user_name} who is working on personal growth and building habits.

Requirements:
- Maximum 12-15 words
- MUST include the name "{user_name}" naturally in the quote
- Should feel genuine and actionable, not cheesy
- Focus on: consistency, small steps, discipline, growth mindset, or self-improvement
- Can include ONE relevant emoji at the end
- No author attribution

Good examples:
- "{user_name}, small daily improvements compound into remarkable transformations. 🌱"
- "Every habit you build, {user_name}, is proof of your commitment to growth. 💪"
- "{user_name}, the person you become tomorrow starts with today's choices. ✨"
- "Keep going, {user_name}. Your consistency is your superpower. 🔥"

Return ONLY the quote text, nothing else.
"""

# Fallback quote when AI fails
DAILY_QUOTE_FALLBACK = "Small steps every day lead to big changes, {user_name}. 🌱"


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_chat_prompt(message: str, context: str = "First conversation") -> str:
    """Format the chat prompt with variables."""
    return CHAT_SYSTEM_PROMPT.format(message=message, context=context)


def get_insights_prompt(tracking_data: str) -> str:
    """Format the insights prompt with tracking data."""
    return INSIGHTS_PROMPT.format(tracking_data=tracking_data)


def get_daily_quote_prompt(user_name: str = None) -> str:
    """Format the daily quote prompt with user name."""
    name = user_name or USER_NAME
    return DAILY_QUOTE_PROMPT.format(user_name=name)


def get_daily_quote_fallback(user_name: str = None) -> str:
    """Get fallback quote with user name."""
    name = user_name or USER_NAME
    return DAILY_QUOTE_FALLBACK.format(user_name=name)


# ============================================================================
# CONVERSATION PARTNER PROMPTS
# ============================================================================

CONVERSATION_PARTNER_PROMPT = """
You are a friendly conversation partner. The user is talking to you casually.

The user said: "{message}"

Respond naturally like a friend would. Be:
- Friendly and warm
- Conversational (not formal)
- Brief (1-3 sentences max)
- Interested in what they're saying

Don't give grammar lessons or corrections. Just have a normal friendly chat!
"""


def get_english_coaching_prompt(message: str) -> str:
    """Format the conversation partner prompt."""
    return CONVERSATION_PARTNER_PROMPT.format(message=message)

