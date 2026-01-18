import { initializeGoogleAPI } from './googleDrive'

export interface JournalEntry {
    date: string
    mood: string
    note: string
    timestamp?: string  // Full ISO timestamp with time
}

const JOURNAL_FILE_NAME = 'journal_entries.json'

// Save journal entries to Google Drive
export async function saveJournalToDrive(entries: Record<string, JournalEntry>): Promise<void> {
    try {
        await initializeGoogleAPI()

        const content = JSON.stringify(entries, null, 2)
        const blob = new Blob([content], { type: 'application/json' })

        // Search for existing journal file
        const response = await window.gapi.client.drive.files.list({
            q: `name='${JOURNAL_FILE_NAME}' and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name)',
        })

        const files = response.result.files || []

        if (files.length > 0) {
            // Update existing file
            const fileId = files[0].id
            const metadata = {
                name: JOURNAL_FILE_NAME,
                mimeType: 'application/json',
            }

            const form = new FormData()
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
            form.append('file', blob)

            await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${window.gapi.client.getToken().access_token}`,
                },
                body: form,
            })
        } else {
            // Create new file
            const metadata = {
                name: JOURNAL_FILE_NAME,
                mimeType: 'application/json',
            }

            const form = new FormData()
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
            form.append('file', blob)

            await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${window.gapi.client.getToken().access_token}`,
                },
                body: form,
            })
        }

        // Also save to localStorage as backup
        localStorage.setItem('daily_checkins', JSON.stringify(entries))
    } catch (error) {
        console.error('Error saving journal to Drive:', error)
        // Fallback to localStorage
        localStorage.setItem('daily_checkins', JSON.stringify(entries))
        throw error
    }
}

// Load journal entries from Google Drive
export async function loadJournalFromDrive(): Promise<Record<string, JournalEntry>> {
    try {
        await initializeGoogleAPI()

        // Search for journal file
        const response = await window.gapi.client.drive.files.list({
            q: `name='${JOURNAL_FILE_NAME}' and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name)',
        })

        const files = response.result.files || []

        if (files.length > 0) {
            const fileId = files[0].id

            // Download file content
            const fileResponse = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                {
                    headers: {
                        Authorization: `Bearer ${window.gapi.client.getToken().access_token}`,
                    },
                }
            )

            const content = await fileResponse.text()
            const entries = JSON.parse(content)

            // Save to localStorage as backup
            localStorage.setItem('daily_checkins', JSON.stringify(entries))

            return entries
        } else {
            // No file found, check localStorage
            const localData = localStorage.getItem('daily_checkins')
            if (localData) {
                const entries = JSON.parse(localData)
                // Upload to Drive for next time
                await saveJournalToDrive(entries)
                return entries
            }
            return {}
        }
    } catch (error) {
        console.error('Error loading journal from Drive:', error)
        // Fallback to localStorage
        const localData = localStorage.getItem('daily_checkins')
        return localData ? JSON.parse(localData) : {}
    }
}
