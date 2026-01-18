import { GOOGLE_CONFIG } from '../config/google'
import { refreshTokenIfNeeded, getCurrentUser, handleAuthError } from './googleDrive'

export interface VideoItem {
    id: string
    url: string
    platform: 'youtube' | 'instagram' | 'other'
    title: string
    thumbnail?: string
    embedId?: string
    extractedVideoUrl?: string  // Direct video URL from RapidAPI for Instagram
    addedAt: Date
}

let videosFolderId: string | null = null

// Ensure Google API is ready with token
const ensureGapiReady = async (): Promise<boolean> => {
    // Check if gapi exists
    if (!window.gapi) {
        console.error('Google API not loaded')
        return false
    }

    // Wait for gapi.client to be available (it might be loading)
    if (!window.gapi.client) {
        // Try waiting a bit for it to load
        await new Promise(resolve => setTimeout(resolve, 500))
        if (!window.gapi.client) {
            console.error('Google API client not loaded')
            return false
        }
    }

    // Ensure Drive API is loaded
    if (!window.gapi.client.drive) {
        try {
            await window.gapi.client.load('drive', 'v3')
        } catch (err) {
            console.error('Failed to load Drive API:', err)
            return false
        }
    }

    // Check if token exists, if not try to restore from localStorage
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

    // Try to refresh token if needed
    await refreshTokenIfNeeded()
    return true
}

// Extract video info from URL
export const parseVideoUrl = (url: string): { platform: VideoItem['platform'], embedId: string } | null => {
    // YouTube patterns
    const youtubePatterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/
    ]

    for (const pattern of youtubePatterns) {
        const match = url.match(pattern)
        if (match) {
            return { platform: 'youtube', embedId: match[1] }
        }
    }

    // Instagram patterns (reels)
    const instagramPattern = /instagram\.com\/(?:reel|reels|p)\/([a-zA-Z0-9_-]+)/
    const instaMatch = url.match(instagramPattern)
    if (instaMatch) {
        return { platform: 'instagram', embedId: instaMatch[1] }
    }

    return null
}

// Get YouTube thumbnail
export const getYouTubeThumbnail = (embedId: string): string => {
    return `https://img.youtube.com/vi/${embedId}/mqdefault.jpg`
}

// Extract Instagram video URL using RapidAPI
export const extractInstagramVideoUrl = async (instagramUrl: string): Promise<{ videoUrl: string, thumbnail?: string } | null> => {
    try {
        const apiKey = import.meta.env.VITE_RAPIDAPI_KEY
        const apiHost = import.meta.env.VITE_RAPIDAPI_HOST

        if (!apiKey || !apiHost) {
            console.warn('RapidAPI key or host not configured')
            return null
        }

        // Call Instagram Video API
        // GET /fetch?url=https://www.instagram.com/p/ABC123xyz/
        const url = `https://${apiHost}/fetch?url=${encodeURIComponent(instagramUrl)}`

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': apiHost
            }
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('RapidAPI request failed:', response.status, errorText)
            return null
        }

        const data = await response.json()
        console.log('Instagram API response:', data) // For debugging

        // Extract video URL from response
        // Actual response structure: data.data.data[0] (not data.downloadedURL as in docs)
        const videoData = data?.data?.data?.[0]

        if (videoData && videoData.url) {
            const videoUrl = videoData.url
            const thumbnail = videoData.thumbnail

            console.log('Extracted video URL:', videoUrl)
            return { videoUrl, thumbnail }
        }

        console.error('Could not extract video URL from response. Response structure:', data)
        return null

    } catch (error) {
        console.error('Error extracting Instagram video:', error)
        return null
    }
}

// Get or create the videos folder in Google Drive
const getOrCreateVideosFolder = async (): Promise<string> => {
    try {
        const isReady = await ensureGapiReady()
        if (!isReady) {
            throw new Error('Google API not ready')
        }

        if (videosFolderId) {
            return videosFolderId
        }

        const folderName = `${GOOGLE_CONFIG.driveFolder}_Videos`

        // Search for existing folder
        const response = await window.gapi.client.drive.files.list({
            q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive',
        })

        if (response.result.files && response.result.files.length > 0) {
            videosFolderId = response.result.files[0].id!
            return videosFolderId!
        }

        // Create folder if it doesn't exist
        const createResponse = await window.gapi.client.drive.files.create({
            resource: {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
            },
            fields: 'id',
        })

        videosFolderId = createResponse.result.id!
        return videosFolderId!
    } catch (error: any) {
        console.error('Error getting/creating videos folder:', error)

        if (error.status === 401 || error.status === 403) {
            handleAuthError(error)
        }

        throw error
    }
}

// Save videos to Google Drive
export const saveVideosToDrive = async (videos: VideoItem[]): Promise<void> => {
    try {
        const folderId = await getOrCreateVideosFolder()

        const searchResponse = await window.gapi.client.drive.files.list({
            q: `name='videos.json' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive',
        })

        const videosData = JSON.stringify(videos, null, 2)
        const file = new Blob([videosData], { type: 'application/json' })

        if (searchResponse.result.files && searchResponse.result.files.length > 0) {
            const fileId = searchResponse.result.files[0].id
            const metadata = {
                name: 'videos.json',
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
                name: 'videos.json',
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
        console.error('Error saving videos to Drive:', error)
        throw error
    }
}

// Load videos from Google Drive
export const loadVideosFromDrive = async (): Promise<VideoItem[]> => {
    try {
        const folderId = await getOrCreateVideosFolder()

        const searchResponse = await window.gapi.client.drive.files.list({
            q: `name='videos.json' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive',
        })

        if (!searchResponse.result.files || searchResponse.result.files.length === 0) {
            return []
        }

        const fileId = searchResponse.result.files[0].id

        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: {
                Authorization: `Bearer ${window.gapi.client.getToken().access_token}`,
            },
        })

        const videosData = await response.json()

        return videosData.map((video: any) => ({
            ...video,
            addedAt: new Date(video.addedAt),
        }))
    } catch (error: any) {
        console.error('Error loading videos from Drive:', error)

        if (error.status === 401 || error.status === 403) {
            handleAuthError(error)
        }

        return []
    }
}
