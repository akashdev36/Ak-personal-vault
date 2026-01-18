/**
 * Google Photos API Service
 * Upload and retrieve daily photos using Google Photos Library API
 */

import { getCurrentUser } from './googleDrive'

const PHOTOS_API_BASE = 'https://photoslibrary.googleapis.com/v1'

export interface DailyPhoto {
    id: string
    baseUrl: string
    filename: string
    mimeType: string
    description?: string
    creationTime: string
    width: number
    height: number
}

/**
 * Get the access token from current user
 */
const getAccessToken = (): string | null => {
    const user = getCurrentUser()
    return user?.accessToken || null
}

/**
 * Create or get the album for daily photos
 * Album name format: "Daily Diary - YYYY-MM"
 */
async function getOrCreateMonthlyAlbum(date: string): Promise<string> {
    const accessToken = getAccessToken()
    if (!accessToken) throw new Error('Not authenticated')

    const [year, month] = date.split('-')
    const albumTitle = `Daily Diary - ${year}-${month}`

    // First, search for existing album
    const listResponse = await fetch(`${PHOTOS_API_BASE}/albums`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    })

    if (!listResponse.ok) {
        throw new Error(`Failed to list albums: ${listResponse.status}`)
    }

    const listData = await listResponse.json()
    const existingAlbum = listData.albums?.find((a: any) => a.title === albumTitle)

    if (existingAlbum) {
        return existingAlbum.id
    }

    // Create new album
    const createResponse = await fetch(`${PHOTOS_API_BASE}/albums`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            album: { title: albumTitle }
        }),
    })

    if (!createResponse.ok) {
        throw new Error(`Failed to create album: ${createResponse.status}`)
    }

    const createData = await createResponse.json()
    return createData.id
}

/**
 * Upload a photo to Google Photos
 * @param file - File or Blob to upload
 * @param date - Date string in YYYY-MM-DD format
 * @param filename - Original filename
 */
export async function uploadPhoto(
    file: File | Blob,
    date: string,
    filename?: string
): Promise<DailyPhoto> {
    const accessToken = getAccessToken()
    if (!accessToken) throw new Error('Not authenticated')

    try {
        // Step 1: Upload bytes to get upload token
        const uploadResponse = await fetch(`${PHOTOS_API_BASE}/uploads`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/octet-stream',
                'X-Goog-Upload-Content-Type': file.type || 'image/jpeg',
                'X-Goog-Upload-Protocol': 'raw',
            },
            body: file,
        })

        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status}`)
        }

        const uploadToken = await uploadResponse.text()

        // Step 2: Create media item with the upload token
        const albumId = await getOrCreateMonthlyAlbum(date)
        const photoName = filename || `photo_${date}_${Date.now()}.jpg`
        const description = `Daily photo for ${date}`

        const createResponse = await fetch(`${PHOTOS_API_BASE}/mediaItems:batchCreate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                albumId: albumId,
                newMediaItems: [{
                    description: description,
                    simpleMediaItem: {
                        fileName: photoName,
                        uploadToken: uploadToken,
                    }
                }]
            }),
        })

        if (!createResponse.ok) {
            throw new Error(`Create media item failed: ${createResponse.status}`)
        }

        const createData = await createResponse.json()
        const newItem = createData.newMediaItemResults?.[0]?.mediaItem

        if (!newItem) {
            throw new Error('Failed to create media item')
        }

        // Also save metadata to localStorage for faster retrieval
        savePhotoMetadata(date, {
            id: newItem.id,
            baseUrl: newItem.baseUrl,
            filename: newItem.filename,
            mimeType: newItem.mimeType,
            description: newItem.description,
            creationTime: newItem.mediaMetadata?.creationTime || new Date().toISOString(),
            width: newItem.mediaMetadata?.width,
            height: newItem.mediaMetadata?.height,
        })

        console.log('✅ Photo uploaded to Google Photos')
        return newItem
    } catch (error) {
        console.error('Error uploading photo:', error)
        throw error
    }
}

/**
 * Get photos for a specific date
 */
