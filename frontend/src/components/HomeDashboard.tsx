import { useState, useEffect } from 'react'
import { Habit, HabitEntry, getTodayDate, getDateDaysAgo, calculateStreaks } from '../services/habitsService'
import { NoteItem } from '../services/notesService'
import { saveJournalToDrive, loadJournalFromDrive } from '../services/journalService'
import { getDailyQuote } from '../services/apiService'

interface HomeDashboardProps {
    onNavigateTo: (page: string) => void
}

export default function HomeDashboard({ onNavigateTo }: HomeDashboardProps) {
    const [habits, setHabits] = useState<Habit[]>([])
    const [entries, setEntries] = useState<HabitEntry[]>([])
    const [notes, setNotes] = useState<NoteItem[]>([])
    const [currentTime, setCurrentTime] = useState(new Date())
    const [dailyQuote, setDailyQuote] = useState<string>('')

    useEffect(() => {
        loadData()
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)

        // Load today's check-in from Drive
        loadTodaysCheckIn()

        // Load daily quote from backend
        loadDailyQuote()

        return () => clearInterval(timer)
    }, [])

    const loadDailyQuote = async () => {
        try {
            const data = await getDailyQuote()
            setDailyQuote(data.quote)
        } catch (error) {
            console.log('Could not load daily quote:', error)
            setDailyQuote('Today is a new opportunity. Make it count!')
        }
    }

    const loadTodaysCheckIn = async () => {
        try {
            const checkins = await loadJournalFromDrive()
            const todayStr = getTodayDate()
            if (checkins[todayStr]) {
                setTodaysMood(checkins[todayStr].mood)
                setTodaysNote(checkins[todayStr].note)
            }
        } catch (error) {
            console.error('Error loading check-in:', error)
        }
    }

    const [showCheckInModal, setShowCheckInModal] = useState(false)
    const [todaysMood, setTodaysMood] = useState<string | null>(null)
    const [todaysNote, setTodaysNote] = useState('')

    const handleSaveCheckIn = async () => {
        try {
            const checkins = await loadJournalFromDrive()
            const todayStr = getTodayDate()
            checkins[todayStr] = { mood: todaysMood!, note: todaysNote, date: todayStr }
            await saveJournalToDrive(checkins)
            setShowCheckInModal(false)
        } catch (error) {
            console.error('Error saving check-in:', error)
        }
    }

    const loadData = () => {
        // Load habits
        try {
            const habitsBackup = localStorage.getItem('habits_backup')
            if (habitsBackup) {
                const data = JSON.parse(habitsBackup)
                setHabits(data.habits.map((h: any) => ({ ...h, createdAt: new Date(h.createdAt) })))
                setEntries(data.entries || [])
            }
        } catch (e) {
            console.error('Error loading habits:', e)
        }

        // Load notes
        try {
            const notesBackup = localStorage.getItem('notes_backup')
            if (notesBackup) {
                const loadedNotes = JSON.parse(notesBackup).map((n: any) => ({
                    ...n,
                    createdAt: new Date(n.createdAt)
                }))
                setNotes(loadedNotes)
            }
        } catch (e) {
            console.error('Error loading notes:', e)
        }
    }

    const toggleHabit = (habitId: string) => {
        const today = getTodayDate()
        const existingEntry = entries.find(e => e.habitId === habitId && e.date === today)

        let updatedEntries: HabitEntry[]
        if (existingEntry) {
            updatedEntries = entries.map(e =>
                e.habitId === habitId && e.date === today ? { ...e, completed: !e.completed } : e
            )
        } else {
            updatedEntries = [...entries, { habitId, date: today, completed: true }]
        }

        setEntries(updatedEntries)
        localStorage.setItem('habits_backup', JSON.stringify({ habits, entries: updatedEntries }))
    }

    const isHabitCompleted = (habitId: string, date: string): boolean => {
        const entry = entries.find(e => e.habitId === habitId && e.date === date)
        return entry ? entry.completed : false
    }

    // Calculate stats
    const today = getTodayDate()
    const completedToday = habits.filter(h => isHabitCompleted(h.id, today)).length
    const todayPercentage = habits.length > 0 ? Math.round((completedToday / habits.length) * 100) : 0

    const last7Days = Array.from({ length: 7 }, (_, i) => getDateDaysAgo(6 - i))

    const longestStreak = habits.reduce((max, habit) => {
        const streaks = calculateStreaks(habit.id, entries)
        return Math.max(max, streaks.current)
    }, 0)

    // Greeting based on time
    const hour = currentTime.getHours()
    const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening'

    // Calculate weekly data for heatmap
    const weekData = last7Days.map(date => {
        const dayCompleted = habits.filter(h => isHabitCompleted(h.id, date)).length
        const percentage = habits.length > 0 ? Math.round((dayCompleted / habits.length) * 100) : 0
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(date).getDay()]

        return {
            day: dayName,
            date,
            completed: dayCompleted,
            total: habits.length,
            percentage
        }
    })

    // Recent notes (top 3)
    const recentNotes = [...notes]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 3)

    // Motivation messages
    const motivationMessages = [
        { condition: todayPercentage === 100, message: "Perfect! You've completed all habits today! 🎉", icon: "🏆" },
        { condition: todayPercentage >= 75, message: "Amazing work! You're crushing it today! 💪", icon: "🔥" },
        { condition: todayPercentage >= 50, message: "Great progress! Keep the momentum going! ⭐", icon: "✨" },
        { condition: longestStreak >= 7, message: `${longestStreak} day streak! You're unstoppable! 🚀`, icon: "🌟" },
        { condition: true, message: "Every habit completed is a step forward! 🌱", icon: "💚" }
    ]
    const motivation = motivationMessages.find(m => m.condition) || motivationMessages[motivationMessages.length - 1]

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* 1. Time & Date Display - Spans full width on mobile, 2 cols on desktop */}
                    <div className="lg:col-span-2">
                        <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl p-8 shadow-xl text-white">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-lg opacity-90 mb-2">{greeting}, Akash! 👋</p>
                                    <h1 className="text-5xl md:text-6xl font-black mb-2">
                                        {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                    </h1>
                                    <p className="text-lg opacity-90">
                                        {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Daily Motivational Quote Card - Right after clock */}
                    {dailyQuote && (
                        <div className="lg:col-span-3 bg-gradient-to-r from-amber-400 via-orange-400 to-pink-500 rounded-3xl p-6 shadow-xl text-white">
                            <div className="flex items-center gap-4">
                                <div className="text-4xl">💡</div>
                                <div className="flex-1">
                                    <p className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">Today's Inspiration</p>
                                    <p className="text-xl md:text-2xl font-bold leading-relaxed">
                                        {dailyQuote}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. Overall Progress Ring */}
                    <div className="bg-white rounded-3xl p-6 shadow-xl">
                        <h3 className="text-sm font-bold text-gray-600 mb-4">Today's Progress</h3>
                        <div className="flex flex-col items-center">
                            <div className="relative w-40 h-40">
                                <svg className="w-40 h-40 transform -rotate-90">
                                    <circle cx="80" cy="80" r="70" stroke="#e5e7eb" strokeWidth="12" fill="none" />
                                    <circle
                                        cx="80"
                                        cy="80"
                                        r="70"
                                        stroke={todayPercentage >= 75 ? '#22c55e' : todayPercentage >= 50 ? '#eab308' : '#ef4444'}
                                        strokeWidth="12"
                                        fill="none"
                                        strokeDasharray={`${2 * Math.PI * 70}`}
                                        strokeDashoffset={`${2 * Math.PI * 70 * (1 - todayPercentage / 100)}`}
                                        className="transition-all duration-1000"
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-4xl font-black text-gray-900">{todayPercentage}%</span>
                                    <span className="text-sm text-gray-500">{completedToday}/{habits.length}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. Daily Motivation */}
                    <div className="lg:col-span-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-3xl p-6 shadow-lg border border-purple-200">
                        <div className="flex items-center gap-4">
                            <div className="text-5xl">{motivation.icon}</div>
                            <div>
                                <p className="text-xl font-bold text-gray-900">{motivation.message}</p>
                            </div>
                        </div>
                    </div>

                    {/* 5. Today's Habits */}
                    <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900">Today's Habits</h3>
                            <span className="text-sm text-gray-500">
                                {habits.filter(h => !isHabitCompleted(h.id, today)).length} pending
                            </span>
                        </div>

                        {habits.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="text-4xl mb-2">🎯</div>
                                <p className="text-gray-600 mb-4">No habits yet</p>
                                <button
                                    onClick={() => onNavigateTo('habits')}
                                    className="px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
                                >
                                    Create Habit
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {habits.filter(h => !isHabitCompleted(h.id, today)).length === 0 ? (
                                    <div className="text-center py-8">
                                        <div className="text-5xl mb-3">🎉</div>
                                        <p className="text-lg font-bold text-gray-900 mb-1">All done for today!</p>
                                        <p className="text-sm text-gray-600">You've completed all your habits!</p>
                                    </div>
                                ) : (
                                    habits.filter(h => !isHabitCompleted(h.id, today)).map(habit => (
                                        <div
                                            key={habit.id}
                                            onClick={() => toggleHabit(habit.id)}
                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group"
                                        >
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                                                style={{ backgroundColor: habit.color + '20' }}
                                            >
                                                {habit.icon}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-900">
                                                    {habit.name}
                                                </div>
                                            </div>
                                            <div
                                                className="w-6 h-6 rounded-md border-2 border-gray-300 flex items-center justify-center transition-all"
                                            >
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* 6. Recent Notes Widget */}
                    <div className="bg-white rounded-3xl p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900">Recent Notes</h3>
                            <button
                                onClick={() => onNavigateTo('note')}
                                className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold"
                            >
                                View All →
                            </button>
                        </div>

                        {recentNotes.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="text-4xl mb-2">📝</div>
                                <p className="text-gray-600 mb-4 text-sm">No notes yet</p>
                                <button
                                    onClick={() => onNavigateTo('note')}
                                    className="px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors text-sm"
                                >
                                    Create Note
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {recentNotes.map(note => (
                                    <div
                                        key={note.id}
                                        onClick={() => onNavigateTo('note')}
                                        className="p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer border border-gray-100"
                                    >
                                        <h4 className="font-semibold text-gray-900 mb-1 truncate">{note.title}</h4>
                                        <p className="text-xs text-gray-500 line-clamp-2" dangerouslySetInnerHTML={{ __html: note.content.replace(/<[^>]*>/g, '') }} />
                                        <p className="text-xs text-gray-400 mt-1">
                                            {note.createdAt.toLocaleDateString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 7. Quick Actions Panel */}
                    <div className="lg:col-span-3 bg-white rounded-3xl p-6 shadow-xl">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <button
                                onClick={() => onNavigateTo('note')}
                                className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white hover:scale-105 transition-transform shadow-lg"
                            >
                                <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                <span className="font-bold">New Note</span>
                            </button>

                            <button
                                onClick={() => onNavigateTo('habits')}
                                className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white hover:scale-105 transition-transform shadow-lg"
                            >
                                <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="font-bold">New Habit</span>
                            </button>

                            <button
                                onClick={() => onNavigateTo('habits')}
                                className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 text-white hover:scale-105 transition-transform shadow-lg"
                            >
                                <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                <span className="font-bold">Statistics</span>
                            </button>

                            <button
                                onClick={() => onNavigateTo('videos')}
                                className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 text-white hover:scale-105 transition-transform shadow-lg"
                            >
                                <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-bold">Shorts</span>
                            </button>

                            <button
                                onClick={() => onNavigateTo('journal')}
                                className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white hover:scale-105 transition-transform shadow-lg"
                            >
                                <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                <span className="font-bold">Dairy</span>
                            </button>

                            <button
                                onClick={() => onNavigateTo('ai-chat')}
                                className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white hover:scale-105 transition-transform shadow-lg"
                            >
                                <span className="text-3xl mb-2">🤖</span>
                                <span className="font-bold">AI Chat</span>
                            </button>

                            <button
                                onClick={() => onNavigateTo('communication-coach')}
                                className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white hover:scale-105 transition-transform shadow-lg"
                            >
                                <span className="text-3xl mb-2">🎓</span>
                                <span className="font-bold">English Coach</span>
                            </button>
                        </div>
                    </div>


                    {/* 9. Personal Stats */}
                    <div className="bg-white rounded-3xl p-6 shadow-xl">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Your Stats</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-4 bg-blue-50 rounded-xl">
                                <div className="text-3xl font-black text-blue-600">{notes.length}</div>
                                <div className="text-xs text-gray-600 mt-1">Notes</div>
                            </div>
                            <div className="text-center p-4 bg-purple-50 rounded-xl">
                                <div className="text-3xl font-black text-purple-600">{habits.length}</div>
                                <div className="text-xs text-gray-600 mt-1">Habits</div>
                            </div>
                            <div className="text-center p-4 bg-green-50 rounded-xl">
                                <div className="text-3xl font-black text-green-600">{entries.filter(e => e.completed).length}</div>
                                <div className="text-xs text-gray-600 mt-1">Total Done</div>
                            </div>
                            <div className="text-center p-4 bg-orange-50 rounded-xl">
                                <div className="text-3xl font-black text-orange-600">{longestStreak}</div>
                                <div className="text-xs text-gray-600 mt-1">Best Streak</div>
                            </div>
                        </div>
                    </div>

                    {/* 8. This Week's Activity - Heatmap Style */}
                    <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Weekly Heatmap</h3>
                            <div className="text-sm text-gray-500">
                                {weekData.filter(d => d.percentage === 100).length} perfect days
                            </div>
                        </div>

                        {/* Heatmap Grid */}
                        <div className="grid grid-cols-7 gap-3 mb-4">
                            {weekData.map((day, index) => {
                                const intensity = day.percentage === 0 ? 0 : day.percentage < 50 ? 1 : day.percentage < 75 ? 2 : day.percentage < 100 ? 3 : 4
                                const colors = [
                                    'bg-gray-100 border-gray-200', // 0%
                                    'bg-red-200 border-red-300', // < 50%
                                    'bg-yellow-200 border-yellow-300', // < 75%
                                    'bg-blue-200 border-blue-300', // < 100%
                                    'bg-green-500 border-green-600' // 100%
                                ]

                                return (
                                    <div key={index} className="flex flex-col items-center gap-2">
                                        <span className="text-xs font-medium text-gray-600">{day.day}</span>
                                        <div
                                            className={`w-full aspect-square rounded-xl border-2 ${colors[intensity]} transition-all hover:scale-110 cursor-pointer relative group`}
                                            title={`${day.percentage}% (${day.completed}/${day.total})`}
                                        >
                                            {/* Tooltip on hover */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                                {day.completed}/{day.total} habits
                                            </div>

                                            {/* Show checkmark for 100% */}
                                            {intensity === 4 && (
                                                <svg className="absolute inset-0 m-auto w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                        <span className="text-xs font-bold text-gray-800">{day.percentage}%</span>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Legend */}
                        <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                            <span className="text-xs text-gray-500">Less</span>
                            <div className="flex gap-1">
                                <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200"></div>
                                <div className="w-4 h-4 rounded bg-red-200 border border-red-300"></div>
                                <div className="w-4 h-4 rounded bg-yellow-200 border border-yellow-300"></div>
                                <div className="w-4 h-4 rounded bg-blue-200 border border-blue-300"></div>
                                <div className="w-4 h-4 rounded bg-green-500 border border-green-600"></div>
                            </div>
                            <span className="text-xs text-gray-500">More</span>
                        </div>
                    </div>

                    {/* 10. Upcoming/Missed Habits */}
                    <div className="lg:col-span-3 bg-white rounded-3xl p-6 shadow-xl">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Status</h3>
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Pending Today */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                    <h4 className="font-semibold text-gray-700">Pending Today</h4>
                                </div>
                                {habits.filter(h => !isHabitCompleted(h.id, today)).length === 0 ? (
                                    <p className="text-sm text-gray-500">All done! 🎉</p>
                                ) : (
                                    <div className="space-y-2">
                                        {habits.filter(h => !isHabitCompleted(h.id, today)).map(habit => (
                                            <div key={habit.id} className="flex items-center gap-2 text-sm">
                                                <span>{habit.icon}</span>
                                                <span className="text-gray-700">{habit.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Completed Today */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    <h4 className="font-semibold text-gray-700">Completed Today</h4>
                                </div>
                                {habits.filter(h => isHabitCompleted(h.id, today)).length === 0 ? (
                                    <p className="text-sm text-gray-500">Nothing yet</p>
                                ) : (
                                    <div className="space-y-2">
                                        {habits.filter(h => isHabitCompleted(h.id, today)).map(habit => (
                                            <div key={habit.id} className="flex items-center gap-2 text-sm">
                                                <span>{habit.icon}</span>
                                                <span className="text-gray-700">{habit.name}</span>
                                                <span className="text-green-600">✓</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* 11. Daily Check-in Button */}
                    <div className="lg:col-span-3 mt-4">
                        <button
                            onClick={() => setShowCheckInModal(true)}
                            className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-3xl p-6 shadow-xl hover:scale-[1.02] transition-transform group relative overflow-hidden"
                        >
                            <div className="relative z-10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">✨</span>
                                    <div className="text-left">
                                        <h3 className="text-xl font-bold">How is today?</h3>
                                        <p className="text-teal-100 text-sm">Tap to check in</p>
                                    </div>
                                </div>
                                {todaysMood && (
                                    <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl flex items-center gap-2">
                                        <span className="text-2xl">{todaysMood}</span>
                                    </div>
                                )}
                            </div>
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Check-in Modal */}
            {showCheckInModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-scaleIn">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">How are you feeling?</h2>
                            <p className="text-gray-600">{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                        </div>

                        {/* Mood Selection */}
                        <div className="flex justify-between mb-8 px-2">
                            {['🤩', '🙂', '😐', '😕', '😫'].map((mood) => (
                                <button
                                    key={mood}
                                    onClick={() => setTodaysMood(mood)}
                                    className={`text-4xl p-3 rounded-2xl transition-all hover:scale-110 ${todaysMood === mood
                                        ? 'bg-indigo-100 ring-2 ring-indigo-500 scale-110'
                                        : 'hover:bg-gray-100'
                                        }`}
                                >
                                    {mood}
                                </button>
                            ))}
                        </div>

                        {/* Note Input */}
                        <div className="mb-8">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Highlight of the day (optional)</label>
                            <textarea
                                value={todaysNote}
                                onChange={(e) => setTodaysNote(e.target.value)}
                                placeholder="What's on your mind?..."
                                className="w-full p-4 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 resize-none h-32 transition-all"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCheckInModal(false)}
                                className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveCheckIn}
                                disabled={!todaysMood}
                                className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save Check-in
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
