// YouTube Data API v3 service for uploading videos

declare const gapi: any

// Download video as Blob from URL
export async function downloadVideoBlob(url: string): Promise<Blob> {
    try {
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`Failed to download video: ${response.status}`)
        }
        const blob = await response.blob()
        return blob
    } catch (error) {
        console.error('Error downloading video:', error)
        throw error
    }
}

// Upload video to YouTube as unlisted Short
export async function uploadToYouTube(
    videoBlob: Blob,
    title: string,
    description: string = 'Saved from Instagram for personal use',
    onProgress?: (progress: number) => void
): Promise<string> {
    try {
        // Ensure GAPI is loaded
        if (typeof gapi === 'undefined' || !gapi.client) {
            throw new Error('Google API not loaded')
        }

        // Check if user is authenticated
        const token = gapi.client.getToken()
        if (!token) {
            throw new Error('User not authenticated')
        }

        // Prepare metadata
        const metadata = {
            snippet: {
                title: title || `Instagram Reel - ${new Date().toLocaleDateString()}`,
                description: description,
                categoryId: '22', // People & Blogs
            },
            status: {
                privacyStatus: 'unlisted', // Unlisted - only accessible via link
                selfDeclaredMadeForKids: false,
            },
        }

        // Create form data for upload
        const boundary = 'batch_boundary_' + Date.now()
        const delimiter = '\r\n--' + boundary + '\r\n'
        const close_delim = '\r\n--' + boundary + '--'

        const metadataStr = JSON.stringify(metadata)
        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            metadataStr +
            delimiter +
            'Content-Type: video/mp4\r\n' +
            'Content-Transfer-Encoding: binary\r\n\r\n'

        // Convert blob to array buffer
        const videoData = await videoBlob.arrayBuffer()

        // Create the full request body
        const uint8metaData = new TextEncoder().encode(multipartRequestBody)
        const uint8videoData = new Uint8Array(videoData)
        const uint8closeDelim = new TextEncoder().encode(close_delim)

        const totalLength = uint8metaData.length + uint8videoData.length + uint8closeDelim.length
        const combinedData = new Uint8Array(totalLength)

        combinedData.set(uint8metaData, 0)
        combinedData.set(uint8videoData, uint8metaData.length)
        combinedData.set(uint8closeDelim, uint8metaData.length + uint8videoData.length)

        // Upload using XMLHttpRequest for progress tracking
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest()

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    const progress = (e.loaded / e.total) * 100
                    onProgress(progress)
                }
            })

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText)
                        const videoId = response.id
                        console.log('Video uploaded successfully:', videoId)
                        resolve(videoId)
                    } catch (error) {
                        reject(new Error('Failed to parse upload response'))
                    }
                } else {
                    reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`))
                }
            })

            xhr.addEventListener('error', () => {
                reject(new Error('Network error during upload'))
            })

            xhr.open('POST', 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status')
            xhr.setRequestHeader('Authorization', 'Bearer ' + token.access_token)
            xhr.setRequestHeader('Content-Type', 'multipart/related; boundary=' + boundary)

            xhr.send(combinedData.buffer)
        })

    } catch (error) {
        console.error('Error uploading to YouTube:', error)
        throw error
    }
}

// Check remaining YouTube quota (approximate)
export async function checkYouTubeQuota(): Promise<{ remaining: number, dailyLimit: number }> {
    // YouTube API quota: 10,000 units per day
    // Upload costs ~1,600 units
    // This is a simple estimate - actual quota tracking requires backend
    const dailyLimit = 10000
    const uploadCost = 1600
    const maxUploadsPerDay = Math.floor(dailyLimit / uploadCost)

    return {
        remaining: maxUploadsPerDay, // Simplified - would need backend to track actual usage
        dailyLimit: maxUploadsPerDay
    }
}

// Get YouTube video embed ID from video ID
export function getYouTubeEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}`
}
