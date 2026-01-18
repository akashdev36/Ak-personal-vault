import { useState, useEffect, useRef } from 'react'
import { JournalEntry, loadJournalFromDrive } from '../services/journalService'
import { Habit, HabitEntry } from '../services/habitsService'
import { DailyCheckIn, loadCheckInsFromDrive, saveCheckInToDrive, isToday } from '../services/dailyCheckinService'
import { DailyPhoto, uploadPhoto, getPhotosForDate } from '../services/photosService'
import PhotoCarousel from './PhotoCarousel'
import ActivityTracker from './ActivityTracker'

interface DayActivitiesProps {
    date: string // Format: YYYY-MM-DD
    onBack: () => void
}

const WATER_MAX = 8

export default function DayActivities({ date, onBack }: DayActivitiesProps) {
    const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null)
    const [habits, setHabits] = useState<Habit[]>([])
    const [habitEntries, setHabitEntries] = useState<HabitEntry[]>([])
    const [checkIn, setCheckIn] = useState<DailyCheckIn>({
        date,
        mood: '',
        waterGlasses: 0,
        sleepHours: 0,
        note: ''
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    // Photo state
    const [photos, setPhotos] = useState<DailyPhoto[]>([])
    const [uploadingPhoto, setUploadingPhoto] = useState(false)
    const galleryInputRef = useRef<HTMLInputElement>(null)
    const cameraInputRef = useRef<HTMLInputElement>(null)

    const isTodayDate = isToday(date)


    useEffect(() => {
        loadData()
    }, [date])

    const loadData = async () => {
        setLoading(true)
        try {
            // Load journal entries
            const journalData = await loadJournalFromDrive()
            const entry = Object.values(journalData).find(e => e.date === date)
            setJournalEntry(entry || null)

            // Load habits from localStorage backup
            const habitsBackup = localStorage.getItem('habits_backup')
            if (habitsBackup) {
                const data = JSON.parse(habitsBackup)
                setHabits(data.habits.map((h: any) => ({ ...h, createdAt: new Date(h.createdAt) })))
                setHabitEntries(data.entries || [])
            }

            // Load check-in data
            const allCheckIns = await loadCheckInsFromDrive()
            if (allCheckIns[date]) {
                setCheckIn(allCheckIns[date])
            }

            // Load photos for this date
            try {
                const datePhotos = await getPhotosForDate(date)
                setPhotos(datePhotos)
            } catch (err) {
                console.log('Could not load photos:', err)
            }
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    // Handle photo upload from gallery or camera
    const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setUploadingPhoto(true)
        try {
            const newPhoto = await uploadPhoto(file, date, file.name)
            setPhotos(prev => [...prev, newPhoto])
            console.log('✅ Photo added!')
        } catch (error) {
            console.error('Error uploading photo:', error)
            alert('Failed to upload photo. Please try again.')
        } finally {
            setUploadingPhoto(false)
            // Reset input
            if (event.target) {
                event.target.value = ''
            }
        }
    }


    const handleSave = async () => {
        setSaving(true)
        try {
            await saveCheckInToDrive(checkIn)
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (error) {
            console.error('Error saving:', error)
        } finally {
            setSaving(false)
        }
    }

    // Format date for display
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr)
        return d.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        })
    }

    // Get completed habits for this date
    const completedHabits = habits.filter(h =>
        habitEntries.some(e => e.habitId === h.id && e.date === date && e.completed)
    )

    const totalHabits = habits.length
    const completedCount = completedHabits.length

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 p-4">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={onBack}
                    className="p-2 text-gray-600 hover:bg-white rounded-full transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-800">
                        {isTodayDate ? "Today's Check-in" : formatDate(date)}
                    </h1>
                    {isTodayDate && (
                        <p className="text-sm text-purple-600 font-medium">Fill your daily activities ✍️</p>
                    )}
                    {!isTodayDate && (
                        <p className="text-sm text-gray-500">View only - past date</p>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Photo Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">📸 Daily Photos</h2>

                        {/* Photo Carousel */}
                        {photos.length > 0 && (
                            <div className="mb-4">
                                <PhotoCarousel photos={photos} />
                            </div>
                        )}

                        {/* Upload buttons - Only for today */}
                        {isTodayDate && (
                            <div className="flex gap-3">
                                {/* Gallery button */}
                                <input
                                    ref={galleryInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoUpload}
                                    className="hidden"
                                    id="gallery-input"
                                />
                                <button
                                    onClick={() => galleryInputRef.current?.click()}
                                    disabled={uploadingPhoto}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-purple-50 text-purple-700 rounded-xl font-medium hover:bg-purple-100 transition-colors disabled:opacity-50"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Gallery
                                </button>

                                {/* Camera button */}
                                <input
                                    ref={cameraInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handlePhotoUpload}
                                    className="hidden"
                                    id="camera-input"
                                />
                                <button
                                    onClick={() => cameraInputRef.current?.click()}
                                    disabled={uploadingPhoto}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-indigo-50 text-indigo-700 rounded-xl font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Camera
                                </button>
                            </div>
                        )}

                        {/* Uploading indicator */}
                        {uploadingPhoto && (
                            <div className="flex items-center justify-center gap-2 mt-3 text-purple-600">
                                <div className="w-5 h-5 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                                <span className="text-sm font-medium">Uploading to Google Photos...</span>
                            </div>
                        )}

                        {/* No photos message for past dates */}
                        {!isTodayDate && photos.length === 0 && (
                            <p className="text-gray-400 text-center py-4">No photos for this day</p>
                        )}
                    </div>

                    {/* Diary Entry (from Journal page) */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                                <span className="text-xl">{journalEntry?.mood || '📝'}</span>
                            </div>
                            <h2 className="text-lg font-semibold text-gray-800">Diary Entry</h2>
                        </div>
                        {journalEntry ? (
                            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                                {journalEntry.note}
                            </p>
                        ) : (
                            <p className="text-gray-400 text-center py-4">
                                {isTodayDate ? 'No diary entry yet. Write one in the Diary page!' : 'No diary entry for this day.'}
                            </p>
                        )}
                    </div>

                    {/* Water Intake Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-800">💧 Water Intake</h2>
                            <span className="text-purple-600 font-bold">{checkIn.waterGlasses} glasses</span>
                        </div>
                        <div className="flex justify-around">
                            {Array.from({ length: WATER_MAX }, (_, i) => i + 1).map(num => (
                                <button
                                    key={num}
                                    onClick={() => isTodayDate && setCheckIn({ ...checkIn, waterGlasses: num })}
                                    disabled={!isTodayDate}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${checkIn.waterGlasses >= num
                                        ? 'bg-blue-500 text-white'
                                        : isTodayDate
                                            ? 'bg-gray-100 text-gray-400 hover:bg-blue-100'
                                            : 'bg-gray-100 text-gray-300'
                                        }`}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sleep Hours Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">😴 Sleep Hours</h2>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="0"
                                max="12"
                                step="0.5"
                                value={checkIn.sleepHours}
                                onChange={(e) => isTodayDate && setCheckIn({ ...checkIn, sleepHours: parseFloat(e.target.value) })}
                                disabled={!isTodayDate}
                                className="flex-1 h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                            />
                            <div className="w-20 text-center py-2 px-3 bg-purple-100 rounded-lg">
                                <span className="text-2xl font-bold text-purple-600">{checkIn.sleepHours}</span>
                                <span className="text-xs text-purple-500 ml-1">hrs</span>
                            </div>
                        </div>
                    </div>

                    {/* Activity Timeline (for this date only, no input) */}
                    <ActivityTracker date={date} showInput={false} />

                    {/* Habits Section (Read-only) */}
                    {habits.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-800">✅ Habits</h2>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${completedCount === totalHabits
                                    ? 'bg-green-100 text-green-700'
                                    : completedCount > 0
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}>
                                    {completedCount}/{totalHabits}
                                </span>
                            </div>
                            <div className="space-y-2">
                                {habits.map(habit => {
                                    const isCompleted = habitEntries.some(
                                        e => e.habitId === habit.id && e.date === date && e.completed
                                    )
                                    return (
                                        <div
                                            key={habit.id}
                                            className={`flex items-center gap-3 p-3 rounded-xl ${isCompleted ? 'bg-green-50' : 'bg-gray-50'
                                                }`}
                                        >
                                            <span className="text-xl">{habit.icon}</span>
                                            <span className={`flex-1 font-medium ${isCompleted ? 'text-green-700' : 'text-gray-500'
                                                }`}>
                                                {habit.name}
                                            </span>
                                            {isCompleted && (
                                                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Save Button - Only for today */}
                    {isTodayDate && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all ${saved
                                ? 'bg-green-500 text-white'
                                : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:shadow-lg active:scale-[0.99]'
                                }`}
                        >
                            {saving ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Saving...
                                </span>
                            ) : saved ? (
                                <span className="flex items-center justify-center gap-2">
                                    ✓ Saved!
                                </span>
                            ) : (
                                'Save Check-in'
                            )}
                        </button>
                    )}

                    {/* Summary for past dates */}
                    {!isTodayDate && (checkIn.mood || checkIn.waterGlasses > 0 || checkIn.sleepHours > 0) && (
                        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl p-5 text-white">
                            <h3 className="font-semibold mb-2">Day Summary</h3>
                            <div className="flex flex-wrap gap-4 text-sm">
                                {checkIn.mood && (
                                    <div className="flex items-center gap-1">
                                        <span>{checkIn.mood}</span>
                                        <span>Mood</span>
                                    </div>
                                )}
                                {checkIn.waterGlasses > 0 && (
                                    <div className="flex items-center gap-1">
                                        <span>💧</span>
                                        <span>{checkIn.waterGlasses} glasses</span>
                                    </div>
                                )}
                                {checkIn.sleepHours > 0 && (
                                    <div className="flex items-center gap-1">
                                        <span>😴</span>
                                        <span>{checkIn.sleepHours} hrs sleep</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
