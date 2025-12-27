import { GOOGLE_CONFIG } from '../config/google'
import { refreshTokenIfNeeded } from './googleDrive'

export interface NoteItem {
    id: number
    title: string
    content: string
    createdAt: Date
    isPinned?: boolean
}

let notesFolderId: string | null = null

// Get or create the notes folder in Google Drive
const getOrCreateNotesFolder = async (): Promise<string> => {
    try {
        // Refresh token if needed
        await refreshTokenIfNeeded()

        if (notesFolderId) {
            return notesFolderId
        }

        // Search for existing folder
        const response = await window.gapi.client.drive.files.list({
            q: `name='${GOOGLE_CONFIG.driveFolder}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive',
        })

        if (response.result.files && response.result.files.length > 0) {
            notesFolderId = response.result.files[0].id!
            return notesFolderId!
        }

        // Create folder if it doesn't exist
        const createResponse = await window.gapi.client.drive.files.create({
            resource: {
                name: GOOGLE_CONFIG.driveFolder,
                mimeType: 'application/vnd.google-apps.folder',
            },
            fields: 'id',
        })

        notesFolderId = createResponse.result.id!
        return notesFolderId!
    } catch (error: any) {
        console.error('Error getting/creating folder:', error)

        // Handle authentication errors
        if (error.status === 401 || error.status === 403) {
            localStorage.clear()
            window.location.reload()
        }

        throw error
    }
}

// Save notes to Google Drive
export const saveNotesToDrive = async (notes: NoteItem[]): Promise<void> => {
    try {
        const folderId = await getOrCreateNotesFolder()

        // Search for existing notes file
        const searchResponse = await window.gapi.client.drive.files.list({
            q: `name='notes.json' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive',
        })

        const notesData = JSON.stringify(notes, null, 2)
        const file = new Blob([notesData], { type: 'application/json' })

        if (searchResponse.result.files && searchResponse.result.files.length > 0) {
            // Update existing file
            const fileId = searchResponse.result.files[0].id
            const metadata = {
                name: 'notes.json',
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
            // Create new file
            const metadata = {
                name: 'notes.json',
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
        console.error('Error saving notes to Drive:', error)
        throw error
    }
}

// Load notes from Google Drive
export const loadNotesFromDrive = async (): Promise<NoteItem[]> => {
    try {
        const folderId = await getOrCreateNotesFolder()

        // Search for notes file
        const searchResponse = await window.gapi.client.drive.files.list({
            q: `name='notes.json' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive',
        })

        if (!searchResponse.result.files || searchResponse.result.files.length === 0) {
            return []
        }

        const fileId = searchResponse.result.files[0].id

        // Download file content
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: {
                Authorization: `Bearer ${window.gapi.client.getToken().access_token}`,
            },
        })

        const notesData = await response.json()

        // Convert date strings back to Date objects
        return notesData.map((note: any) => ({
            ...note,
            createdAt: new Date(note.createdAt),
        }))
    } catch (error: any) {
        console.error('Error loading notes from Drive:', error)

        // Handle authentication errors
        if (error.status === 401 || error.status === 403) {
            localStorage.clear()
            window.location.reload()
        }

        return []
    }
}

// Delete all notes from Google Drive
export const deleteNotesFromDrive = async (): Promise<void> => {
    try {
        const folderId = await getOrCreateNotesFolder()

        // Search for notes file
        const searchResponse = await window.gapi.client.drive.files.list({
            q: `name='notes.json' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive',
        })

        if (searchResponse.result.files && searchResponse.result.files.length > 0) {
            const fileId = searchResponse.result.files[0].id
            await window.gapi.client.drive.files.delete({ fileId })
        }
    } catch (error) {
        console.error('Error deleting notes from Drive:', error)
        throw error
    }
}
