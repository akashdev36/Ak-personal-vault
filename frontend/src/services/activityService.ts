/**
 * Activity Timeline Service
 * Stores and retrieves daily activity logs with timestamps
 */

import { getCurrentUser } from './googleDrive'

export interface ActivityEntry {
    id: string
    activity: string
    time: string       // HH:MM format
    timestamp: string  // ISO string
    date: string       // YYYY-MM-DD
    icon?: string      // Emoji icon for the activity
}

const ACTIVITIES_FILE_NAME = 'daily_activities.json'
let activitiesFileId: string | null = null

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/**
 * Get current time in HH:MM format
 */
export function getCurrentTime(): string {
    const now = new Date()
    return now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    })
}

/**
 * Auto-detect icon for activity based on keywords
 */
export function getActivityIcon(activity: string): string {
    const lower = activity.toLowerCase()

    if (lower.includes('wake') || lower.includes('morning')) return '🌅'
    if (lower.includes('exercise') || lower.includes('workout') || lower.includes('gym')) return '🏋️'
    if (lower.includes('breakfast')) return '🍳'
    if (lower.includes('lunch')) return '🍽️'
    if (lower.includes('dinner')) return '🍲'
    if (lower.includes('work') || lower.includes('office')) return '💼'
    if (lower.includes('meeting')) return '👥'
    if (lower.includes('study') || lower.includes('learn')) return '📚'
    if (lower.includes('code') || lower.includes('programming')) return '💻'
    if (lower.includes('read')) return '📖'
    if (lower.includes('walk') || lower.includes('running')) return '🚶'
    if (lower.includes('coffee') || lower.includes('tea')) return '☕'
    if (lower.includes('sleep') || lower.includes('nap')) return '😴'
    if (lower.includes('relax') || lower.includes('rest')) return '🛋️'
    if (lower.includes('family')) return '👨‍👩‍👧'
    if (lower.includes('call') || lower.includes('phone')) return '📞'
    if (lower.includes('shower') || lower.includes('bath')) return '🚿'
    if (lower.includes('movie') || lower.includes('video')) return '🎬'
    if (lower.includes('music')) return '🎵'
    if (lower.includes('game')) return '🎮'
    if (lower.includes('cook')) return '👨‍🍳'
    if (lower.includes('shop')) return '🛒'
    if (lower.includes('travel') || lower.includes('commute')) return '🚗'
    if (lower.includes('meditat')) return '🧘'
    if (lower.includes('pray')) return '🙏'
    if (lower.includes('plan') || lower.includes('task')) return '📝'

    return '⏱️' // Default icon
}

/**
 * Load activities from localStorage (primary) and sync with Drive in background
 */
export function loadActivitiesFromLocal(): Record<string, ActivityEntry[]> {
    try {
        const data = localStorage.getItem('activities_data')
        return data ? JSON.parse(data) : {}
    } catch {
        return {}
    }
}

/**
 * Get activities for a specific date
 */
export function getActivitiesForDate(date: string): ActivityEntry[] {
    const all = loadActivitiesFromLocal()
    return all[date] || []
}

/**
 * Get today's activities
 */
export function getTodayActivities(): ActivityEntry[] {
    return getActivitiesForDate(getTodayDate())
}

/**
 * Save a new activity
 */
export function saveActivity(activity: string): ActivityEntry {
    const all = loadActivitiesFromLocal()
    const today = getTodayDate()

    if (!all[today]) {
        all[today] = []
    }

    const newEntry: ActivityEntry = {
        id: Date.now().toString(),
        activity: activity.trim(),
        time: getCurrentTime(),
        timestamp: new Date().toISOString(),
        date: today,
        icon: getActivityIcon(activity)
    }

    all[today].push(newEntry)

    // Save to localStorage
    localStorage.setItem('activities_data', JSON.stringify(all))

    // Sync to Drive in background (optional enhancement)
    syncToDriveInBackground(all)

    return newEntry
}

/**
 * Delete an activity
 */
export function deleteActivity(date: string, activityId: string): void {
    const all = loadActivitiesFromLocal()
    if (all[date]) {
        all[date] = all[date].filter(a => a.id !== activityId)
        localStorage.setItem('activities_data', JSON.stringify(all))
    }
}

/**
 * Sync activities to Google Drive in background
 */
async function syncToDriveInBackground(data: Record<string, ActivityEntry[]>): Promise<void> {
    try {
        const user = getCurrentUser()
        if (!user) return

        // Find or create file
        if (!activitiesFileId) {
            const searchResponse = await window.gapi.client.drive.files.list({
                q: `name='${ACTIVITIES_FILE_NAME}' and trashed=false`,
                spaces: 'drive',
                fields: 'files(id, name)'
            })

            const files = searchResponse.result.files
            if (files && files.length > 0 && files[0].id) {
                activitiesFileId = files[0].id
            } else {
                // Create new file
                const createResponse = await window.gapi.client.drive.files.create({
                    resource: {
                        name: ACTIVITIES_FILE_NAME,
                        mimeType: 'application/json'
                    },
                    fields: 'id'
                })
                activitiesFileId = createResponse.result.id || null
            }
        }

        if (activitiesFileId) {
            await window.gapi.client.request({
                path: `/upload/drive/v3/files/${activitiesFileId}`,
                method: 'PATCH',
                params: { uploadType: 'media' },
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            console.log('✅ Activities synced to Drive')
        }
    } catch (error) {
        console.log('Could not sync to Drive:', error)
    }
}

/**
 * Get all dates that have activities
 */
export function getDatesWithActivities(): string[] {
    const all = loadActivitiesFromLocal()
    return Object.keys(all).filter(date => all[date].length > 0)
}
