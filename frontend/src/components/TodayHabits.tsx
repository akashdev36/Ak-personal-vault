import { useState, useEffect } from 'react'
import { Habit, HabitEntry, getTodayDate } from '../services/habitsService'

interface TodayHabitsProps {
    onNavigateToHabits: () => void
}

export default function TodayHabits({ onNavigateToHabits }: TodayHabitsProps) {
    const [habits, setHabits] = useState<Habit[]>([])
    const [entries, setEntries] = useState<HabitEntry[]>([])

    useEffect(() => {
        loadHabits()
    }, [])

    const loadHabits = () => {
        try {
            const backup = localStorage.getItem('habits_backup')
            if (backup) {
                const data = JSON.parse(backup)
                const localHabits = data.habits.map((h: any) => ({
                    ...h,
                    createdAt: new Date(h.createdAt)
                }))
                setHabits(localHabits)
                setEntries(data.entries || [])
            }
        } catch (error) {
            console.error('Error loading habits:', error)
        }
    }

    const toggleHabit = (habitId: string) => {
        const today = getTodayDate()
        const existingEntry = entries.find(e => e.habitId === habitId && e.date === today)

        let updatedEntries: HabitEntry[]
        if (existingEntry) {
            updatedEntries = entries.map(e =>
                e.habitId === habitId && e.date === today
                    ? { ...e, completed: !e.completed }
                    : e
            )
        } else {
            updatedEntries = [...entries, { habitId, date: today, completed: true }]
        }

        setEntries(updatedEntries)

        // Save to localStorage
        try {
            localStorage.setItem('habits_backup', JSON.stringify({ habits, entries: updatedEntries }))
        } catch (error) {
            console.error('Error saving habits:', error)
        }
    }

    const isCompleted = (habitId: string): boolean => {
        const today = getTodayDate()
        const entry = entries.find(e => e.habitId === habitId && e.date === today)
        return entry ? entry.completed : false
    }

    const today = new Date()
    const formattedDate = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })

    if (habits.length === 0) {
        return (
            <div className="bg-white rounded-3xl shadow-lg p-8 border border-gray-100">
                <div className="text-center">
                    <div className="text-5xl mb-3">🎯</div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No Habits Yet</h3>
                    <p className="text-gray-600 mb-4">Start building better habits today!</p>
                    <button
                        onClick={onNavigateToHabits}
                        className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium"
                    >
                        Create Your First Habit
                    </button>
                </div>
            </div>
        )
    }

    const completedCount = habits.filter(h => isCompleted(h.id)).length

    return (
        <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100 hover:shadow-2xl transition-shadow">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">Habit Tracker</h3>
                    <p className="text-sm text-gray-600">Build consistency every day</p>
                </div>
                <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">{formattedDate}</div>
                    <div className="text-xs text-gray-500 mt-1">
                        {completedCount}/{habits.length} completed
                    </div>
                </div>
            </div>

            {/* Habits List */}
            <div className="space-y-3 mb-4">
                {habits.map(habit => {
                    const completed = isCompleted(habit.id)

                    return (
                        <div
                            key={habit.id}
                            onClick={() => toggleHabit(habit.id)}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group"
                        >
                            {/* Icon */}
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                                style={{ backgroundColor: habit.color + '20' }}
                            >
                                {habit.icon}
                            </div>

                            {/* Habit Name */}
                            <div className="flex-1 min-w-0">
                                <div className={`font-medium ${completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                    {habit.name}
                                </div>
                            </div>

                            {/* Checkbox */}
                            <div className="flex-shrink-0">
                                <div
                                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${completed
                                            ? 'border-transparent'
                                            : 'border-gray-300 group-hover:border-gray-400'
                                        }`}
                                    style={{
                                        backgroundColor: completed ? habit.color : 'transparent'
                                    }}
                                >
                                    {completed && (
                                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Footer - View All Button */}
            <button
                onClick={onNavigateToHabits}
                className="w-full py-3 text-center text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors border border-gray-200"
            >
                View All Habits →
            </button>
        </div>
    )
}
