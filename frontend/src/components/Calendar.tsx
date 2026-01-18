import { useState } from 'react'

interface CalendarProps {
    activityDates?: string[] // Dates with activities (format: YYYY-MM-DD)
    onDateSelect?: (date: string) => void
    selectedDate?: string
}

export default function Calendar({ activityDates = [], onDateSelect, selectedDate }: CalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date())

    const today = new Date()
    const todayString = today.toISOString().split('T')[0]

    // Get first day of month and total days
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
    const daysInMonth = lastDayOfMonth.getDate()

    // Start from Monday (1) instead of Sunday (0)
    let startDay = firstDayOfMonth.getDay() - 1
    if (startDay < 0) startDay = 6

    // Month navigation
    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
    }

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
    }

    const goToToday = () => {
        setCurrentMonth(new Date())
    }

    // Check if a date has activities
    const hasActivity = (day: number): boolean => {
        const dateString = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        return activityDates.includes(dateString)
    }

    // Check if date is today
    const isToday = (day: number): boolean => {
        const dateString = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        return dateString === todayString
    }

    // Check if date is selected
    const isSelected = (day: number): boolean => {
        const dateString = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        return dateString === selectedDate
    }

    // Handle date click
    const handleDateClick = (day: number) => {
        const dateString = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        onDateSelect?.(dateString)
    }

    // Month names
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December']

    // Day names
    const dayNames = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

    // Generate calendar days
    const calendarDays = []

    // Empty cells before first day
    for (let i = 0; i < startDay; i++) {
        calendarDays.push(<div key={`empty-${i}`} className="h-9" />)
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const isTodayDate = isToday(day)
        const isSelectedDate = isSelected(day)
        const hasActivityOnDay = hasActivity(day)

        calendarDays.push(
            <button
                key={day}
                onClick={() => handleDateClick(day)}
                className={`h-9 w-9 rounded-full flex flex-col items-center justify-center text-sm font-medium transition-all relative
                    ${isTodayDate
                        ? 'bg-purple-600 text-white shadow-md'
                        : isSelectedDate
                            ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-400'
                            : 'text-gray-700 hover:bg-gray-100'
                    }
                `}
            >
                {day}
                {/* Activity indicator dot */}
                {hasActivityOnDay && !isTodayDate && (
                    <span className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-green-500" />
                )}
                {hasActivityOnDay && isTodayDate && (
                    <span className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-white" />
                )}
            </button>
        )
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            {/* Header with month navigation */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={prevMonth}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                <button
                    onClick={goToToday}
                    className="text-lg font-semibold text-gray-800 hover:text-purple-600 transition-colors"
                >
                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </button>

                <button
                    onClick={nextMonth}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            {/* Day names header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map(day => (
                    <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-gray-400">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
                {calendarDays}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                    <span>Today</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Has activity</span>
                </div>
            </div>
        </div>
    )
}
