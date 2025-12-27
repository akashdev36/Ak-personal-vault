import { useState, useEffect } from 'react'
import { VideoItem, parseVideoUrl, getYouTubeThumbnail, extractInstagramVideoUrl, saveVideosToDrive, loadVideosFromDrive } from '../services/videosService'
import { downloadVideoBlob, uploadToYouTube } from '../services/youtubeService'
import ConfirmDialog from './ConfirmDialog'

export default function Videos() {
    const [videos, setVideos] = useState<VideoItem[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [showAddModal, setShowAddModal] = useState(false)
    const [newVideoUrl, setNewVideoUrl] = useState('')
    const [newVideoTitle, setNewVideoTitle] = useState('')
    const [loading, setLoading] = useState(true)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadStatus, setUploadStatus] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null)
    const [multiSelectMode, setMultiSelectMode] = useState(false)
    const [selectedVideos, setSelectedVideos] = useState<string[]>([])
    const [showMenu, setShowMenu] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0)

    // Load videos on mount
    useEffect(() => {
        loadVideos()
    }, [])

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
                } catch (e) {
                    console.error('Failed to parse backup:', e)
                }
            }

            // Then try loading from Drive (may take time for API to be ready)
            try {
                const driveVideos = await loadVideosFromDrive()
                if (driveVideos.length > 0) {
                    setVideos(driveVideos)
                    // Sync localStorage with Drive data
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

    const handleAddVideo = async () => {
        if (!newVideoUrl.trim()) {
            setError('Please enter a video URL')
            return
        }

        const parsed = parseVideoUrl(newVideoUrl.trim())
        if (!parsed) {
            setError('Invalid URL. Please enter a valid YouTube or Instagram URL')
            return
        }

        setSaving(true)
        setError('')
        setUploadProgress(0)
        setUploadStatus('')

        try {
            let finalPlatform = parsed.platform
            let finalEmbedId = parsed.embedId
            let thumbnail: string | undefined

            // For Instagram: Extract → Download → Upload to YouTube
            if (parsed.platform === 'instagram') {
                try {
                    // Step 1: Extract video URL from Instagram
                    setUploadStatus('Extracting video from Instagram...')
                    const extracted = await extractInstagramVideoUrl(newVideoUrl.trim())

                    if (extracted && extracted.videoUrl) {
                        // Step 2: Download video blob
                        setUploadStatus('Downloading video...')
                        const videoBlob = await downloadVideoBlob(extracted.videoUrl)

                        // Step 3: Upload to YouTube
                        setUploadStatus('Uploading to YouTube...')
                        const youtubeVideoId = await uploadToYouTube(
                            videoBlob,
                            newVideoTitle.trim() || `Instagram Reel - ${new Date().toLocaleDateString()}`,
                            'Saved from Instagram for personal use',
                            (progress) => setUploadProgress(progress)
                        )

                        // Success! Now store as YouTube video
                        finalPlatform = 'youtube'
                        finalEmbedId = youtubeVideoId
                        thumbnail = `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg` // Use hqdefault (always available)
                        setUploadStatus('Upload complete!')

                        console.log('Instagram video uploaded to YouTube:', youtubeVideoId)
                    } else {
                        // Extraction failed - fall back to storing Instagram URL
                        console.warn('Could not extract Instagram video, storing URL only')
                        setUploadStatus('')
                        thumbnail = extracted?.thumbnail
                    }
                } catch (uploadErr) {
                    // Upload failed - fall back to storing Instagram URL
                    console.error('YouTube upload failed, storing Instagram URL:', uploadErr)
                    setError('YouTube upload failed. Video saved with Instagram link (may expire in 24h)')
                    setUploadStatus('')
                    // Continue with Instagram platform
                }
            } else if (parsed.platform === 'youtube') {
                thumbnail = getYouTubeThumbnail(parsed.embedId)
            }

            const newVideo: VideoItem = {
                id: Date.now().toString(),
                url: finalPlatform === 'youtube' ? `https://www.youtube.com/watch?v=${finalEmbedId}` : newVideoUrl.trim(),
                platform: finalPlatform,
                embedId: finalEmbedId,
                title: newVideoTitle.trim() || `Video ${videos.length + 1}`,
                thumbnail,
                addedAt: new Date()
            }

            const updatedVideos = [newVideo, ...videos]
            setVideos(updatedVideos)

            // Save to localStorage as backup
            localStorage.setItem('videos_backup', JSON.stringify(updatedVideos))

            // Try to save to Drive (don't block on failure)
            try {
                await saveVideosToDrive(updatedVideos)
            } catch (driveErr) {
                console.warn('Could not save to Drive, saved locally:', driveErr)
            }

            setNewVideoUrl('')
            setNewVideoTitle('')
            setShowAddModal(false)
            setUploadProgress(0)
            setUploadStatus('')
        } catch (err) {
            setError('Failed to save video. Please try again.')
            console.error('Error saving video:', err)
        } finally {
            setSaving(false)
        }
    }

    // Unused - kept for future use
    // const handleDeleteVideo = async (id: string) => {
    //     try {
    //         const updatedVideos = videos.filter(v => v.id !== id)
    //         setVideos(updatedVideos)
    //         await saveVideosToDrive(updatedVideos)
    //         setSelectedVideo(null)
    //     } catch (err) {
    //         console.error('Error deleting video:', err)
    //     }
    // }

    const handleMultiDelete = async () => {
        if (selectedVideos.length === 0) return
        setShowDeleteConfirm(true)
    }

    const confirmDelete = async () => {
        try {
            const updatedVideos = videos.filter(v => !selectedVideos.includes(v.id))
            setVideos(updatedVideos)
            await saveVideosToDrive(updatedVideos)
            localStorage.setItem('videos_backup', JSON.stringify(updatedVideos))
            setSelectedVideos([])
            setMultiSelectMode(false)
        } catch (err) {
            console.error('Error deleting videos:', err)
        }
    }

    const toggleVideoSelection = (id: string) => {
        setSelectedVideos(prev =>
            prev.includes(id) ? prev.filter(vid => vid !== id) : [...prev, id]
        )
    }

    const filteredVideos = videos.filter(video =>
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.url.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Unused - kept for future use  
    // const getEmbedUrl = (video: VideoItem) => {
    //     if (video.platform === 'youtube' && video.embedId) {
    //         return `https://www.youtube.com/embed/${video.embedId}?autoplay=1`
    //     }
    //     if (video.platform === 'instagram' && video.embedId) {
    //         return `https://www.instagram.com/reel/${video.embedId}/embed`
    //     }
    //     return video.url
    // }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 p-4">
            {/* Header with Search and Menu */}
            <div className="flex items-center gap-3 mb-6">
                {/* Add Button - LEFT SIDE */}
                <button
                    onClick={() => setShowAddModal(true)}
                    className="w-14 h-14 flex-shrink-0 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-200 hover:shadow-xl hover:shadow-purple-300 transition-all duration-300 hover:scale-105 active:scale-95"
                >
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                </button>

                {/* Search Bar - CENTER */}
                <div className="flex-1 relative">
                    <svg
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search videos..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-purple-50/50 border border-purple-100 rounded-full text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent transition-all"
                    />
                </div>

                {/* Three-dot Menu - RIGHT SIDE */}
                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="w-12 h-12 bg-white border border-purple-100 rounded-xl flex items-center justify-center hover:bg-purple-50 transition-colors shadow-sm"
                    >
                        <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                        </svg>
                    </button>

                    {/* Dropdown menu */}
                    {showMenu && (
                        <>
                            {/* Backdrop to close menu */}
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowMenu(false)}
                            />
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-purple-100 z-50">
                                <button
                                    onClick={() => {
                                        setShowMenu(false)
                                        alert('Pin feature coming soon!')
                                    }}
                                    className="w-full px-4 py-3 text-left hover:bg-purple-50 rounded-t-xl flex items-center gap-3 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                    </svg>
                                    <span className="text-gray-700">Pin</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setShowMenu(false)
                                        setMultiSelectMode(true)
                                        setSelectedVideos([])
                                    }}
                                    className="w-full px-4 py-3 text-left hover:bg-purple-50 rounded-b-xl flex items-center gap-3 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    <span className="text-red-600">Delete</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {/* Empty State */}
            {!loading && videos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-24 h-24 bg-purple-100 rounded-3xl flex items-center justify-center mb-4">
                        <svg className="w-12 h-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No videos yet</h3>
                    <p className="text-gray-500 mb-6">Tap the + button to add your first video</p>
                </div>
            )}

            {/* Video Grid */}
            {/* Multi-select action bar */}
            {multiSelectMode && (
                <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-purple-700 font-medium">
                            {selectedVideos.length} selected
                        </span>
                        {selectedVideos.length > 0 && (
                            <button
                                onClick={() => setSelectedVideos([])}
                                className="text-purple-600 text-sm hover:underline"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                setMultiSelectMode(false)
                                setSelectedVideos([])
                            }}
                            className="px-4 py-2 bg-white border border-purple-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleMultiDelete}
                            disabled={selectedVideos.length === 0}
                            className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                        </button>
                    </div>
                </div>
            )}

            {/* Video Grid */}
            {!loading && filteredVideos.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    {filteredVideos.map((video) => (
                        <button
                            key={video.id}
                            onClick={() => {
                                if (multiSelectMode) {
                                    toggleVideoSelection(video.id)
                                } else {
                                    setSelectedVideo(video)
                                }
                            }}
                            className={`aspect-square bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-lg hover:scale-[1.02] transition-all duration-300 relative ${multiSelectMode && selectedVideos.includes(video.id)
                                ? 'border-purple-500 ring-2 ring-purple-300'
                                : 'border-purple-100'
                                }`}
                        >
                            {video.thumbnail ? (
                                <img
                                    src={video.thumbnail}
                                    alt={video.title}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center">
                                    {video.platform === 'instagram' ? (
                                        <svg className="w-10 h-10 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-10 h-10 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                        </svg>
                                    )}
                                </div>
                            )}

                            {/* Selection checkbox */}
                            {multiSelectMode && (
                                <div className="absolute top-2 left-2">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedVideos.includes(video.id)
                                        ? 'bg-purple-600 border-purple-600'
                                        : 'bg-white/90 border-white'
                                        }`}>
                                        {selectedVideos.includes(video.id) && (
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Vertical Scrollable Video Player - YouTube Shorts Style */}
            {selectedVideo && (
                <div className="fixed inset-0 bg-black z-50">
                    {/* Close Button */}
                    <button
                        onClick={() => setSelectedVideo(null)}
                        className="fixed top-4 left-4 z-50 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors text-white"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Scrollable Video Container */}
                    <div
                        className="h-full w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        onScroll={(e) => {
                            const container = e.currentTarget
                            const scrollPosition = container.scrollTop
                            const windowHeight = window.innerHeight
                            const newIndex = Math.round(scrollPosition / windowHeight)
                            if (newIndex !== currentVideoIndex) {
                                // Pause all videos
                                const videos = container.querySelectorAll('video')
                                videos.forEach(v => (v as HTMLVideoElement).pause())

                                // Play current video
                                const currentVideo = container.querySelector(`#video-${newIndex}`) as HTMLVideoElement
                                if (currentVideo && currentVideo.tagName === 'VIDEO') {
                                    currentVideo.play()
                                }

                                setCurrentVideoIndex(newIndex)
                            }
                        }}
                    >
                        {filteredVideos.map((video, index) => (
                            <div
                                key={video.id}
                                className="h-screen w-full snap-center snap-always flex items-center justify-center relative"
                            >
                                {/* Video Player */}
                                <div className="h-full w-full max-w-[calc(100vh*9/16)] bg-black">
                                    {video.platform === 'youtube' ? (
                                        <iframe
                                            id={`video-${index}`}
                                            src={`https://www.youtube.com/embed/${video.embedId}?autoplay=${index === currentVideoIndex ? 1 : 0}&enablejsapi=1`}
                                            className="w-full h-full"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        />
                                    ) : video.extractedVideoUrl ? (
                                        <video
                                            id={`video-${index}`}
                                            src={video.extractedVideoUrl}
                                            controls
                                            autoPlay={index === currentVideoIndex}
                                            loop
                                            playsInline
                                            className="w-full h-full object-contain"
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
            )}

            {/* Add Video Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
                    <div
                        className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-fadeIn"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Add Video</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-2">Video URL</label>
                                <input
                                    type="url"
                                    placeholder="Paste YouTube or Instagram URL"
                                    value={newVideoUrl}
                                    onChange={(e) => {
                                        setNewVideoUrl(e.target.value)
                                        setError('')
                                    }}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent transition-all"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-2">Title (optional)</label>
                                <input
                                    type="text"
                                    placeholder="Give it a name"
                                    value={newVideoTitle}
                                    onChange={(e) => setNewVideoTitle(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent transition-all"
                                />
                            </div>

                            {/* Upload Progress */}
                            {uploadStatus && (
                                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                                    <p className="text-sm text-purple-700 font-medium mb-2">{uploadStatus}</p>
                                    {uploadProgress > 0 && uploadProgress < 100 && (
                                        <div className="w-full bg-purple-200 rounded-full h-2">
                                            <div
                                                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {error && (
                                <p className="text-red-500 text-sm">{error}</p>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddVideo}
                                    disabled={saving}
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        'Add Video'
                                    )}\n                                </button>
                            </div>

                            <p className="text-xs text-gray-400 text-center mt-4">
                                Supports YouTube videos, Shorts, and Instagram Reels
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={confirmDelete}
                title="Delete Videos"
                message={`Are you sure you want to delete ${selectedVideos.length} video${selectedVideos.length > 1 ? 's' : ''}? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                isDangerous={true}
            />
        </div>
    )
}
