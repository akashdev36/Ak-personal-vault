import { useState, useRef, useEffect } from 'react'
import { saveNotesToDrive, loadNotesFromDrive, NoteItem } from '../services/notesService'
import { initializeGoogleAPI } from '../services/googleDrive'
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'
import { useAppData } from '../contexts/AppDataContext'



interface NoteProps {
    showGlobalHeader: boolean
    onToggleGlobalHeader: () => void
    onBack: () => void
}

export default function Note({ showGlobalHeader, onToggleGlobalHeader, onBack }: NoteProps) {
    const { notes: contextNotes, setNotes: setContextNotes } = useAppData()
    const [notes, setNotes] = useState<NoteItem[]>(contextNotes)
    const [currentNoteId, setCurrentNoteId] = useState<number | null>(null)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isDeleteMode, setIsDeleteMode] = useState(false)
    const [selectedNotes, setSelectedNotes] = useState<number[]>([])
    const [isLocked, setIsLocked] = useState(false)
    const [history, setHistory] = useState<string[]>([])
    const [historyIndex, setHistoryIndex] = useState(-1)
    const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
    const [editingTitle, setEditingTitle] = useState('')
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncError, setSyncError] = useState<string | null>(null)
    const [showNewNoteModal, setShowNewNoteModal] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [currentTitle, setCurrentTitle] = useState('')
    const editorRef = useRef<HTMLDivElement>(null)
    const titleRef = useRef<HTMLHeadingElement>(null)
    const saveTimeoutRef = useRef<number | null>(null)

    // Use preloaded notes from context
    useEffect(() => {
        if (contextNotes.length > 0) {
            setNotes(contextNotes)

            // Auto-open first note if none selected
            if (!currentNoteId) {
                const firstNote = contextNotes[0]
                setCurrentNoteId(firstNote.id)
                setCurrentTitle(firstNote.title)
                if (editorRef.current) {
                    editorRef.current.innerHTML = firstNote.content
                }
            }
        } else {
            // Fallback: load if context is empty (shouldn't happen with preloading)
            loadNotes()
        }
    }, [contextNotes])

    // Load notes from localStorage first (instant), then sync with Drive
    const loadNotes = async () => {
        try {
            // Load from localStorage immediately for instant display
            const backup = localStorage.getItem('notes_backup')
            if (backup) {
                try {
                    const localNotes = JSON.parse(backup).map((n: any) => ({
                        ...n,
                        createdAt: new Date(n.createdAt)
                    }))
                    // Sort notes
                    localNotes.sort((a: NoteItem, b: NoteItem) => {
                        if (a.isPinned && !b.isPinned) return -1
                        if (!a.isPinned && b.isPinned) return 1
                        return b.createdAt.getTime() - a.createdAt.getTime()
                    })
                    setNotes(localNotes)
                    setContextNotes(localNotes)

                    // Auto-open first note
                    if (localNotes.length > 0 && !currentNoteId) {
                        const firstNote = localNotes[0]
                        setCurrentNoteId(firstNote.id)
                        setCurrentTitle(firstNote.title)
                        if (editorRef.current) {
                            editorRef.current.innerHTML = firstNote.content
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse notes backup:', e)
                }
            }

            // Then sync with Google Drive in background
            try {
                await initializeGoogleAPI()
                const driveNotes = await loadNotesFromDrive()

                if (driveNotes.length > 0) {
                    // Sort notes
                    driveNotes.sort((a: NoteItem, b: NoteItem) => {
                        if (a.isPinned && !b.isPinned) return -1
                        if (!a.isPinned && b.isPinned) return 1
                        return b.createdAt.getTime() - a.createdAt.getTime()
                    })

                    setNotes(driveNotes)
                    setContextNotes(driveNotes)
                    // Update localStorage with Drive data
                    localStorage.setItem('notes_backup', JSON.stringify(driveNotes))

                    // Auto-open first note if none selected
                    if (!currentNoteId && driveNotes.length > 0) {
                        const firstNote = driveNotes[0]
                        setCurrentNoteId(firstNote.id)
                        setCurrentTitle(firstNote.title)
                        if (editorRef.current) {
                            editorRef.current.innerHTML = firstNote.content
                        }
                    }
                }
            } catch (driveError) {
                console.warn('Could not sync with Google Drive (offline mode):', driveError)
                // Continue using localStorage notes - user can still work offline
            }
        } catch (error) {
            console.error('Error loading notes:', error)
        }
    }

    // Auto-save to localStorage only (debounced while typing)
    const syncNotes = async (updatedNotes: NoteItem[]) => {
        // Clear any pending save
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }

        // Debounce: wait 2 seconds after last change before saving to localStorage
        saveTimeoutRef.current = window.setTimeout(async () => {
            try {
                // Save to localStorage only (fast, no API call)
                localStorage.setItem('notes_backup', JSON.stringify(updatedNotes))

                // Update context
                setContextNotes(updatedNotes)

                console.log('Notes saved to localStorage')
            } catch (error) {
                console.error('Failed to save notes to localStorage:', error)
            }
        }, 2000) // 2 second debounce
    }

    // Force sync immediately (when closing/switching notes)
    const forceSyncNotes = async (notesToSync: NoteItem[]) => {
        // Cancel any pending debounced save
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }

        try {
            setIsSyncing(true)

            // Always save to localStorage first (fast, reliable)
            localStorage.setItem('notes_backup', JSON.stringify(notesToSync))

            // Update context
            setContextNotes(notesToSync)

            // Only sync to Drive if API is ready
            // @ts-ignore - gapi might not be defined
            if (window.gapi?.client?.drive) {
                await saveNotesToDrive(notesToSync)
                console.log('Notes force synced to Drive')
            } else {
                console.log('Notes saved to localStorage (Drive API not ready)')
            }
        } catch (error) {
            console.error('Force sync failed:', error)
            // Don't throw - localStorage save already succeeded
        } finally {
            setIsSyncing(false)
        }
    }

    // Force sync when component unmounts or user navigates away
    useEffect(() => {
        return () => {
            // Force sync current notes before unmounting
            if (notes.length > 0) {
                forceSyncNotes(notes)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Empty dependency - only run on mount/unmount

    const toggleSidebar = () => {
        // If opening sidebar and has current note, force sync before showing list
        if (!isSidebarOpen && currentNoteId && editorRef.current) {
            saveCurrentNote()
            setTimeout(() => {
                forceSyncNotes(notes)
            }, 100)
        }
        setIsSidebarOpen(!isSidebarOpen)
    }

    const togglePin = (noteId: number) => {
        const updatedNotes = notes.map(note =>
            note.id === noteId ? { ...note, isPinned: !note.isPinned } : note
        )
        // Sort after toggling pin
        updatedNotes.sort((a: NoteItem, b: NoteItem) => {
            if (a.isPinned && !b.isPinned) return -1
            if (!a.isPinned && b.isPinned) return 1
            return b.createdAt.getTime() - a.createdAt.getTime()
        })
        setNotes(updatedNotes)
        syncNotes(updatedNotes)
    }

    const selectNote = (note: NoteItem) => {
        if (isDeleteMode) {
            toggleNoteSelection(note.id)
        } else {
            // Save current note before switching
            if (currentNoteId && editorRef.current) {
                saveCurrentNote()
                // Force sync after a brief delay to ensure current note is saved
                setTimeout(() => {
                    forceSyncNotes(notes)
                }, 100)
            }

            setCurrentNoteId(note.id)
            setCurrentTitle(note.title)
            if (editorRef.current) {
                editorRef.current.innerHTML = note.content
            }
            // Clear history when switching notes
            setHistory([note.content])
            setHistoryIndex(0)

            // Close sidebar on mobile after selecting note
            if (window.innerWidth < 640) {
                setIsSidebarOpen(false)
            }
        }
    }

    const createNewNote = () => {
        setShowNewNoteModal(true)
    }

    const handleCreateNote = (noteTitle: string) => {
        const newNote: NoteItem = {
            id: Date.now(),
            title: noteTitle,
            content: '',
            createdAt: new Date()
        }
        const updatedNotes = [newNote, ...notes]
        setNotes(updatedNotes)
        setCurrentNoteId(newNote.id)
        setCurrentTitle(newNote.title)
        setIsSidebarOpen(false)
        if (editorRef.current) {
            editorRef.current.innerHTML = ''
        }
        syncNotes(updatedNotes)
        setShowNewNoteModal(false)
    }

    const saveCurrentNote = () => {
        if (currentNoteId && editorRef.current) {
            // Save innerHTML to preserve formatting
            const content = editorRef.current.innerHTML || ''
            const title = currentTitle || 'Untitled'
            const updatedNotes = notes.map(note =>
                note.id === currentNoteId ? { ...note, content, title } : note
            )
            setNotes(updatedNotes)
            syncNotes(updatedNotes)

            // Add to history for undo/redo
            setHistory(prev => [...prev.slice(0, historyIndex + 1), content])
            setHistoryIndex(prev => prev + 1)
        }
    }

    // Handle editor input with auto-save
    const handleInput = () => {
        saveCurrentNote()
    }

    const handleTitleChange = (e: React.FormEvent<HTMLHeadingElement>) => {
        const newTitle = e.currentTarget.textContent || ''
        setCurrentTitle(newTitle)
        saveCurrentNote()
    }

    const toggleDeleteMode = () => {
        setIsDeleteMode(!isDeleteMode)
        setSelectedNotes([])
    }

    const toggleNoteSelection = (noteId: number) => {
        setSelectedNotes(prev =>
            prev.includes(noteId)
                ? prev.filter(id => id !== noteId)
                : [...prev, noteId]
        )
    }

    const deleteSelectedNotes = () => {
        setShowDeleteConfirm(true)
    }

    const confirmDelete = () => {
        const updatedNotes = notes.filter(note => !selectedNotes.includes(note.id))
        setNotes(updatedNotes)
        setSelectedNotes([])
        setIsDeleteMode(false)
        if (currentNoteId && selectedNotes.includes(currentNoteId)) {
            setCurrentNoteId(null)
            setCurrentTitle('')
            if (editorRef.current) {
                editorRef.current.innerHTML = ''
            }
        }
        syncNotes(updatedNotes)
    }

    const startEditingTitle = (note: NoteItem, e: React.MouseEvent) => {
        e.stopPropagation()
        setEditingNoteId(note.id)
        setEditingTitle(note.title)
    }

    const saveTitle = () => {
        if (editingNoteId && editingTitle.trim()) {
            const updatedNotes = notes.map(note =>
                note.id === editingNoteId ? { ...note, title: editingTitle.trim() } : note
            )
            setNotes(updatedNotes)
            syncNotes(updatedNotes)
        }
        setEditingNoteId(null)
        setEditingTitle('')
    }

    const cancelEditTitle = () => {
        setEditingNoteId(null)
        setEditingTitle('')
    }

    const toggleLock = () => setIsLocked(!isLocked)

    const undo = () => {
        if (historyIndex > 0 && editorRef.current) {
            const newIndex = historyIndex - 1
            editorRef.current.innerHTML = history[newIndex]
            setHistoryIndex(newIndex)
            saveCurrentNote()
        }
    }

    const redo = () => {
        if (historyIndex < history.length - 1 && editorRef.current) {
            const newIndex = historyIndex + 1
            editorRef.current.innerHTML = history[newIndex]
            setHistoryIndex(newIndex)
            saveCurrentNote()
        }
    }

    // Manual save to Drive
    const handleManualSave = async () => {
        if (currentNoteId && editorRef.current) {
            saveCurrentNote()
            await forceSyncNotes(notes)
        }
    }

    // Manual save handler for toolbar button
    const handleManualSaveToolbar = () => {
        forceSyncNotes(notes)
    }

    // Filter notes by search query
    const filteredNotes = notes.filter(note =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="flex h-screen bg-white overflow-hidden max-w-full">
            {/* Sidebar - Full screen on mobile, side panel on desktop */}
            <div
                className={`fixed inset-0 sm:left-0 sm:top-16 sm:bottom-0 sm:w-80 sm:max-w-full bg-white border-r border-gray-200 shadow-lg transition-transform duration-300 z-50 sm:z-30 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full">
                    {/* Sidebar Header */}
                    <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-800">My Notes</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={toggleDeleteMode}
                                    className={`tap-target p-2 rounded-lg transition-colors ${isDeleteMode
                                        ? 'bg-red-500 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    title="Delete mode"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                                <button
                                    onClick={createNewNote}
                                    className="tap-target p-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700 transition-opacity"
                                    title="New note"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                                {/* Back arrow - visible on mobile only */}
                                <button
                                    onClick={toggleSidebar}
                                    className="sm:hidden tap-target p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                                    title="Close sidebar"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="relative mb-4">
                            <svg
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search notes..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent transition-all text-sm"
                            />
                        </div>

                        {isDeleteMode && selectedNotes.length > 0 && (
                            <button
                                onClick={deleteSelectedNotes}
                                className="w-full py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-opacity font-medium"
                            >
                                Delete {selectedNotes.length} note{selectedNotes.length > 1 ? 's' : ''}
                            </button>
                        )}
                    </div>

                    {/* Notes List */}
                    <div className="flex-1 overflow-y-auto">
                        {filteredNotes.length === 0 && searchQuery && (
                            <div className="text-center py-8 text-gray-500">
                                <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <p className="text-sm">No notes found</p>
                            </div>
                        )}
                        {filteredNotes.map((note) => (
                            <div
                                key={note.id}
                                onClick={(e) => {
                                    e.preventDefault()
                                    selectNote(note)
                                }}
                                className={`relative w-full text-left p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer ${currentNoteId === note.id && !isDeleteMode ? 'bg-gray-50' : ''
                                    } ${selectedNotes.includes(note.id) ? 'bg-red-50' : ''}`}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Checkbox for delete mode */}
                                    {isDeleteMode && (
                                        <div className="flex-shrink-0 mt-1">
                                            <div
                                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selectedNotes.includes(note.id)
                                                    ? 'bg-red-500 border-red-500'
                                                    : 'border-gray-300'
                                                    }`}
                                            >
                                                {selectedNotes.includes(note.id) && (
                                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Note content */}
                                    <div className="flex-1 min-w-0">
                                        {editingNoteId === note.id ? (
                                            <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="text"
                                                    value={editingTitle}
                                                    onChange={(e) => setEditingTitle(e.target.value)}
                                                    onBlur={saveTitle}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') saveTitle()
                                                        if (e.key === 'Escape') cancelEditTitle()
                                                    }}
                                                    className="w-full px-2 py-1 border border-gray-800 rounded focus:outline-none focus:ring-2 focus:ring-gray-800 font-semibold text-gray-800"
                                                    autoFocus
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 mb-1">
                                                {note.isPinned && (
                                                    <svg className="w-4 h-4 text-gray-800 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M16 12V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                                                    </svg>
                                                )}
                                                <h3 className={`text-gray-800 truncate flex-1 ${currentNoteId === note.id ? 'font-bold' : 'font-semibold'}`}>
                                                    {note.title}
                                                </h3>
                                                {!isDeleteMode && (
                                                    <button
                                                        onClick={(e) => startEditingTitle(note, e)}
                                                        className="flex-shrink-0 p-1 rounded hover:bg-gray-200 transition-colors"
                                                        title="Edit title"
                                                    >
                                                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        <p className="text-sm text-gray-500 line-clamp-2 mb-2" dangerouslySetInnerHTML={{ __html: note.content.replace(/<[^>]*>/g, '') }}></p>
                                        <p className="text-xs text-gray-400">
                                            {note.createdAt.toLocaleDateString()}
                                        </p>
                                    </div>

                                    {/* Pin button */}
                                    {!isDeleteMode && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                togglePin(note.id)
                                            }}
                                            className={`flex-shrink-0 p-1.5 rounded hover:bg-gray-200 transition-colors ${note.isPinned ? 'text-gray-800' : 'text-gray-400'
                                                }`}
                                            title={note.isPinned ? 'Unpin note' : 'Pin note'}
                                        >
                                            <svg className="w-4 h-4" fill={note.isPinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Empty State */}
                        {filteredNotes.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <svg className="w-16 h-16 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-gray-500 mb-4">
                                    {searchQuery ? 'No notes found' : 'No notes yet'}
                                </p>
                                {!searchQuery && (
                                    <button
                                        onClick={createNewNote}
                                        className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                                    >
                                        Create your first note
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className={`flex flex-col transition-all duration-300 ${isSidebarOpen ? 'sm:ml-80' : 'ml-0'} max-w-full overflow-hidden h-screen`}>
                {/* Editor Header */}
                <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
                    {/* Left: Global Menu (☰) */}
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Menu"
                    >
                        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>

                    {/* Center: Action buttons */}
                    <div className="flex items-center gap-1">
                        {/* Undo */}
                        <button
                            onClick={undo}
                            disabled={historyIndex <= 0}
                            className="p-2 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Undo"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                        </button>

                        {/* Redo */}
                        <button
                            onClick={redo}
                            disabled={historyIndex >= history.length - 1}
                            className="p-2 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Redo"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6" />
                            </svg>
                        </button>

                        {/* Sync to Drive */}
                        <button
                            onClick={handleManualSave}
                            disabled={isSyncing}
                            className="p-2 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all disabled:opacity-50"
                            title="Sync to Google Drive"
                        >
                            <svg className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>

                        {/* Lock/Unlock */}
                        <button
                            onClick={() => setIsLocked(!isLocked)}
                            className={`p-2 rounded-lg transition-all ${isLocked ? 'text-gray-800 bg-gray-100' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`}
                            title={isLocked ? "Unlock editing" : "Lock editing"}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {isLocked ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                )}
                            </svg>
                        </button>
                    </div>

                    {/* Right: Notes Sidebar Toggle - Pushed to far right */}
                    <button
                        onClick={toggleSidebar}
                        className="ml-auto p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title={isSidebarOpen ? "Close notes" : "Open notes"}
                    >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSidebarOpen ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
                        </svg>
                    </button>
                </div>

                {/* Editor Area - Medium style */}
                <div className="flex-1 overflow-y-auto bg-white">
                    {currentNoteId ? (
                        <div className="max-w-[680px] mx-auto px-6 py-12">
                            {/* Title */}
                            <h1
                                ref={titleRef}
                                contentEditable={!isLocked}
                                onInput={handleTitleChange}
                                suppressContentEditableWarning
                                className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8 outline-none focus:outline-none"
                                style={{
                                    fontFamily: 'Georgia, serif',
                                    lineHeight: '1.2',
                                    letterSpacing: '-0.02em'
                                }}
                            >
                                {currentTitle || 'Untitled'}
                            </h1>

                            {/* Content */}
                            <div
                                ref={editorRef}
                                contentEditable={!isLocked}
                                onInput={handleInput}
                                className="text-xl text-gray-800 outline-none focus:outline-none min-h-[400px]"
                                style={{
                                    fontFamily: 'Georgia, serif',
                                    lineHeight: '1.58',
                                    letterSpacing: '-0.003em'
                                }}
                                suppressContentEditableWarning
                            />
                        </div>
                    ) : (
                        <div className="max-w-[680px] mx-auto px-6 py-12 text-center">
                            <svg className="w-24 h-24 mx-auto mb-6 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Select a note to start writing</h2>
                            <p className="text-gray-500 mb-6">Or create a new one to begin</p>
                            <button
                                onClick={createNewNote}
                                className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                            >
                                Create Note
                            </button>
                        </div>
                    )}
                </div>
            </div >

            {/* Modals */}
            < Modal
                isOpen={showNewNoteModal}
                onClose={() => setShowNewNoteModal(false)
                }
                onConfirm={(title) => {
                    if (title.trim()) {
                        handleCreateNote(title.trim())
                    }
                }}
                title="Create New Note"
                placeholder="Enter note title..."
                confirmText="Create"
                cancelText="Cancel"
            />

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={confirmDelete}
                title="Delete Notes"
                message={`Are you sure you want to delete ${selectedNotes.length} note${selectedNotes.length > 1 ? 's' : ''}? This action cannot be undone.`}
            />
        </div >
    )
}
