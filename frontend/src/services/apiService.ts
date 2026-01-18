/**
 * API Service for Backend Integration
 * Handles all calls to the FastAPI backend
 */

// Backend URL - switch between local and production
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Track if backend error was shown (show only once per session)
let backendErrorShown = false

/**
 * Handle API errors - dispatch event for toast notification
 */
const handleApiError = (error: any, context: string): void => {
    console.error(`API Error (${context}):`, error)

    // Show toast only once per session for connection errors
    if (!backendErrorShown && (error.message?.includes('fetch') || error.message?.includes('Failed'))) {
        backendErrorShown = true
        window.dispatchEvent(new CustomEvent('api-error', {
            detail: { message: `Backend unavailable. Some features may not work.` }
        }))
    }
}

/**
 * Reset backend error flag (call on successful connection)
 */
export const resetBackendErrorFlag = (): void => {
    backendErrorShown = false
}

interface ChatMessage {
    message: string
    user_id: string
}

interface ChatResponse {
    response: string
    extracted_data?: {
        sleep_hours?: number
        water_liters?: number
        gym_session?: boolean
        mood?: string
        work_hours?: number
        learning_hours?: number
    }
    timestamp: string
}

interface ChatHistoryItem {
    id: string
    user_id: string
    role: 'user' | 'assistant'
    message: string
    created_at: string
}

/**
 * Send a message to the AI assistant
 */
export async function sendChatMessage(message: string, userEmail: string): Promise<ChatResponse> {
    const response = await fetch(`${API_BASE_URL}/api/chat/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message,
            user_id: userEmail
        } as ChatMessage)
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to send message')
    }

    return response.json()
}

/**
 * Get chat history for a user
 */
export async function getChatHistory(userEmail: string, limit: number = 20): Promise<ChatHistoryItem[]> {
    const response = await fetch(`${API_BASE_URL}/api/chat/history/${encodeURIComponent(userEmail)}?limit=${limit}`)

    if (!response.ok) {
        throw new Error('Failed to fetch chat history')
    }

    const data = await response.json()
    return data.history
}

/**
 * Get dashboard analytics
 */
export async function getDashboardAnalytics(userEmail: string, days: number = 7) {
    const response = await fetch(`${API_BASE_URL}/api/analytics/dashboard/${encodeURIComponent(userEmail)}?days=${days}`)

    if (!response.ok) {
        throw new Error('Failed to fetch analytics')
    }

    return response.json()
}

/**
 * Log a tracking entry
 */
export async function logTrackingEntry(
    userEmail: string,
    type: 'sleep' | 'water' | 'gym' | 'mood' | 'work' | 'learning',
    value: number,
    notes?: string
) {
    const response = await fetch(`${API_BASE_URL}/api/tracking/log`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            user_id: userEmail,
            type,
            value,
            notes
        })
    })

    if (!response.ok) {
        throw new Error('Failed to log entry')
    }

    return response.json()
}

/**
 * Get tracking entries
 */
export async function getTrackingEntries(userEmail: string, type?: string, limit: number = 30) {
    let url = `${API_BASE_URL}/api/tracking/${encodeURIComponent(userEmail)}?limit=${limit}`
    if (type) {
        url += `&type=${type}`
    }

    const response = await fetch(url)

    if (!response.ok) {
        throw new Error('Failed to fetch entries')
    }

    return response.json()
}

/**
 * Get today's daily motivational quote
 */
export async function getDailyQuote(): Promise<{ quote: string; date: string }> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/quotes/daily-quote`)

        if (!response.ok) {
            throw new Error('Failed to fetch daily quote')
        }

        return response.json()
    } catch (error) {
        handleApiError(error, 'getDailyQuote')
        throw error
    }
}

/**
 * Check if backend is healthy
 */
export async function checkBackendHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE_URL}/health`)
        return response.ok
    } catch {
        return false
    }
}

/**
 * Send a message to the English coaching assistant
 * Uses a different prompt than regular chat for language practice
 */
export async function sendCoachingMessage(message: string, userEmail: string): Promise<{ feedback: string }> {
    const response = await fetch(`${API_BASE_URL}/api/coach/feedback`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message,
            user_id: userEmail
        })
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to get coaching feedback')
    }

    return response.json()
}

