import { useState } from 'react'
import { VideoItem, parseVideoUrl, getYouTubeThumbnail, extractInstagramVideoUrl } from '../services/videosService'
import { downloadVideoBlob, uploadToYouTube } from '../services/youtubeService'
import { useVideos } from '../hooks/useVideos'
import VideoPlayer from './VideoPlayer'
import ConfirmDialog from './ConfirmDialog'

export default function Videos() {
    // Use custom hook for video management
    const { videos, loading, addVideo, deleteVideos } = useVideos()

    // UI State
    const [searchQuery, setSearchQuery] = useState('')
    const [showAddModal, setShowAddModal] = useState(false)
    const [newVideoUrl, setNewVideoUrl] = useState('')
    const [newVideoTitle, setNewVideoTitle] = useState('')
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadStatus, setUploadStatus] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    // Video Player State
    const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null)

    // Multi-select State
    const [multiSelectMode, setMultiSelectMode] = useState(false)
    const [selectedVideos, setSelectedVideos] = useState<string[]>([])
    const [showMenu, setShowMenu] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    // Handle adding new video
    const handleAddVideo = async () => {
        if (!newVideoUrl.trim()) {
            setError('Please enter a video URL')
            return
        }

        setSaving(true)
        setError('')
        setUploadStatus('')
        setUploadProgress(0)

        try {
            const parsed = parseVideoUrl(newVideoUrl.trim())

            if (!parsed) {
                setError('Invalid URL. Please enter a valid YouTube or Instagram URL.')
                setSaving(false)
                return
            }

            let finalPlatform = parsed.platform
            let finalEmbedId = parsed.id
            let thumbnail: string | undefined

            // Handle Instagram videos (extract and upload to YouTube)
            if (parsed.platform === 'instagram') {
                try {
                    setUploadStatus('Extracting Instagram video...')
                    const extracted = await extractInstagramVideoUrl(parsed.id)

                    if (!extracted || !extracted.videoUrl) {
                        setError('Failed to extract Instagram video. Please ensure the reel is public.')
                        setSaving(false)
                        return
                    }

                    // Download and upload to YouTube
                    setUploadStatus('Downloading video...')
                    const videoBlob = await downloadVideoBlob(extracted.videoUrl)

                    setUploadStatus('Uploading to YouTube...')
                    const youtubeVideoId = await uploadToYouTube(
                        videoBlob,
                        newVideoTitle.trim() || `Instagram Reel - ${new Date().toLocaleDateString()}`,
                        'Saved from Instagram for personal use',
                        (progress) => setUploadProgress(progress)
                    )

                    finalPlatform = 'youtube'
                    finalEmbedId = youtubeVideoId
                    thumbnail = `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`
                    setUploadStatus('Upload complete!')
                } catch (err: any) {
                    console.error('Instagram processing error:', err)
                    setError(err.message || 'Failed to process Instagram video')
                    setSaving(false)
                    return
                }
            } else if (parsed.platform === 'youtube') {
                thumbnail = getYouTubeThumbnail(parsed.id)
            }

            // Create new video object
            const newVideo: VideoItem = {
                id: Date.now().toString(),
                url: newVideoUrl.trim(),
                platform: finalPlatform,
                title: newVideoTitle.trim() || `${finalPlatform.charAt(0).toUpperCase() + finalPlatform.slice(1)} Video`,
                thumbnail,
                embedId: finalEmbedId,
                extractedVideoUrl: parsed.platform === 'instagram' ? await extractInstagramVideoUrl(parsed.id).then(e => e?.videoUrl) : undefined,
                addedAt: new Date()
            }

            await addVideo(newVideo)

            // Reset form
            setNewVideoUrl('')
            setNewVideoTitle('')
            setShowAddModal(false)
            setUploadStatus('')
            setUploadProgress(0)
        } catch (err) {
            console.error('Error adding video:', err)
            setError('Failed to add video. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    // Handle multi-delete
    const handleMultiDelete = async () => {
        if (selectedVideos.length === 0) return
        setShowDeleteConfirm(true)
    }

    const confirmDelete = async () => {
        try {
            await deleteVideos(selectedVideos)
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

    // Filter videos based on search
    const filteredVideos = videos.filter(video =>
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.url.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 p-4">
            {/* Header with Search and Menu */}
            <div className="flex items-center gap-3 mb-6">
                {/* Add Button */}
                <button
                    onClick={() => setShowAddModal(true)}
                    className="w-14 h-14 flex-shrink-0 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-200 hover:shadow-xl hover:shadow-purple-300 transition-all duration-300 hover:scale-105 active:scale-95"
                >
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                </button>

                {/* Search Bar */}
                <div className="flex-1 relative">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search videos..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent transition-all"
                    />
                </div>

                {/* Menu Button */}
                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="w-14 h-14 flex-shrink-0 bg-white border-2 border-gray-100 rounded-full flex items-center justify-center hover:border-purple-300 transition-all"
                    >
                        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {showMenu && (
                        <div className="absolute right-0 top-16 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-10 min-w-[200px]">
                            <button
                                onClick={() => {
                                    setMultiSelectMode(!multiSelectMode)
                                    setSelectedVideos([])
                                    setShowMenu(false)
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-purple-50 transition-colors text-gray-700 font-medium"
                            >
                                {multiSelectMode ? 'Cancel Selection' : 'Select Videos'}
                            </button>
                            {multiSelectMode && selectedVideos.length > 0 && (
                                <button
                                    onClick={() => {
                                        handleMultiDelete()
                                        setShowMenu(false)
                                    }}
                                    className="w-full px-4 py-3 text-left hover:bg-red-50 transition-colors text-red-600 font-medium border-t border-gray-100"
                                >
                                    Delete Selected ({selectedVideos.length})
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Loading State */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading videos...</p>
                    </div>
                </div>
            ) : filteredVideos.length === 0 ? (
                /* Empty State */
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14m-10-4h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
                        </svg>
                        <p className="text-gray-500 text-lg mb-2">No videos yet</p>
                        <p className="text-gray-400 text-sm">Click the + button to add your first video</p>
                    </div>
                </div>
            ) : (
                /* Instagram-Style Video Grid */
                <div className="grid grid-cols-3 gap-0.5 bg-gray-200">
                    {filteredVideos.map((video) => (
                        <button
                            key={video.id}
                            onClick={() => multiSelectMode ? toggleVideoSelection(video.id) : setSelectedVideo(video)}
                            className="relative aspect-[9/16] bg-black overflow-hidden group"
                        >
                            {/* Thumbnail */}
                            {video.thumbnail && (
                                <img
                                    src={video.thumbnail}
                                    alt={video.title}
                                    className="w-full h-full object-cover"
                                />
                            )}

                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>

                            {/* Title */}
                            <div className="absolute bottom-0 left-0 right-0 p-3">
                                <p className="text-white font-semibold text-sm line-clamp-2">{video.title}</p>
                            </div>

                            {/* Platform Icon */}
                            <div className="absolute top-2 right-2 bg-black/50 rounded-full p-2">
                                {video.platform === 'instagram' ? (
                                    <svg className="w-5 h-5 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                    </svg>
                                ) : (
                                    <svg className="w-10 h-10 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                    </svg>
                                )}
                            </div>

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

            {/* Video Player (using new component) */}
            {selectedVideo && (
                <VideoPlayer
                    videos={filteredVideos}
                    initialIndex={filteredVideos.findIndex(v => v.id === selectedVideo.id)}
                    onClose={() => setSelectedVideo(null)}
                />
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
                                <label className="block text-sm font-medium text-gray-600 mb-2">Title (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="Enter video title"
                                    value={newVideoTitle}
                                    onChange={(e) => setNewVideoTitle(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent transition-all"
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                                    {error}
                                </div>
                            )}

                            {uploadStatus && (
                                <div className="space-y-2">
                                    <p className="text-sm text-purple-600 font-medium">{uploadStatus}</p>
                                    {uploadProgress > 0 && (
                                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="bg-purple-600 h-full transition-all duration-300"
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddVideo}
                                    disabled={saving || !newVideoUrl.trim()}
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? 'Adding...' : 'Add'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Delete Videos"
                message={`Are you sure you want to delete ${selectedVideos.length} video${selectedVideos.length > 1 ? 's' : ''}? This action cannot be undone.`}
                onConfirm={() => {
                    confirmDelete()
                    setShowDeleteConfirm(false)
                }}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    )
}
