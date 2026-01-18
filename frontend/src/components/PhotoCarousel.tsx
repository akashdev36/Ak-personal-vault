import { useState } from 'react'
import { DailyPhoto } from '../services/photosService'

interface PhotoCarouselProps {
    photos: DailyPhoto[]
    onClose?: () => void
}

export default function PhotoCarousel({ photos }: PhotoCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [fullscreen, setFullscreen] = useState(false)

    if (photos.length === 0) {
        return null
    }

    const currentPhoto = photos[currentIndex]

    // Get optimized URL with dimensions
    const getPhotoUrl = (photo: DailyPhoto, size: 'thumb' | 'full' = 'full') => {
        if (!photo.baseUrl) return ''
        // Google Photos URL format: baseUrl=w{width}-h{height}
        const dimension = size === 'thumb' ? 'w200-h200' : `w${photo.width || 1200}-h${photo.height || 900}`
        return `${photo.baseUrl}=${dimension}`
    }

    const goNext = () => {
        setCurrentIndex((prev) => (prev + 1) % photos.length)
    }

    const goPrev = () => {
        setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length)
    }

    // Fullscreen view
    if (fullscreen) {
        return (
            <div
                className="fixed inset-0 bg-black z-50 flex items-center justify-center"
                onClick={() => setFullscreen(false)}
            >
                {/* Close button */}
                <button
                    onClick={() => setFullscreen(false)}
                    className="absolute top-4 right-4 p-2 bg-white/20 rounded-full text-white z-10"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Image */}
                <img
                    src={getPhotoUrl(currentPhoto, 'full')}
                    alt={currentPhoto.filename}
                    className="max-w-full max-h-full object-contain"
                    onClick={(e) => e.stopPropagation()}
                />

                {/* Navigation */}
                {photos.length > 1 && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); goPrev(); }}
                            className="absolute left-4 p-3 bg-white/20 rounded-full text-white"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); goNext(); }}
                            className="absolute right-4 p-3 bg-white/20 rounded-full text-white"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </>
                )}

                {/* Counter */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
                    {currentIndex + 1} / {photos.length}
                </div>
            </div>
        )
    }

    // Normal carousel view
    return (
        <div className="relative">
            {/* Main image */}
            <div
                className="relative rounded-2xl overflow-hidden cursor-pointer bg-gray-100"
                onClick={() => setFullscreen(true)}
            >
                <img
                    src={getPhotoUrl(currentPhoto)}
                    alt={currentPhoto.filename}
                    className="w-full h-64 object-cover"
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

                {/* Expand icon */}
                <div className="absolute top-3 right-3 p-2 bg-black/30 rounded-full text-white">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                </div>
            </div>

            {/* Navigation for multiple photos */}
            {photos.length > 1 && (
                <>
                    <button
                        onClick={goPrev}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-md"
                    >
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        onClick={goNext}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-md"
                    >
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </>
            )}

            {/* Dots indicator */}
            {photos.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-3">
                    {photos.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`w-2 h-2 rounded-full transition-all ${index === currentIndex
                                ? 'bg-purple-600 w-4'
                                : 'bg-gray-300'
                                }`}
                        />
                    ))}
                </div>
            )}

            {/* Thumbnails (if more than 3 photos) */}
            {photos.length > 3 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                    {photos.map((photo, index) => (
                        <button
                            key={photo.id}
                            onClick={() => setCurrentIndex(index)}
                            className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden ${index === currentIndex ? 'ring-2 ring-purple-600' : ''
                                }`}
                        >
                            <img
                                src={getPhotoUrl(photo, 'thumb')}
                                alt={photo.filename}
                                className="w-full h-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