export async function getPhotosForDate(date: string): Promise<DailyPhoto[]> {
    const accessToken = getAccessToken()
    if (!accessToken) throw new Error('Not authenticated')

    try {
        // First check localStorage cache
        const cached = getPhotoMetadataForDate(date)
        if (cached.length > 0) {
            // Refresh base URLs (they expire)
            const refreshedPhotos = await refreshPhotoUrls(cached.map(p => p.id))
            return refreshedPhotos
        }

        // Search in Google Photos by date
        const [year, month, day] = date.split('-').map(Number)

        const searchResponse = await fetch(`${PHOTOS_API_BASE}/mediaItems:search`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filters: {
                    dateFilter: {
                        dates: [{
                            year: year,
                            month: month,
                            day: day,
                        }]
                    }
                },
                pageSize: 50
            }),
        })

        if (!searchResponse.ok) {
            throw new Error(`Search failed: ${searchResponse.status}`)
        }

        const searchData = await searchResponse.json()
        const items = searchData.mediaItems || []

        // Filter to only show photos with our description pattern
        const dailyPhotos = items.filter((item: any) =>
            item.description?.includes(`Daily photo for ${date}`)
        )

        return dailyPhotos.map((item: any) => ({
            id: item.id,
            baseUrl: item.baseUrl,
            filename: item.filename,
            mimeType: item.mimeType,
            description: item.description,
            creationTime: item.mediaMetadata?.creationTime,
            width: item.mediaMetadata?.width,
            height: item.mediaMetadata?.height,
        }))
    } catch (error) {
        console.error('Error getting photos:', error)
        return []
    }
}

/**
 * Refresh photo URLs (they expire after ~1 hour)
 */
async function refreshPhotoUrls(photoIds: string[]): Promise<DailyPhoto[]> {
    const accessToken = getAccessToken()
    if (!accessToken) throw new Error('Not authenticated')

    try {
        const response = await fetch(`${PHOTOS_API_BASE}/mediaItems:batchGet?mediaItemIds=${photoIds.join('&mediaItemIds=')}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        })

        if (!response.ok) {
            throw new Error(`Batch get failed: ${response.status}`)
        }

        const data = await response.json()
        return (data.mediaItemResults || []).map((result: any) => ({
            id: result.mediaItem?.id,
            baseUrl: result.mediaItem?.baseUrl,
            filename: result.mediaItem?.filename,
            mimeType: result.mediaItem?.mimeType,
            description: result.mediaItem?.description,
            creationTime: result.mediaItem?.mediaMetadata?.creationTime,
            width: result.mediaItem?.mediaMetadata?.width,
            height: result.mediaItem?.mediaMetadata?.height,
        })).filter((p: DailyPhoto) => p.id)
    } catch (error) {
        console.error('Error refreshing photo URLs:', error)
        return []
    }
}

/**
 * Get all dates that have photos (for calendar indicators)
 */
export function getDatesWithPhotos(): string[] {
    const metadata = getAllPhotoMetadata()
    return Object.keys(metadata)
}

// ==================== LOCAL STORAGE HELPERS ====================

interface PhotoMetadataCache {
    [date: string]: DailyPhoto[]
}

const PHOTO_METADATA_KEY = 'daily_photos_metadata'

function getAllPhotoMetadata(): PhotoMetadataCache {
    try {
        const data = localStorage.getItem(PHOTO_METADATA_KEY)
        return data ? JSON.parse(data) : {}
    } catch {
        return {}
    }
}

function getPhotoMetadataForDate(date: string): DailyPhoto[] {
    const all = getAllPhotoMetadata()
    return all[date] || []
}

function savePhotoMetadata(date: string, photo: DailyPhoto): void {
    const all = getAllPhotoMetadata()
    if (!all[date]) {
        all[date] = []
    }
    // Avoid duplicates
    if (!all[date].some(p => p.id === photo.id)) {
        all[date].push(photo)
    }
    localStorage.setItem(PHOTO_METADATA_KEY, JSON.stringify(all))
}
