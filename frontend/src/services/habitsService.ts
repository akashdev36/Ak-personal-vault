import { GOOGLE_CONFIG } from '../config/google'
import { refreshTokenIfNeeded, getCurrentUser } from './googleDrive'

export interface Habit {
    id: string
    name: string
    color: string
    icon: string
    createdAt: Date
    goal: 'daily' | 'weekly'
}

export interface HabitEntry {
    habitId: string
    date: string // YYYY-MM-DD format
    completed: boolean
}

let habitsFolderId: string | null = null

// Ensure Google API is ready with token
const ensureGapiReady = async (): Promise<boolean> => {
    if (!window.gapi) {
        console.error('Google API not loaded')
        return false
    }

    if (!window.gapi.client) {
        await new Promise(resolve => setTimeout(resolve, 500))
        if (!window.gapi.client) {
            console.error('Google API client not loaded')
            return false
        }
    }

    if (!window.gapi.client.drive) {
        try {
            await window.gapi.client.load('drive', 'v3')
        } catch (err) {
            console.error('Failed to load Drive API:', err)
            return false
        }
    }

    let token = window.gapi.client.getToken()
    if (!token) {
        const user = getCurrentUser()
        if (user && user.accessToken) {
            window.gapi.client.setToken({ access_token: user.accessToken })
            token = { access_token: user.accessToken }
        } else {
            console.error('No access token available')
            return false
        }
    }

    await refreshTokenIfNeeded()
    return true
}

// Get or create the habits folder in Google Drive
const getOrCreateHabitsFolder = async (): Promise<string> => {
    try {
        const isReady = await ensureGapiReady()
        if (!isReady) {
            throw new Error('Google API not ready')
        }

        if (habitsFolderId) {
            return habitsFolderId
        }

        const folderName = `${GOOGLE_CONFIG.driveFolder}_Habits`

        // Search for existing folder
        const response = await window.gapi.client.drive.files.list({
            q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive',
        })

        if (response.result.files && response.result.files.length > 0) {
            habitsFolderId = response.result.files[0].id!
            return habitsFolderId!
        }

        // Create folder if it doesn't exist
        const createResponse = await window.gapi.client.drive.files.create({
            resource: {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
            },
            fields: 'id',
        })

        habitsFolderId = createResponse.result.id!
        return habitsFolderId!
    } catch (error: any) {
        console.error('Error getting/creating habits folder:', error)

        if (error.status === 401 || error.status === 403) {
            localStorage.clear()
            window.location.reload()
        }

        throw error
    }
}

// Save habits to Google Drive
export const saveHabitsToDrive = async (habits: Habit[], entries: HabitEntry[]): Promise<void> => {
    try {
        const folderId = await getOrCreateHabitsFolder()

        const searchResponse = await window.gapi.client.drive.files.list({
            q: `name='habits.json' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive',
        })

        const data = { habits, entries }
        const habitsData = JSON.stringify(data, null, 2)
        const file = new Blob([habitsData], { type: 'application/json' })

        if (searchResponse.result.files && searchResponse.result.files.length > 0) {
            const fileId = searchResponse.result.files[0].id
            const metadata = {
                name: 'habits.json',
                mimeType: 'application/json',
            }

            const form = new FormData()
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
            form.append('file', file)

            await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${window.gapi.client.getToken().access_token}`,
                },
                body: form,
            })
        } else {
            const metadata = {
                name: 'habits.json',
                mimeType: 'application/json',
                parents: [folderId],
            }

            const form = new FormData()
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
            form.append('file', file)

            await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${window.gapi.client.getToken().access_token}`,
                },
                body: form,
            })
        }
    } catch (error) {
        console.error('Error saving habits to Drive:', error)
        throw error
    }
}

// Load habits from Google Drive
export const loadHabitsFromDrive = async (): Promise<{ habits: Habit[], entries: HabitEntry[] }> => {
    try {
        const folderId = await getOrCreateHabitsFolder()

        const searchResponse = await window.gapi.client.drive.files.list({
            q: `name='habits.json' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive',
        })

        if (!searchResponse.result.files || searchResponse.result.files.length === 0) {
            return { habits: [], entries: [] }
        }

        const fileId = searchResponse.result.files[0].id

        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: {
                Authorization: `Bearer ${window.gapi.client.getToken().access_token}`,
            },
        })

        const data = await response.json()

        // Convert date strings back to Date objects
        const habits = data.habits.map((habit: any) => ({
            ...habit,
            createdAt: new Date(habit.createdAt),
        }))

        return { habits, entries: data.entries || [] }
    } catch (error: any) {
        console.error('Error loading habits from Drive:', error)

        if (error.status === 401 || error.status === 403) {
            localStorage.clear()
            window.location.reload()
        }

        return { habits: [], entries: [] }
    }
}

// Calculate streak statistics
export const calculateStreaks = (habitId: string, entries: HabitEntry[]): { current: number, longest: number } => {
    const habitEntries = entries
        .filter(e => e.habitId === habitId && e.completed)
        .map(e => e.date)
        .sort((a, b) => b.localeCompare(a)) // Sort descending (newest first)

    if (habitEntries.length === 0) {
        return { current: 0, longest: 0 }
    }

    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Calculate current streak (must include today or yesterday)
    for (let i = 0; i < habitEntries.length; i++) {
        const entryDate = new Date(habitEntries[i])
        entryDate.setHours(0, 0, 0, 0)

        const expectedDate = new Date(today)
        expectedDate.setDate(today.getDate() - i)
        expectedDate.setHours(0, 0, 0, 0)

        if (entryDate.getTime() === expectedDate.getTime()) {
            currentStreak++
        } else {
            break
        }
    }

    // Calculate longest streak
    for (let i = 0; i < habitEntries.length; i++) {
        if (i === 0) {
            tempStreak = 1
        } else {
            const prevDate = new Date(habitEntries[i - 1])
            const currDate = new Date(habitEntries[i])
            const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24))

            if (diffDays === 1) {
                tempStreak++
            } else {
                longestStreak = Math.max(longestStreak, tempStreak)
                tempStreak = 1
            }
        }
    }
    longestStreak = Math.max(longestStreak, tempStreak)

    return { current: currentStreak, longest: longestStreak }
}

// Get today's date in YYYY-MM-DD format
export const getTodayDate = (): string => {
    const today = new Date()
    return today.toISOString().split('T')[0]
}

// Get date N days ago in YYYY-MM-DD format
export const getDateDaysAgo = (days: number): string => {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date.toISOString().split('T')[0]
}
