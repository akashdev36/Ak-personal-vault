import { useState, useEffect, useRef } from 'react'
import { Habit, HabitEntry, saveHabitsToDrive, loadHabitsFromDrive, calculateStreaks, getTodayDate, getDateDaysAgo } from '../services/habitsService'
import { initializeGoogleAPI } from '../services/googleDrive'
import SimpleModal from './SimpleModal'
import ConfirmDialog from './ConfirmDialog'

const HABIT_COLORS = [
    { name: 'Blue', value: '#3b82f6', light: '#dbeafe' },
    { name: 'Green', value: '#22c55e', light: '#dcfce7' },
    { name: 'Purple', value: '#a855f7', light: '#f3e8ff' },
    { name: 'Orange', value: '#f97316', light: '#ffedd5' },
    { name: 'Pink', value: '#ec4899', light: '#fce7f3' },
    { name: 'Teal', value: '#14b8a6', light: '#ccfbf1' },
    { name: 'Red', value: '#ef4444', light: '#fee2e2' },
    { name: 'Yellow', value: '#eab308', light: '#fef9c3' },
]

const HABIT_ICONS = ['🎯', '💪', '📚', '🧘', '🏃', '💧', '🍎', '😴', '✍️', '🎨', '🎵', '💼']

export default function Habits() {
    const [habits, setHabits] = useState<Habit[]>([])
    const [entries, setEntries] = useState<HabitEntry[]>([])
    const [showNewHabitModal, setShowNewHabitModal] = useState(false)
    const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [habitToDelete, setHabitToDelete] = useState<string | null>(null)
    const [isSyncing, setIsSyncing] = useState(false)
    const [selectedView, setSelectedView] = useState<'board' | 'stats'>('board')
    const saveTimeoutRef = useRef<number | null>(null)

    useEffect(() => {
        loadHabits()
    }, [])

    const loadHabits = async () => {
        try {
            // Load from localStorage first
            const backup = localStorage.getItem('habits_backup')
            if (backup) {
                try {
                    const data = JSON.parse(backup)
                    const localHabits = data.habits.map((h: any) => ({
                        ...h,
                        createdAt: new Date(h.createdAt)
                    }))
                    setHabits(localHabits)
                    setEntries(data.entries || [])
                } catch (e) {
                    console.error('Failed to parse habits backup:', e)
                }
            }

            // Then sync with Google Drive
            try {
                await initializeGoogleAPI()
                const driveData = await loadHabitsFromDrive()

                if (driveData.habits.length > 0) {
                    setHabits(driveData.habits)
                    setEntries(driveData.entries)
                    localStorage.setItem('habits_backup', JSON.stringify(driveData))
                }
            } catch (driveError) {
                console.warn('Could not sync with Google Drive:', driveError)
            }
        } catch (error) {
            console.error('Error loading habits:', error)
        }
    }

    const syncHabits = (updatedHabits: Habit[], updatedEntries: HabitEntry[]) => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }

        saveTimeoutRef.current = window.setTimeout(async () => {
            try {
                localStorage.setItem('habits_backup', JSON.stringify({ habits: updatedHabits, entries: updatedEntries }))
                console.log('Habits saved to localStorage')
            } catch (error) {
                console.error('Failed to save habits to localStorage:', error)
            }
        }, 1000)
    }

    const forceSyncHabits = async (habitsToSync: Habit[], entriesToSync: HabitEntry[]) => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }

        try {
            setIsSyncing(true)
            localStorage.setItem('habits_backup', JSON.stringify({ habits: habitsToSync, entries: entriesToSync }))

            // @ts-ignore
            if (window.gapi?.client?.drive) {
                await saveHabitsToDrive(habitsToSync, entriesToSync)
                console.log('Habits synced to Drive')
            }
        } catch (error) {
            console.error('Force sync failed:', error)
        } finally {
            setIsSyncing(false)
        }
    }

    const handleCreateHabit = (name: string, color: string, icon: string, goal: 'daily' | 'weekly') => {
        const newHabit: Habit = {
            id: Date.now().toString(),
            name,
            color,
            icon,
            goal,
            createdAt: new Date()
        }
        const updatedHabits = [...habits, newHabit]
        setHabits(updatedHabits)
        syncHabits(updatedHabits, entries)
    }

    const handleUpdateHabit = (id: string, name: string, color: string, icon: string, goal: 'daily' | 'weekly') => {
        const updatedHabits = habits.map(h =>
            h.id === id ? { ...h, name, color, icon, goal } : h
        )
        setHabits(updatedHabits)
        syncHabits(updatedHabits, entries)
        setEditingHabit(null)
    }

    const handleDeleteHabit = () => {
        if (!habitToDelete) return

        const updatedHabits = habits.filter(h => h.id !== habitToDelete)
        const updatedEntries = entries.filter(e => e.habitId !== habitToDelete)
        setHabits(updatedHabits)
        setEntries(updatedEntries)
        syncHabits(updatedHabits, updatedEntries)
        setHabitToDelete(null)
        setShowDeleteConfirm(false)
    }

    const toggleHabitCompletion = (habitId: string, date: string) => {
        const existingEntry = entries.find(e => e.habitId === habitId && e.date === date)

        let updatedEntries: HabitEntry[]
        if (existingEntry) {
            // Toggle completion
            updatedEntries = entries.map(e =>
                e.habitId === habitId && e.date === date
                    ? { ...e, completed: !e.completed }
                    : e
            )
        } else {
            // Create new entry
            updatedEntries = [...entries, { habitId, date, completed: true }]
        }

        setEntries(updatedEntries)
        syncHabits(habits, updatedEntries)
    }

    const isHabitCompleted = (habitId: string, date: string): boolean => {
        const entry = entries.find(e => e.habitId === habitId && e.date === date)
        return entry ? entry.completed : false
    }

    const getTodayCompletionCount = (): number => {
        const today = getTodayDate()
        return habits.filter(h => isHabitCompleted(h.id, today)).length
    }

    const getTotalCompletions = (habitId: string): number => {
        return entries.filter(e => e.habitId === habitId && e.completed).length
    }

    const getCompletionRate = (habitId: string): number => {
        const habit = habits.find(h => h.id === habitId)
        if (!habit) return 0

        const daysSinceCreation = Math.floor((new Date().getTime() - habit.createdAt.getTime()) / (1000 * 60 * 60 * 24)) + 1
        const completions = getTotalCompletions(habitId)
        return Math.round((completions / daysSinceCreation) * 100)
    }

    // Generate last 30 days for the calendar
    const getLast30Days = (): string[] => {
        const days: string[] = []
        for (let i = 29; i >= 0; i--) {
            days.push(getDateDaysAgo(i))
        }
        return days
    }

    const days = getLast30Days()

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-2xl font-bold text-gray-900">Habit Tracker</h1>
                        <button
                            onClick={() => forceSyncHabits(habits, entries)}
                            disabled={isSyncing}
                            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                            title="Save to Drive"
                        >
                            {isSyncing ? (
                                <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                            )}
                        </button>
                    </div>

                    {/* Stats Bar */}
                    <div className="flex items-center gap-4 text-sm overflow-x-auto pb-2">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="text-2xl">📊</span>
                            <span className="font-semibold text-gray-900">Today: {getTodayCompletionCount()}/{habits.length}</span>
                        </div>
                        <div className="w-px h-4 bg-gray-300"></div>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="text-2xl">🎯</span>
                            <span className="text-gray-600">{habits.length} habits</span>
                        </div>
                    </div>

                    {/* View Toggle */}
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={() => setSelectedView('board')}
                            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${selectedView === 'board'
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            Progress Board
                        </button>
                        <button
                            onClick={() => setSelectedView('stats')}
                            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${selectedView === 'stats'
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            Statistics
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 py-6">
                {selectedView === 'board' ? (
                    <>
                        {/* Empty State */}
                        {habits.length === 0 && (
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">🎯</div>
                                <h2 className="text-xl font-bold text-gray-900 mb-2">Start Your First Habit</h2>
                                <p className="text-gray-600 mb-6">Create a habit to start tracking your progress</p>
                                <button
                                    onClick={() => setShowNewHabitModal(true)}
                                    className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                                >
                                    Create Habit
                                </button>
                            </div>
                        )}

                        {/* Habits List */}
                        {habits.map(habit => {
                            const streaks = calculateStreaks(habit.id, entries)
                            const totalCompletions = getTotalCompletions(habit.id)
                            const completionRate = getCompletionRate(habit.id)

                            return (
                                <div
                                    key={habit.id}
                                    className="bg-white rounded-2xl shadow-lg p-4 mb-4 border-2 hover:shadow-xl transition-shadow"
                                    style={{ borderColor: habit.color + '40' }}
                                >
                                    {/* Habit Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                                                style={{ backgroundColor: HABIT_COLORS.find(c => c.value === habit.color)?.light }}
                                            >
                                                {habit.icon}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900">{habit.name}</h3>
                                                <p className="text-xs text-gray-500 capitalize">{habit.goal}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => setEditingHabit(habit)}
                                                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                            >
                                                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setHabitToDelete(habit.id)
                                                    setShowDeleteConfirm(true)
                                                }}
                                                className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                                            >
                                                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Quick Stats */}
                                    <div className="flex items-center gap-4 mb-4 text-sm overflow-x-auto pb-2">
                                        <div className="flex items-center gap-1 whitespace-nowrap">
                                            <span>🔥</span>
                                            <span className="font-semibold">{streaks.current}</span>
                                            <span className="text-gray-500">current</span>
                                        </div>
                                        <div className="flex items-center gap-1 whitespace-nowrap">
                                            <span>🏆</span>
                                            <span className="font-semibold">{streaks.longest}</span>
                                            <span className="text-gray-500">best</span>
                                        </div>
                                        <div className="flex items-center gap-1 whitespace-nowrap">
                                            <span>✅</span>
                                            <span className="font-semibold">{totalCompletions}</span>
                                            <span className="text-gray-500">total</span>
                                        </div>
                                        <div className="flex items-center gap-1 whitespace-nowrap">
                                            <span>📈</span>
                                            <span className="font-semibold">{completionRate}%</span>
                                            <span className="text-gray-500">rate</span>
                                        </div>
                                    </div>

                                    {/* 30-Day Calendar Grid */}
                                    <div className="grid grid-cols-10 gap-1.5">
                                        {days.map((date, index) => {
                                            const isCompleted = isHabitCompleted(habit.id, date)
                                            const isToday = date === getTodayDate()

                                            return (
                                                <button
                                                    key={date}
                                                    onClick={() => toggleHabitCompletion(habit.id, date)}
                                                    className={`aspect-square rounded-lg transition-all ${isToday ? 'ring-2 ring-gray-800 ring-offset-1' : ''
                                                        } ${isCompleted
                                                            ? 'transform hover:scale-110'
                                                            : 'hover:bg-gray-100'
                                                        }`}
                                                    style={{
                                                        backgroundColor: isCompleted ? habit.color : '#f3f4f6',
                                                        opacity: isCompleted ? 1 : 0.5
                                                    }}
                                                    title={date}
                                                >
                                                    {isToday && (
                                                        <div className="text-[8px] font-bold text-white">•</div>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </>
                ) : (
                    <>
                        {/* Statistics View */}
                        {habits.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">📊</div>
                                <h2 className="text-xl font-bold text-gray-900 mb-2">No Statistics Yet</h2>
                                <p className="text-gray-600">Create habits to see your statistics</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Overall Statistics Section */}
                                {(() => {
                                    const last30Days = Array.from({ length: 30 }, (_, i) => getDateDaysAgo(29 - i))
                                    const totalHabits = habits.length

                                    // Calculate overall completion for each day
                                    const dailyCompletions = last30Days.map(date => {
                                        const completed = habits.filter(h => isHabitCompleted(h.id, date)).length
                                        return { date, completed, percentage: Math.round((completed / totalHabits) * 100) }
                                    })

                                    // Calculate overall metrics
                                    const totalPossible = totalHabits * 30
                                    const totalCompleted = dailyCompletions.reduce((sum, day) => sum + day.completed, 0)
                                    const overallRate = Math.round((totalCompleted / totalPossible) * 100)

                                    // This week stats
                                    const thisWeekData = dailyCompletions.slice(-7)
                                    const thisWeekCompleted = thisWeekData.reduce((sum, day) => sum + day.completed, 0)
                                    const thisWeekPossible = totalHabits * 7
                                    const thisWeekRate = Math.round((thisWeekCompleted / thisWeekPossible) * 100)

                                    // Last week stats for comparison
                                    const lastWeekData = dailyCompletions.slice(-14, -7)
                                    const lastWeekCompleted = lastWeekData.reduce((sum, day) => sum + day.completed, 0)
                                    const lastWeekRate = Math.round((lastWeekCompleted / thisWeekPossible) * 100)
                                    const trend = thisWeekRate - lastWeekRate

                                    // Best performing habit
                                    const habitStats = habits.map(h => ({
                                        habit: h,
                                        rate: getCompletionRate(h.id)
                                    }))
                                    const bestHabit = habitStats.reduce((best, current) =>
                                        current.rate > best.rate ? current : best
                                        , habitStats[0])

                                    // Max completion for scaling graph
                                    const maxCompletion = Math.max(...dailyCompletions.map(d => d.completed), 1)

                                    return (
                                        <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-3xl p-6 shadow-xl border border-indigo-100">
                                            <div className="flex items-center justify-between mb-6">
                                                <div>
                                                    <h2 className="text-2xl font-bold text-gray-900 mb-1">📊 Overall Progress</h2>
                                                    <p className="text-sm text-gray-600">Your complete habit journey</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-3xl font-black text-indigo-600">{overallRate}%</div>
                                                    <div className="text-xs text-gray-600">30-day completion</div>
                                                </div>
                                            </div>

                                            {/* 30-Day Combined Graph */}
                                            <div className="bg-white rounded-2xl p-5 mb-6 shadow-lg">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="text-sm font-bold text-gray-700">Last 30 Days Activity</h3>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                                                            <span className="text-gray-600">Completions</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Bar Chart */}
                                                <div className="flex items-end gap-1 h-32">
                                                    {dailyCompletions.map((day, index) => {
                                                        const height = (day.completed / maxCompletion) * 100
                                                        const isToday = day.date === getTodayDate()

                                                        return (
                                                            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                                                                <div
                                                                    className={`w-full rounded-t-lg transition-all duration-500 hover:opacity-80 relative group ${isToday ? 'ring-2 ring-indigo-600' : ''
                                                                        }`}
                                                                    style={{
                                                                        height: `${height}%`,
                                                                        background: day.completed > 0
                                                                            ? `linear-gradient(to top, #6366f1 0%, #a855f7 100%)`
                                                                            : '#e5e7eb',
                                                                        minHeight: '4px'
                                                                    }}
                                                                >
                                                                    {/* Tooltip */}
                                                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                                        {day.completed}/{totalHabits}
                                                                        <div className="text-[10px] text-gray-400">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                                                    </div>
                                                                </div>
                                                                {/* Show day label every 5 days */}
                                                                {(index % 5 === 0 || index === dailyCompletions.length - 1) && (
                                                                    <div className="text-[9px] text-gray-400 font-medium">
                                                                        {new Date(day.date).getDate()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>

                                            {/* Overall Metrics Grid */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                {/* This Week */}
                                                <div className="bg-white rounded-xl p-4 shadow-md">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-2xl">📅</span>
                                                        {trend !== 0 && (
                                                            <span className={`text-xs font-bold ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {trend > 0 ? '↗' : '↘'} {Math.abs(trend)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-2xl font-bold text-gray-900">{thisWeekCompleted}</div>
                                                    <div className="text-xs text-gray-600">This Week</div>
                                                    <div className="text-xs text-gray-400 mt-1">{thisWeekRate}% completion</div>
                                                </div>

                                                {/* Total Completions */}
                                                <div className="bg-white rounded-xl p-4 shadow-md">
                                                    <div className="text-2xl mb-2">✅</div>
                                                    <div className="text-2xl font-bold text-gray-900">{totalCompleted}</div>
                                                    <div className="text-xs text-gray-600">Total Done</div>
                                                    <div className="text-xs text-gray-400 mt-1">last 30 days</div>
                                                </div>

                                                {/* Active Habits */}
                                                <div className="bg-white rounded-xl p-4 shadow-md">
                                                    <div className="text-2xl mb-2">🎯</div>
                                                    <div className="text-2xl font-bold text-gray-900">{totalHabits}</div>
                                                    <div className="text-xs text-gray-600">Active Habits</div>
                                                    <div className="text-xs text-gray-400 mt-1">tracking daily</div>
                                                </div>

                                                {/* Best Habit */}
                                                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-4 shadow-md border border-yellow-200">
                                                    <div className="text-2xl mb-2">🌟</div>
                                                    <div className="text-lg font-bold text-gray-900 truncate">{bestHabit.habit.icon} {bestHabit.habit.name}</div>
                                                    <div className="text-xs text-gray-600">Top Performer</div>
                                                    <div className="text-xs font-bold text-orange-600 mt-1">{bestHabit.rate}% rate</div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })()}

                                {/* Individual Habit Statistics */}
                                <div className="pt-4">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">Individual Habit Details</h3>
                                </div>

                                {habits.map(habit => {
                                    const streaks = calculateStreaks(habit.id, entries)
                                    const totalCompletions = getTotalCompletions(habit.id)
                                    const completionRate = getCompletionRate(habit.id)

                                    // Calculate last 7 days completion
                                    const last7Days = Array.from({ length: 7 }, (_, i) => getDateDaysAgo(i)).reverse()
                                    const weekCompletion = last7Days.filter(date => isHabitCompleted(habit.id, date)).length
                                    const weekRate = Math.round((weekCompletion / 7) * 100)

                                    return (
                                        <div
                                            key={habit.id}
                                            className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100 hover:shadow-2xl transition-shadow"
                                        >
                                            {/* Header with Habit Info */}
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-4">
                                                    <div
                                                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg"
                                                        style={{
                                                            backgroundColor: HABIT_COLORS.find(c => c.value === habit.color)?.light,
                                                            boxShadow: `0 4px 14px ${habit.color}40`
                                                        }}
                                                    >
                                                        {habit.icon}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-2xl text-gray-900">{habit.name}</h3>
                                                        <p className="text-sm text-gray-500 capitalize">{habit.goal} goal</p>
                                                    </div>
                                                </div>
                                                {/* Overall Completion Rate Circle */}
                                                <div className="relative w-20 h-20">
                                                    <svg className="w-20 h-20 transform -rotate-90">
                                                        <circle
                                                            cx="40"
                                                            cy="40"
                                                            r="36"
                                                            stroke="#e5e7eb"
                                                            strokeWidth="8"
                                                            fill="none"
                                                        />
                                                        <circle
                                                            cx="40"
                                                            cy="40"
                                                            r="36"
                                                            stroke={habit.color}
                                                            strokeWidth="8"
                                                            fill="none"
                                                            strokeDasharray={`${2 * Math.PI * 36}`}
                                                            strokeDashoffset={`${2 * Math.PI * 36 * (1 - completionRate / 100)}`}
                                                            className="transition-all duration-1000"
                                                            strokeLinecap="round"
                                                        />
                                                    </svg>
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <span className="text-lg font-bold text-gray-900">{completionRate}%</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Streak Comparison */}
                                            <div className="grid grid-cols-2 gap-4 mb-6">
                                                <div
                                                    className="relative rounded-2xl p-5 overflow-hidden"
                                                    style={{
                                                        background: `linear-gradient(135deg, ${habit.color}15 0%, ${habit.color}30 100%)`
                                                    }}
                                                >
                                                    <div className="absolute top-0 right-0 text-6xl opacity-10">🔥</div>
                                                    <div className="relative z-10">
                                                        <div className="text-4xl font-black text-gray-900 mb-1">{streaks.current}</div>
                                                        <div className="text-sm font-medium text-gray-600">Current Streak</div>
                                                        <div className="text-xs text-gray-500 mt-1">days in a row</div>
                                                    </div>
                                                </div>
                                                <div
                                                    className="relative rounded-2xl p-5 overflow-hidden"
                                                    style={{
                                                        background: `linear-gradient(135deg, ${habit.color}20 0%, ${habit.color}40 100%)`
                                                    }}
                                                >
                                                    <div className="absolute top-0 right-0 text-6xl opacity-10">🏆</div>
                                                    <div className="relative z-10">
                                                        <div className="text-4xl font-black text-gray-900 mb-1">{streaks.longest}</div>
                                                        <div className="text-sm font-medium text-gray-600">Best Streak</div>
                                                        <div className="text-xs text-gray-500 mt-1">personal record</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Progress Bars */}
                                            <div className="space-y-4 mb-6">
                                                {/* This Week Progress */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm font-semibold text-gray-700">This Week</span>
                                                        <span className="text-sm font-bold" style={{ color: habit.color }}>{weekCompletion}/7 days</span>
                                                    </div>
                                                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-1000 ease-out"
                                                            style={{
                                                                width: `${weekRate}%`,
                                                                background: `linear-gradient(90deg, ${habit.color} 0%, ${habit.color}cc 100%)`
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Overall Progress */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm font-semibold text-gray-700">Overall Rate</span>
                                                        <span className="text-sm font-bold" style={{ color: habit.color }}>{completionRate}%</span>
                                                    </div>
                                                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-1000 ease-out"
                                                            style={{
                                                                width: `${completionRate}%`,
                                                                background: `linear-gradient(90deg, ${habit.color}80 0%, ${habit.color} 100%)`
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Weekly Heatmap */}
                                            <div className="pt-4 border-t border-gray-100">
                                                <div className="text-sm font-semibold text-gray-700 mb-3">Last 7 Days</div>
                                                <div className="flex gap-2">
                                                    {last7Days.map((date, index) => {
                                                        const isCompleted = isHabitCompleted(habit.id, date)
                                                        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(date).getDay()]
                                                        const isToday = date === getTodayDate()

                                                        return (
                                                            <div key={date} className="flex-1">
                                                                <div
                                                                    className={`h-12 rounded-xl flex items-center justify-center transition-all ${isCompleted
                                                                        ? 'shadow-md transform scale-105'
                                                                        : 'opacity-40'
                                                                        } ${isToday ? 'ring-2 ring-gray-900 ring-offset-2' : ''}`}
                                                                    style={{
                                                                        backgroundColor: isCompleted ? habit.color : '#f3f4f6'
                                                                    }}
                                                                >
                                                                    {isCompleted && (
                                                                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                        </svg>
                                                                    )}
                                                                </div>
                                                                <div className="text-center text-xs text-gray-500 mt-1 font-medium">{dayName}</div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>

                                            {/* Stats Grid */}
                                            <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-gray-100">
                                                <div className="text-center">
                                                    <div className="text-2xl font-bold text-gray-900">{totalCompletions}</div>
                                                    <div className="text-xs text-gray-500 mt-1">Total</div>
                                                </div>
                                                <div className="text-center border-x border-gray-200">
                                                    <div className="text-2xl font-bold" style={{ color: habit.color }}>{weekCompletion}</div>
                                                    <div className="text-xs text-gray-500 mt-1">This Week</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-2xl font-bold text-gray-900">
                                                        {streaks.current >= streaks.longest / 2 ? '🔥' : '💪'}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">Status</div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Floating Add Button */}
            <button
                onClick={() => setShowNewHabitModal(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-gray-900 text-white rounded-full shadow-lg hover:bg-gray-800 transition-all hover:scale-110 active:scale-95 z-20 flex items-center justify-center"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
            </button>

            {/* New/Edit Habit Modal */}
            <HabitFormModal
                isOpen={showNewHabitModal || editingHabit !== null}
                onClose={() => {
                    setShowNewHabitModal(false)
                    setEditingHabit(null)
                }}
                onSubmit={editingHabit
                    ? (name, color, icon, goal) => handleUpdateHabit(editingHabit.id, name, color, icon, goal)
                    : handleCreateHabit
                }
                initialHabit={editingHabit || undefined}
                colors={HABIT_COLORS}
                icons={HABIT_ICONS}
            />

            {/* Delete Confirmation */}
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onClose={() => {
                    setShowDeleteConfirm(false)
                    setHabitToDelete(null)
                }}
                onConfirm={handleDeleteHabit}
                title="Delete Habit"
                message="Are you sure you want to delete this habit? All tracking data will be lost."
            />
        </div>
    )
}

// Habit Form Modal Component
interface HabitFormModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (name: string, color: string, icon: string, goal: 'daily' | 'weekly') => void
    initialHabit?: Habit
    colors: { name: string, value: string, light: string }[]
    icons: string[]
}

function HabitFormModal({ isOpen, onClose, onSubmit, initialHabit, colors, icons }: HabitFormModalProps) {
    const [name, setName] = useState(initialHabit?.name || '')
    const [selectedColor, setSelectedColor] = useState(initialHabit?.color || colors[0].value)
    const [selectedIcon, setSelectedIcon] = useState(initialHabit?.icon || icons[0])
    const [goal, setGoal] = useState<'daily' | 'weekly'>(initialHabit?.goal || 'daily')

    useEffect(() => {
        if (initialHabit) {
            setName(initialHabit.name)
            setSelectedColor(initialHabit.color)
            setSelectedIcon(initialHabit.icon)
            setGoal(initialHabit.goal)
        } else {
            setName('')
            setSelectedColor(colors[0].value)
            setSelectedIcon(icons[0])
            setGoal('daily')
        }
    }, [initialHabit, colors, icons])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (name.trim()) {
            onSubmit(name.trim(), selectedColor, selectedIcon, goal)
            setName('')
            setSelectedColor(colors[0].value)
            setSelectedIcon(icons[0])
            setGoal('daily')
            onClose()
        }
    }

    return (
        <SimpleModal isOpen={isOpen} onClose={onClose} title={initialHabit ? 'Edit Habit' : 'Create New Habit'}>
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Habit Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Habit Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Morning Exercise"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                        autoFocus
                        required
                    />
                </div>

                {/* Icon Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Icon
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                        {icons.map(icon => (
                            <button
                                key={icon}
                                type="button"
                                onClick={() => setSelectedIcon(icon)}
                                className={`text-2xl p-3 rounded-lg transition-all ${selectedIcon === icon
                                    ? 'bg-gray-900 scale-110'
                                    : 'bg-gray-100 hover:bg-gray-200'
                                    }`}
                            >
                                {icon}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Color Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Color
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                        {colors.map(color => (
                            <button
                                key={color.value}
                                type="button"
                                onClick={() => setSelectedColor(color.value)}
                                className={`h-12 rounded-lg transition-all ${selectedColor === color.value
                                    ? 'ring-2 ring-gray-900 ring-offset-2 scale-105'
                                    : 'hover:scale-105'
                                    }`}
                                style={{ backgroundColor: color.value }}
                                title={color.name}
                            />
                        ))}
                    </div>
                </div>

                {/* Goal Type */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Goal
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setGoal('daily')}
                            className={`py-3 px-4 rounded-lg font-medium transition-colors ${goal === 'daily'
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            Daily
                        </button>
                        <button
                            type="button"
                            onClick={() => setGoal('weekly')}
                            className={`py-3 px-4 rounded-lg font-medium transition-colors ${goal === 'weekly'
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            Weekly
                        </button>
                    </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        {initialHabit ? 'Update' : 'Create'}
                    </button>
                </div>
            </form>
        </SimpleModal>
    )
}
