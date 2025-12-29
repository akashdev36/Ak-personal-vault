import { useState, useRef, useEffect } from 'react'
import { VideoItem } from '../services/videosService'

interface VideoPlayerProps {
    videos: VideoItem[]
    initialIndex?: number
    onClose: () => void
}

export default function VideoPlayer({ videos, initialIndex = 0, onClose }: VideoPlayerProps) {
    const [currentVideoIndex, setCurrentVideoIndex] = useState(initialIndex)
    const containerRef = useRef<HTMLDivElement>(null)

    // Scroll to initial video on mount
    useEffect(() => {
        if (containerRef.current && initialIndex > 0) {
            containerRef.current.scrollTo({
                top: initialIndex * window.innerHeight,
                behavior: 'instant' as ScrollBehavior
            })
        }
    }, [initialIndex])

    // Auto-advance when video ends
    const handleVideoEnd = (index: number) => {
        if (index < videos.length - 1 && containerRef.current) {
            const nextPosition = (index + 1) * window.innerHeight
            containerRef.current.scrollTo({
                top: nextPosition,
                behavior: 'smooth'
            })
        }
    }

    return (
        <div className="fixed inset-0 bg-black z-50">
            {/* Close Button */}
            <button
                onClick={onClose}
                className="fixed top-4 left-4 z-50 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors text-white"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {/* Scrollable Video Container */}
            <div
                ref={containerRef}
                className="h-full w-full overflow-y-scroll snap-y snap-mandatory"
                style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch'
                }}
                onScroll={(e) => {
                    const container = e.currentTarget
                    const scrollPosition = container.scrollTop
                    const windowHeight = window.innerHeight
                    const newIndex = Math.round(scrollPosition / windowHeight)

                    if (newIndex !== currentVideoIndex) {
                        // Mute all videos (keep them playing!)
                        const videos = container.querySelectorAll('video')
                        videos.forEach(v => {
                            (v as HTMLVideoElement).muted = true
                        })

                        // Unmute and ensure current video is playing
                        const currentVideo = container.querySelector(`#video-${newIndex}`) as HTMLVideoElement
                        if (currentVideo && currentVideo.tagName === 'VIDEO') {
                            currentVideo.muted = false
                            currentVideo.play().catch(() => { })
                        }

                        setCurrentVideoIndex(newIndex)
                    }
                }}
            >
                {videos.map((video, index) => (
                    <div
                        key={video.id}
                        className="h-screen w-full snap-center snap-always flex items-center justify-center relative"
                    >
                        {/* Video Player */}
                        <div className="h-full w-full max-w-[calc(100vh*9/16)] bg-black">
                            {video.platform === 'youtube' ? (
                                <iframe
                                    id={`video-${index}`}
                                    src={`https://www.youtube.com/embed/${video.embedId}?autoplay=${index === currentVideoIndex ? 1 : 0}&enablejsapi=1&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${video.embedId}`}
                                    className="w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            ) : video.extractedVideoUrl ? (
                                <video
                                    id={`video-${index}`}
                                    src={video.extractedVideoUrl}
                                    poster={video.thumbnail}  // Show thumbnail while loading
                                    controls
                                    playsInline
                                    autoPlay={index === currentVideoIndex}  // Auto-play current
                                    muted={index !== currentVideoIndex}     // Mute others
                                    preload={Math.abs(index - currentVideoIndex) <= 1 ? 'auto' : 'metadata'}
                                    className="w-full h-full object-contain"
                                    onEnded={() => handleVideoEnd(index)}
                                />
                            ) : (
                                <div className="h-full flex items-center justify-center p-6">
                                    <div className="text-center">
                                        <p className="text-white mb-4 text-lg">Video not available</p>
                                        <a
                                            href={video.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-block px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
                                        >
                                            Open Original
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Video Title Overlay */}
                        <div className="absolute bottom-8 left-0 right-0 px-6 text-white pointer-events-none">
                            <h3 className="text-xl font-bold drop-shadow-lg">{video.title}</h3>
                            <p className="text-sm text-white/70 mt-1">{video.platform.toUpperCase()}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* CSS to hide scrollbar */}
            <style>{`
                .overflow-y-scroll::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    )
}
