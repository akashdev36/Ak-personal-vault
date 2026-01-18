import { useState, useEffect, useRef } from 'react'
import { JournalEntry, loadJournalFromDrive, saveJournalToDrive } from '../services/journalService'
import { getTodayDate } from '../services/habitsService'

interface JournalProps {
    onBack: () => void
}

export default function Journal({ onBack }: JournalProps) {
    const [entries, setEntries] = useState<JournalEntry[]>([])
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const [loading, setLoading] = useState(true)
    const [newMessage, setNewMessage] = useState('')
    const [sending, setSending] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        loadEntries()
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [entries])

    // Load today's message into input for editing
    useEffect(() => {
        const todayDate = getTodayDate()
        const todayEntry = entries.find(e => e.date === todayDate)
        if (todayEntry) {
            setNewMessage(todayEntry.note)
            setIsEditing(false)  // Start in view mode if entry exists
        } else {
            setNewMessage('')
            setIsEditing(true)   // Start in edit mode if no entry
        }
    }, [entries])

    const loadEntries = async () => {
        try {
            setLoading(true)
            const entriesData = await loadJournalFromDrive()
            const sortedEntries = Object.values(entriesData)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            setEntries(sortedEntries)
        } catch (error) {
            console.error('Error loading journal entries:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSendMessage = async () => {
        if (!newMessage.trim() || sending) return

        try {
            setSending(true)
            const timestamp = new Date().toISOString()
            const todayDate = getTodayDate()

            // Load existing entries
            const existingEntries = await loadJournalFromDrive()

            // Find today's entry
            const todayKey = Object.keys(existingEntries).find(key => existingEntries[key].date === todayDate)

            if (todayKey) {
                // Update existing entry for today
                existingEntries[todayKey] = {
                    ...existingEntries[todayKey],
                    note: newMessage.trim(),
                    timestamp: timestamp
                }
            } else {
                // Create new entry for today
                existingEntries[timestamp] = {
                    date: todayDate,
                    mood: '📝',
                    note: newMessage.trim(),
                    timestamp
                }
            }

            // Save to Drive
            await saveJournalToDrive(existingEntries)

            // Reload and exit edit mode
            await loadEntries()
            setIsEditing(false)
        } catch (error) {
            console.error('Error sending message:', error)
            await loadEntries()
        } finally {
            setSending(false)
        }
    }

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const formatDateHeader = (dateStr: string) => {
        const date = new Date(dateStr)
        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)

        if (date.toDateString() === today.toDateString()) return 'Today'
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

        return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
    }

    // Filter entries based on search only
    const filteredEntries = entries.filter(entry => {
        const matchesSearch = !searchQuery ||
            entry.note?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            formatDateHeader(entry.date).toLowerCase().includes(searchQuery.toLowerCase())

        return matchesSearch
    })

    return (
        <div className="min-h-screen bg-[#e5ddd5] flex flex-col relative">
            {/* Header */}
            <div className="bg-[#075e54] text-white shadow-md z-10 sticky top-0">
                <div className="p-4 flex items-center gap-4">
                    <button onClick={onBack} className="hover:bg-white/10 p-2 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">
                            📖
                        </div>
                        <div>
                            <h1 className="font-bold text-lg leading-tight">Dairy</h1>
                            <p className="text-xs opacity-80">{filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="hover:bg-white/10 p-2 rounded-full transition-colors relative"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        {searchQuery && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full"></span>
                        )}
                    </button>
                </div>

                {/* Search & Filters Panel */}
                {showFilters && (
                    <div className="bg-[#065e54] p-4 space-y-4 border-t border-white/10">
                        {/* Search Bar */}
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search entries..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat' }}>
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-[70vh] text-center p-8">
                        <div className="w-12 h-12 border-4 border-[#075e54] border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-gray-600">Loading your diary...</p>
                    </div>
                ) : filteredEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[70vh] text-center p-8">
                        <div className="bg-[#dcf8c6] p-4 rounded-xl shadow-sm max-w-sm">
                            {entries.length === 0 ? (
                                <>
                                    <p className="text-gray-800">👋 Welcome to your personal diary!</p>
                                    <p className="text-sm text-gray-600 mt-2">
                                        Use the "How is today?" button on the dashboard to add your first entry here.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-gray-800">🔍 No entries found</p>
                                    <p className="text-sm text-gray-600 mt-2">
                                        Try adjusting your search or filters
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    filteredEntries.map((entry, index) => {
                        const showDateHeader = index === 0 || formatDateHeader(entry.date) !== formatDateHeader(filteredEntries[index - 1].date)

                        // Count unique dates up to this entry to determine left/right
                        const uniqueDates = new Set(filteredEntries.slice(0, index + 1).map(e => e.date))
                        const dateIndex = uniqueDates.size - 1
                        const isRight = dateIndex % 2 === 0  // Even dates on right (today, 2 days ago, etc.)

                        return (
                            <div key={entry.timestamp || `${entry.date}-${index}`} className="flex flex-col">
                                {showDateHeader && (
                                    <div className="flex justify-center mb-4 sticky top-2 z-0">
                                        <span className="bg-[#e1f3fb] text-gray-600 text-xs font-medium px-3 py-1 rounded-lg shadow-sm uppercase tracking-wide">
                                            {formatDateHeader(entry.date)}
                                        </span>
                                    </div>
                                )}

                                <div className={`${isRight ? 'self-end' : 'self-start'} max-w-[85%] md:max-w-[70%]`}>
                                    <div className={`${isRight
                                        ? 'bg-[#dcf8c6] rounded-tl-xl rounded-bl-xl rounded-br-xl shadow-sm p-3 relative group mr-2 mb-2 before:content-[\'\'] before:absolute before:top-0 before:-right-2 before:w-0 before:h-0 before:border-[8px] before:border-transparent before:border-t-[#dcf8c6] before:border-l-[#dcf8c6]'
                                        : 'bg-white rounded-tr-xl rounded-br-xl rounded-bl-xl shadow-sm p-3 relative group ml-2 mb-2 before:content-[\'\'] before:absolute before:top-0 before:-left-2 before:w-0 before:h-0 before:border-[8px] before:border-transparent before:border-t-white before:border-r-white'
                                        }`}>
                                        {/* Mood Header */}
                                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
                                            <span className="text-3xl animate-bounce-short">{entry.mood}</span>
                                            <span className="text-sm font-semibold text-gray-800">
                                                {formatDateHeader(entry.date)}
                                            </span>

                                            {/* Edit button for today's entry - shown on right side */}
                                            {entry.date === getTodayDate() && !isEditing && (
                                                <button
                                                    onClick={() => setIsEditing(true)}
                                                    className="ml-auto text-gray-500 hover:text-[#075e54] transition-colors p-1"
                                                    title="Edit entry"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>

                                        {/* Note Content */}
                                        {entry.note ? (
                                            <p className="text-gray-800 whitespace-pre-wrap text-[15px] leading-relaxed">
                                                {entry.note}
                                            </p>
                                        ) : (
                                            <p className="text-gray-400 italic text-sm">No note added</p>
                                        )}

                                        {/* Timestamp - show actual time if available */}
                                        {entry.timestamp && (
                                            <div className="text-[10px] text-gray-400 text-right mt-1">
                                                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        )}

                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Bar - Only show when editing or no entry for today */}
            {isEditing && (
                <div className="bg-[#f0f0f0] border-t border-gray-300 p-3 safe-bottom">
                    <div className="flex items-end gap-2 max-w-4xl mx-auto">
                        <textarea
                            ref={textareaRef}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    handleSendMessage()
                                }
                            }}
                            placeholder="Type a message..."
                            className="flex-1 p-3 rounded-3xl bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#075e54] resize-none max-h-32 overflow-y-auto"
                            style={{ fontSize: '16px', minHeight: '44px' }}
                            rows={1}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim() || sending}
                            className="w-12 h-12 rounded-full bg-[#075e54] text-white flex items-center justify-center hover:bg-[#064e47] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0"
                        >
                            {sending ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
