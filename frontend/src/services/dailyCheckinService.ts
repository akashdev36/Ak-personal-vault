/**
 * Daily Check-in Service
 * Stores daily check-in data (mood, water, sleep, note) to Google Drive
 */

import { getCurrentUser } from './googleDrive'

export interface DailyCheckIn {
    date: string          // YYYY-MM-DD format
    mood: string          // Emoji
    waterGlasses: number  // 0-8
    sleepHours: number    // 0-12
    note: string          // Daily reflection
    timestamp?: string    // ISO timestamp when saved
}

const CHECKIN_FILE_NAME = 'daily_checkins.json'
let checkInFileId: string | null = null

/**
 * Find or create the check-ins file in Google Drive
 */
async function getOrCreateCheckInFile(): Promise<string> {
    if (checkInFileId) return checkInFileId

    const user = getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    // Search for existing file
    const searchResponse = await window.gapi.client.drive.files.list({
        q: `name='${CHECKIN_FILE_NAME}' and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)'
    })

    const files = searchResponse.result.files
    if (files && files.length > 0 && files[0].id) {
        checkInFileId = files[0].id
        return files[0].id
    }

    // Create new file
    const createResponse = await window.gapi.client.drive.files.create({
        resource: {
            name: CHECKIN_FILE_NAME,
            mimeType: 'application/json'
        },
        fields: 'id'
    })

    if (!createResponse.result.id) {
        throw new Error('Failed to create check-in file')
    }

    const newFileId = createResponse.result.id
    checkInFileId = newFileId

    // Initialize with empty object
    await window.gapi.client.request({
        path: `/upload/drive/v3/files/${newFileId}`,
        method: 'PATCH',
        params: { uploadType: 'media' },
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    })

    return newFileId
}

/**
 * Load all check-ins from Google Drive
 */
export async function loadCheckInsFromDrive(): Promise<Record<string, DailyCheckIn>> {
    try {
        const fileId = await getOrCreateCheckInFile()

        const response = await window.gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        })

        return response.result || {}
    } catch (error) {
        console.error('Error loading check-ins:', error)
        return {}
    }
}

/**
 * Save a check-in to Google Drive
 */
export async function saveCheckInToDrive(checkIn: DailyCheckIn): Promise<void> {
    try {
        // Load existing check-ins
        const allCheckIns = await loadCheckInsFromDrive()

        // Add/update this check-in
        allCheckIns[checkIn.date] = {
            ...checkIn,
            timestamp: new Date().toISOString()
        }

        // Save back to Drive
        const fileId = await getOrCreateCheckInFile()
        await window.gapi.client.request({
            path: `/upload/drive/v3/files/${fileId}`,
            method: 'PATCH',
            params: { uploadType: 'media' },
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(allCheckIns)
        })

        // Also save to localStorage as backup
        localStorage.setItem('checkins_backup', JSON.stringify(allCheckIns))

        console.log('✅ Check-in saved to Drive')
    } catch (error) {
        console.error('Error saving check-in:', error)
        throw error
    }
}

/**
 * Get check-in for a specific date
 */
export async function getCheckInForDate(date: string): Promise<DailyCheckIn | null> {
    const allCheckIns = await loadCheckInsFromDrive()
    return allCheckIns[date] || null
}

/**
 * Get today's date in YYYY-MM-DD format (local timezone)
 */
export function getTodayDateString(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/**
 * Check if a date is today
 */
export function isToday(date: string): boolean {
    return date === getTodayDateString()
}

