import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { NoteItem, loadNotesFromDrive } from '../services/notesService'
import { VideoItem, loadVideosFromDrive } from '../services/videosService'
import { initializeGoogleAPI } from '../services/googleDrive'

interface AppDataContextType {
    notes: NoteItem[]
    videos: VideoItem[]
    isLoading: boolean
    setNotes: (notes: NoteItem[]) => void
    setVideos: (videos: VideoItem[]) => void
    refreshNotes: () => Promise<void>
    refreshVideos: () => Promise<void>
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined)

interface AppDataProviderProps {
    children: ReactNode
    isAuthenticated: boolean
}

export function AppDataProvider({ children, isAuthenticated }: AppDataProviderProps) {
    const [notes, setNotes] = useState<NoteItem[]>([])
    const [videos, setVideos] = useState<VideoItem[]>([])
    const [isLoading, setIsLoading] = useState(false)

    // Preload data when user is authenticated
    useEffect(() => {
        if (isAuthenticated) {
            preloadData()
        }
    }, [isAuthenticated])

    const preloadData = async () => {
        setIsLoading(true)

        try {
            // Load from localStorage first for instant display
            const notesBackup = localStorage.getItem('notes_backup')
            const videosBackup = localStorage.getItem('videos_backup')

            if (notesBackup) {
                try {
                    const localNotes = JSON.parse(notesBackup).map((n: any) => ({
                        ...n,
                        createdAt: new Date(n.createdAt)
                    }))
                    setNotes(localNotes)
                } catch (e) {
                    console.error('Failed to parse notes backup:', e)
                }
            }

            if (videosBackup) {
                try {
                    const localVideos = JSON.parse(videosBackup).map((v: any) => ({
                        ...v,
                        addedAt: new Date(v.addedAt)
                    }))
                    setVideos(localVideos)
                } catch (e) {
                    console.error('Failed to parse videos backup:', e)
                }
            }

            // Wait a bit for Google API to fully initialize before syncing
            await new Promise(resolve => setTimeout(resolve, 1000))

            // Then sync with Drive in background
            try {
                await initializeGoogleAPI()

                // Load both in parallel with error handling
                const [driveNotes, driveVideos] = await Promise.allSettled([
                    loadNotesFromDrive(),
                    loadVideosFromDrive()
                ])

                // Handle notes result
                if (driveNotes.status === 'fulfilled' && driveNotes.value.length > 0) {
                    // Sort notes
                    driveNotes.value.sort((a: NoteItem, b: NoteItem) => {
                        if (a.isPinned && !b.isPinned) return -1
                        if (!a.isPinned && b.isPinned) return 1
                        return b.createdAt.getTime() - a.createdAt.getTime()
                    })
                    setNotes(driveNotes.value)
                    localStorage.setItem('notes_backup', JSON.stringify(driveNotes.value))
                } else if (driveNotes.status === 'rejected') {
                    console.warn('Could not load notes from Drive:', driveNotes.reason)
                }

                // Handle videos result
                if (driveVideos.status === 'fulfilled' && driveVideos.value.length > 0) {
                    setVideos(driveVideos.value)
                    localStorage.setItem('videos_backup', JSON.stringify(driveVideos.value))
                } else if (driveVideos.status === 'rejected') {
                    console.warn('Could not load videos from Drive:', driveVideos.reason)
                }
            } catch (driveError) {
                console.warn('Drive sync skipped during preload:', driveError)
                // Continue - user can still use localStorage data
            }

        } catch (error) {
            console.error('Error preloading data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const refreshNotes = async () => {
        try {
            await initializeGoogleAPI()
            const driveNotes = await loadNotesFromDrive()
            if (driveNotes.length > 0) {
                driveNotes.sort((a: NoteItem, b: NoteItem) => {
                    if (a.isPinned && !b.isPinned) return -1
                    if (!a.isPinned && b.isPinned) return 1
                    return b.createdAt.getTime() - a.createdAt.getTime()
                })
                setNotes(driveNotes)
                localStorage.setItem('notes_backup', JSON.stringify(driveNotes))
            }
        } catch (error) {
            console.error('Error refreshing notes:', error)
        }
    }

    const refreshVideos = async () => {
        try {
            await initializeGoogleAPI()
            const driveVideos = await loadVideosFromDrive()
            if (driveVideos.length > 0) {
                setVideos(driveVideos)
                localStorage.setItem('videos_backup', JSON.stringify(driveVideos))
            }
        } catch (error) {
            console.error('Error refreshing videos:', error)
        }
    }

    return (
        <AppDataContext.Provider
            value={{
                notes,
                videos,
                isLoading,
                setNotes,
                setVideos,
                refreshNotes,
                refreshVideos
            }}
        >
            {children}
        </AppDataContext.Provider>
    )
}

export function useAppData() {
    const context = useContext(AppDataContext)
    if (context === undefined) {
        throw new Error('useAppData must be used within AppDataProvider')
    }
    return context
}
