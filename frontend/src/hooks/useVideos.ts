import { useState, useEffect } from 'react'
import { VideoItem, loadVideosFromDrive, saveVideosToDrive } from '../services/videosService'
import { initializeGoogleAPI } from '../services/googleDrive'
import { useAppData } from '../contexts/AppDataContext'

/**
 * Custom hook to manage video data (loading, saving, deleting)
 * Uses preloaded data from AppDataContext for instant display
 */
export function useVideos() {
    const { videos: contextVideos, setVideos: setContextVideos } = useAppData()
    const [videos, setVideos] = useState<VideoItem[]>(contextVideos)
    const [loading, setLoading] = useState(false)

    // Use preloaded context data
    useEffect(() => {
        if (contextVideos.length > 0) {
            setVideos(contextVideos)
        } else {
            // Fallback: load if context is empty
            loadVideos()
        }
    }, [contextVideos])

    const loadVideos = async (retryCount = 0) => {
        try {
            setLoading(true)

            // First, show videos from localStorage immediately (fast)
            const backup = localStorage.getItem('videos_backup')
            if (backup) {
                try {
                    const localVideos = JSON.parse(backup).map((v: any) => ({
                        ...v,
                        addedAt: new Date(v.addedAt)
                    }))
                    setVideos(localVideos)
                    setContextVideos(localVideos)
                } catch (e) {
                    console.error('Failed to parse backup:', e)
                }
            }

            // Then try loading from Drive
            try {
                await initializeGoogleAPI()
                const driveVideos = await loadVideosFromDrive()
                if (driveVideos.length > 0) {
                    setVideos(driveVideos)
                    setContextVideos(driveVideos)
                    localStorage.setItem('videos_backup', JSON.stringify(driveVideos))
                }
            } catch (driveErr) {
                console.warn('Drive load failed, will retry:', driveErr)

                // Retry after 2 seconds if API wasn't ready (max 3 retries)
                if (retryCount < 3) {
                    setTimeout(() => {
                        loadVideos(retryCount + 1)
                    }, 2000)
                }
            }
        } finally {
            setLoading(false)
        }
    }

    const saveVideos = async (updatedVideos: VideoItem[]) => {
        try {
            // Save to localStorage immediately
            localStorage.setItem('videos_backup', JSON.stringify(updatedVideos))
            setVideos(updatedVideos)
            setContextVideos(updatedVideos)

            // Then sync to Drive
            await saveVideosToDrive(updatedVideos)
        } catch (error) {
            console.error('Failed to save videos:', error)
            throw error
        }
    }

    const addVideo = async (newVideo: VideoItem) => {
        const updatedVideos = [newVideo, ...videos]
        await saveVideos(updatedVideos)
    }

    const deleteVideos = async (videoIds: string[]) => {
        const updatedVideos = videos.filter(v => !videoIds.includes(v.id))
        await saveVideos(updatedVideos)
    }

    return {
        videos,
        loading,
        loadVideos,
        addVideo,
        deleteVideos,
        setVideos: (vids: VideoItem[]) => {
            setVideos(vids)
            setContextVideos(vids)
        }
    }
}
