import { useState, useCallback } from 'react'

/**
 * Simplified hook for video player state
 * Video playback is now controlled by Intersection Observer in VideoPlayer component
 */
export function useVideoPlayer() {
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0)

    // Reset to first video
    const reset = useCallback(() => {
        setCurrentVideoIndex(0)
    }, [])

    return {
        currentVideoIndex,
        setCurrentVideoIndex,
        reset
    }
}
