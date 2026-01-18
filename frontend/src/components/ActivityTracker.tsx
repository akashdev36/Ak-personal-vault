import { useState, useEffect } from 'react'
import {
    ActivityEntry,
    getActivitiesForDate,
    saveActivity,
    getTodayDate
} from '../services/activityService'

interface ActivityTrackerProps {
    date?: string
    showInput?: boolean
}

// Bold, vibrant colors
const VIBRANT_COLORS = [
    { bg: 'bg-rose-500', border: 'border-rose-600', text: 'text-white', dot: 'bg-rose-500' },
    { bg: 'bg-violet-500', border: 'border-violet-600', text: 'text-white', dot: 'bg-violet-500' },
    { bg: 'bg-cyan-500', border: 'border-cyan-600', text: 'text-white', dot: 'bg-cyan-500' },
    { bg: 'bg-amber-500', border: 'border-amber-600', text: 'text-white', dot: 'bg-amber-500' },
    { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-white', dot: 'bg-emerald-500' },
    { bg: 'bg-fuchsia-500', border: 'border-fuchsia-600', text: 'text-white', dot: 'bg-fuchsia-500' },
    { bg: 'bg-sky-500', border: 'border-sky-600', text: 'text-white', dot: 'bg-sky-500' },
    { bg: 'bg-orange-500', border: 'border-orange-600', text: 'text-white', dot: 'bg-orange-500' },
    { bg: 'bg-indigo-500', border: 'border-indigo-600', text: 'text-white', dot: 'bg-indigo-500' },
    { bg: 'bg-teal-500', border: 'border-teal-600', text: 'text-white', dot: 'bg-teal-500' },
]

export default function ActivityTracker({ date, showInput = true }: ActivityTrackerProps) {
    const [activities, setActivities] = useState<ActivityEntry[]>([])
    const [newActivity, setNewActivity] = useState('')
    const [saving, setSaving] = useState(false)

    const displayDate = date || getTodayDate()
    const isToday = displayDate === getTodayDate()

    useEffect(() => {
        loadActivities()
    }, [displayDate])

    const loadActivities = () => {
        const dateActivities = getActivitiesForDate(displayDate)
        setActivities(dateActivities.sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ))
    }

    const handleAddActivity = () => {
        if (!newActivity.trim()) return
        setSaving(true)
        const entry = saveActivity(newActivity)
        setActivities(prev => [...prev, entry])
        setNewActivity('')
        setSaving(false)
    }

    const getTitle = () => {
        if (isToday) return "Today's Timeline"
        const dateObj = new Date(displayDate + 'T00:00:00')
        return dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    }

    const getColor = (index: number) => VIBRANT_COLORS[index % VIBRANT_COLORS.length]

    return (
        <div className="space-y-3 md:space-y-4">
            {/* Premium Activity Input Card */}
            {showInput && isToday && (
                <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100">
                    {/* Header */}
                    <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-50">
                        <h3 className="font-semibold text-gray-800 text-sm md:text-base">Track Activity</h3>
                        <p className="text-gray-400 text-xs mt-0.5">What are you working on?</p>
                    </div>

                    {/* Input area */}
                    <div className="p-4 md:p-5">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                value={newActivity}
                                onChange={(e) => setNewActivity(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddActivity()}
                                placeholder="e.g. Working on project..."
                                className="flex-1 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:bg-white transition-all text-gray-700 placeholder-gray-400 text-sm"
                            />
                            <button
                                onClick={handleAddActivity}
                                disabled={!newActivity.trim() || saving}
                                className="px-6 py-3 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40 text-sm whitespace-nowrap"
                            >
                                {saving ? 'Saving...' : 'Log Now'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Timeline Card */}
            <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Header */}
                <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-800 text-sm md:text-base">{getTitle()}</h3>
                        {activities.length > 0 && (
                            <span className="text-xs font-medium text-gray-400">
                                {activities.length} logged
                            </span>
                        )}
                    </div>
                </div>

                {/* Timeline Content */}
                <div className="p-3 md:p-5">
                    {activities.length === 0 ? (
                        <div className="text-center py-6 md:py-8">
                            <p className="text-gray-400 text-xs md:text-sm">No activities logged</p>
                            {isToday && showInput && (
                                <p className="text-gray-300 text-xs mt-1">Start by entering what you're doing</p>
                            )}
                        </div>
                    ) : (
                        <div className="relative">
                            {/* Vertical timeline line */}
                            <div className="absolute left-[52px] md:left-[75px] top-3 bottom-3 w-0.5 bg-gray-200" />

                            <div className="space-y-3 md:space-y-4">
                                {activities.map((activity, index) => {
                                    const colors = getColor(index)
                                    return (
                                        <div key={activity.id} className="relative flex gap-2 md:gap-3">
                                            {/* Time on left */}
                                            <div className="w-12 md:w-16 flex-shrink-0 text-right pt-1">
                                                <span className="text-[10px] md:text-xs font-medium text-gray-500">
                                                    {activity.time}
                                                </span>
                                            </div>

                                            {/* Timeline dot */}
                                            <div className="relative z-10 flex-shrink-0 mt-2">
                                                <div className={`w-1.5 md:w-2 h-1.5 md:h-2 rounded-full ${colors.dot}`} />
                                            </div>

                                            {/* Content */}
                                            <div className={`flex-1 ${colors.bg} ${colors.border} border rounded-lg md:rounded-xl p-3 md:p-4 min-w-0`}>
                                                <p className={`font-medium ${colors.text} text-sm md:text-base break-words`}>
                                                    {activity.activity}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
