import { useState, useRef, useEffect } from 'react'
import { saveNotesToDrive, loadNotesFromDrive, NoteItem } from '../services/notesService'
import { initializeGoogleAPI } from '../services/googleDrive'
import { exportNoteToPDF } from '../services/pdfService'
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'



interface NoteProps {
    showGlobalHeader: boolean
    onToggleGlobalHeader: () => void
}

export default function Note({ showGlobalHeader, onToggleGlobalHeader }: NoteProps) {
    const [notes, setNotes] = useState<NoteItem[]>([])
    const [currentNoteId, setCurrentNoteId] = useState<number | null>(null)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isDeleteMode, setIsDeleteMode] = useState(false)
    const [selectedNotes, setSelectedNotes] = useState<number[]>([])
    const [isToolbarVisible, setIsToolbarVisible] = useState(true)
    const [isLocked, setIsLocked] = useState(false)
    const [history, setHistory] = useState<string[]>([])
    const [historyIndex, setHistoryIndex] = useState(-1)
    const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
    const [editingTitle, setEditingTitle] = useState('')
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncError, setSyncError] = useState<string | null>(null)
    const [isExportingPDF, setIsExportingPDF] = useState(false)
    const [showNewNoteModal, setShowNewNoteModal] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showClearConfirm, setShowClearConfirm] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [hasSelection, setHasSelection] = useState(false)
    const [selectedFont, setSelectedFont] = useState('Arial')
    const [selectedSize, setSelectedSize] = useState('16')
    const [showHeadingMenu, setShowHeadingMenu] = useState(false)
    const [showColorPicker, setShowColorPicker] = useState(false)
    const [showBgColorPicker, setShowBgColorPicker] = useState(false)
    const editorRef = useRef<HTMLDivElement>(null)
    const saveTimeoutRef = useRef<number | null>(null)

    // Load notes from localStorage first (instant), then sync with Drive
    useEffect(() => {
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

                        // Auto-open first note
                        if (localNotes.length > 0 && !currentNoteId) {
                            const firstNote = localNotes[0]
                            setCurrentNoteId(firstNote.id)
                            if (editorRef.current) {
                                editorRef.current.innerHTML = firstNote.content
                            }
                        }
                    } catch (e) {
                        console.error('Failed to parse notes backup:', e)
                    }
                }

                // Then sync with Google Drive in background
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
                    // Update localStorage with Drive data
                    localStorage.setItem('notes_backup', JSON.stringify(driveNotes))

                    // Auto-open first note if none selected
                    if (!currentNoteId && driveNotes.length > 0) {
                        const firstNote = driveNotes[0]
                        setCurrentNoteId(firstNote.id)
                        if (editorRef.current) {
                            editorRef.current.innerHTML = firstNote.content
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading notes:', error)
            }
        }
        loadNotes()
    }, [])

    // Auto-save notes to Google Drive (debounced) + localStorage (instant)
    const syncNotes = async (updatedNotes: NoteItem[]) => {
        // Save to localStorage immediately (instant backup)
        localStorage.setItem('notes_backup', JSON.stringify(updatedNotes))

        // Debounce Drive sync to avoid API spam
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }

        saveTimeoutRef.current = setTimeout(async () => {
            setIsSyncing(true)
            setSyncError(null)
            try {
                await saveNotesToDrive(updatedNotes)
            } catch (error) {
                console.error('Error syncing notes:', error)
                setSyncError('Failed to sync')
            } finally {
                setIsSyncing(false)
            }
        }, 2000) // Wait 2 seconds after last change before saving to Drive
    }

    const handleExportPDF = async () => {
        if (!currentNoteId) return

        const currentNote = notes.find(n => n.id === currentNoteId)
        if (!currentNote) return

        setIsExportingPDF(true)
        try {
            await exportNoteToPDF(currentNote)
        } catch (error) {
            console.error('Error exporting PDF:', error)
            setSyncError('Failed to export PDF')
        } finally {
            setIsExportingPDF(false)
        }
    }

    // Track text selection for formatting toolbar
    useEffect(() => {
        const handleSelectionChange = () => {
            const selection = window.getSelection()
            if (editorRef.current?.contains(selection?.anchorNode || null)) {
                setHasSelection(!!selection && selection.toString().length > 0)
            } else {
                setHasSelection(false)
            }
        }

        document.addEventListener('selectionchange', handleSelectionChange)
        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange)
        }
    }, [])

    // Rich text formatting functions - Apply only to selected text
    const applyFormat = (command: string, value?: string) => {
        document.execCommand(command, false, value)
        editorRef.current?.focus()
    }

    const applyFontFamily = (font: string) => {
        if (!hasSelection) return
        setSelectedFont(font)
        applyFormat('fontName', font)
    }

    const applyFontSize = (size: string) => {
        if (!hasSelection) return
        setSelectedSize(size)
        // Wrap selection in span with font size
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            const span = document.createElement('span')
            span.style.fontSize = `${size}px`
            try {
                range.surroundContents(span)
            } catch (e) {
                // If surrounding fails, use execCommand
                applyFormat('fontSize', '7') // Large
                // Then apply custom size
                const sel = window.getSelection()
                if (sel && sel.anchorNode && sel.anchorNode.parentElement) {
                    sel.anchorNode.parentElement.style.fontSize = `${size}px`
                }
            }
        }
    }

    const applyHeading = (level: 'h1' | 'h2' | 'h3') => {
        if (!hasSelection) return
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            const span = document.createElement('span')
            span.style.fontWeight = 'bold'

            // Apply appropriate font size for heading level
            switch (level) {
                case 'h1':
                    span.style.fontSize = '32px'
                    break
                case 'h2':
                    span.style.fontSize = '24px'
                    break
                case 'h3':
                    span.style.fontSize = '20px'
                    break
            }

            try {
                range.surroundContents(span)
            } catch (e) {
                // Fallback: apply bold and larger font
                applyFormat('bold')
                applyFontSize(level === 'h1' ? '32' : level === 'h2' ? '24' : '20')
            }
        }
        setShowHeadingMenu(false)
    }

    const applyColor = (color: string) => {
        applyFormat('foreColor', color)
        setShowColorPicker(false)
    }

    const applyBackgroundColor = (color: string) => {
        applyFormat('backColor', color)
        setShowBgColorPicker(false)
    }

    const toggleSidebar = () => {
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
            setCurrentNoteId(note.id)
            if (editorRef.current) {
                editorRef.current.innerHTML = note.content
            }
            // Only close sidebar on small screens (< 768px)
            if (window.innerWidth < 768) {
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
            const updatedNotes = notes.map(note =>
                note.id === currentNoteId ? { ...note, content } : note
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

    const handleContentChange = () => {
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

    const handleClear = () => {
        setShowClearConfirm(true)
    }

    const confirmClear = () => {
        if (editorRef.current && !isLocked) {
            editorRef.current.innerHTML = ''
            handleContentChange()
        }
        setShowClearConfirm(false)
    }

    // Filter notes by search query
    const filteredNotes = notes.filter(note =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="flex h-screen bg-background overflow-hidden max-w-full">
            {/* Sidebar */}
            <div
                className={`fixed left-0 top-16 bottom-0 w-full sm:w-80 max-w-full bg-white border-r border-border shadow-lg transition-transform duration-300 z-30 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full">
                    {/* Sidebar Header */}
                    <div className="p-4 border-b border-border">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-foreground">My Notes</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={toggleDeleteMode}
                                    className={`tap-target p-2 rounded-lg transition-colors ${isDeleteMode
                                        ? 'bg-destructive text-white'
                                        : 'bg-muted text-foreground hover:bg-secondary'
                                        }`}
                                    title="Delete mode"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                                <button
                                    onClick={createNewNote}
                                    className="tap-target p-2 rounded-lg bg-primary text-white hover:opacity-90 transition-opacity"
                                    title="New note"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="relative mb-4">
                            <svg
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40"
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
                                className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-foreground placeholder-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm"
                            />
                        </div>

                        {isDeleteMode && selectedNotes.length > 0 && (
                            <button
                                onClick={deleteSelectedNotes}
                                className="w-full py-2 px-4 bg-destructive text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
                            >
                                Delete {selectedNotes.length} note{selectedNotes.length > 1 ? 's' : ''}
                            </button>
                        )}
                    </div>

                    {/* Notes List */}
                    <div className="flex-1 overflow-y-auto">
                        {filteredNotes.length === 0 && searchQuery && (
                            <div className="text-center py-8 text-foreground/60">
                                <svg className="w-12 h-12 mx-auto mb-2 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                className={`relative w-full text-left p-4 border-b border-border hover:bg-secondary transition-colors cursor-pointer ${currentNoteId === note.id && !isDeleteMode ? 'bg-secondary' : ''
                                    } ${selectedNotes.includes(note.id) ? 'bg-destructive/10' : ''}`}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Checkbox for delete mode */}
                                    {isDeleteMode && (
                                        <div className="flex-shrink-0 mt-1">
                                            <div
                                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selectedNotes.includes(note.id)
                                                    ? 'bg-destructive border-destructive'
                                                    : 'border-border'
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
                                                    className="w-full px-2 py-1 border border-primary rounded focus:outline-none focus:ring-2 focus:ring-primary font-semibold text-foreground"
                                                    autoFocus
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 mb-1">
                                                {note.isPinned && (
                                                    <svg className="w-4 h-4 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M16 12V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                                                    </svg>
                                                )}
                                                <h3 className="font-semibold text-foreground truncate flex-1">{note.title}</h3>
                                                {!isDeleteMode && (
                                                    <button
                                                        onClick={(e) => startEditingTitle(note, e)}
                                                        className="flex-shrink-0 p-1 rounded hover:bg-primary/10 transition-colors"
                                                        title="Edit title"
                                                    >
                                                        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        <p className="text-sm text-foreground/60 line-clamp-2 mb-2" dangerouslySetInnerHTML={{ __html: note.content.replace(/<[^>]*>/g, '') }}></p>
                                        <p className="text-xs text-foreground/40">
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
                                            className={`flex-shrink-0 p-1.5 rounded hover:bg-secondary/50 transition-colors ${note.isPinned ? 'text-primary' : 'text-foreground/40'
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
                                <svg className="w-16 h-16 text-foreground/20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-foreground/60 mb-4">
                                    {searchQuery ? 'No notes found' : 'No notes yet'}
                                </p>
                                {!searchQuery && (
                                    <button
                                        onClick={createNewNote}
                                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
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
            <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'sm:ml-80' : 'ml-0'} max-w-full overflow-x-hidden`}>
                {/* Note Editor */}
                <div className="flex-1 p-4 sm:p-6">
                    <div className="max-w-4xl mx-auto h-full flex flex-col">
                        {/* Top Toolbar - Modern Rich Text Editor */}
                        {isToolbarVisible && (
                            <div className="flex items-center gap-4 mb-4 pb-3 border-b border-border flex-wrap">
                                {/* Group 1: Sidebar Toggle */}
                                <button
                                    onClick={toggleSidebar}
                                    className="p-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-all"
                                    title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        {isSidebarOpen ? (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        ) : (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        )}
                                    </svg>
                                </button>

                                {/* Header Toggle - Right next to sidebar */}
                                <button
                                    onClick={onToggleGlobalHeader}
                                    className="p-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-all"
                                    title={showGlobalHeader ? "Hide Header" : "Show Header"}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        {showGlobalHeader ? (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                        ) : (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        )}
                                    </svg>
                                </button>

                                <div className="w-px h-8 bg-border"></div>

                                {/* Group 2: Font Controls */}
                                <div className="flex items-center gap-2">
                                    <select
                                        value={selectedFont}
                                        onChange={(e) => applyFontFamily(e.target.value)}
                                        disabled={!hasSelection}
                                        className="px-3 py-1.5 text-sm border border-border rounded-lg bg-white hover:bg-secondary transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="Arial">Arial</option>
                                        <option value="Times New Roman">Times New Roman</option>
                                        <option value="Courier New">Courier New</option>
                                        <option value="Georgia">Georgia</option>
                                        <option value="Verdana">Verdana</option>
                                    </select>

                                    <select
                                        value={selectedSize}
                                        onChange={(e) => applyFontSize(e.target.value)}
                                        disabled={!hasSelection}
                                        className="px-3 py-1.5 text-sm border border-border rounded-lg bg-white hover:bg-secondary transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="12">12</option>
                                        <option value="14">14</option>
                                        <option value="16">16</option>
                                        <option value="18">18</option>
                                        <option value="20">20</option>
                                        <option value="24">24</option>
                                        <option value="32">32</option>
                                    </select>
                                </div>

                                <div className="w-px h-8 bg-border"></div>

                                {/* Group 3: Text Formatting (enabled when text selected) */}
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => applyFormat('bold')}
                                        disabled={!hasSelection}
                                        className="p-2 rounded-lg hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Bold (Ctrl+B)"
                                    >
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z" />
                                        </svg>
                                    </button>

                                    <div className="relative">
                                        <button
                                            onClick={() => setShowHeadingMenu(!showHeadingMenu)}
                                            disabled={!hasSelection}
                                            className="px-3 py-2 rounded-lg hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                                            title="Heading"
                                        >
                                            <span className="font-bold text-sm">H</span>
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                        {showHeadingMenu && hasSelection && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setShowHeadingMenu(false)} />
                                                <div className="absolute left-0 top-full mt-1 bg-white border border-border rounded-lg shadow-xl z-50 py-1 min-w-[120px]">
                                                    <button onClick={() => applyHeading('h1')} className="w-full px-4 py-2 text-left hover:bg-secondary text-2xl font-bold transition-colors">
                                                        H1
                                                    </button>
                                                    <button onClick={() => applyHeading('h2')} className="w-full px-4 py-2 text-left hover:bg-secondary text-xl font-bold transition-colors">
                                                        H2
                                                    </button>
                                                    <button onClick={() => applyHeading('h3')} className="w-full px-4 py-2 text-left hover:bg-secondary text-lg font-bold transition-colors">
                                                        H3
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Text Color Picker */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowColorPicker(!showColorPicker)}
                                            disabled={!hasSelection}
                                            className="p-2 rounded-lg hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="Text Color"
                                        >
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                                            </svg>
                                        </button>
                                        {showColorPicker && hasSelection && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setShowColorPicker(false)} />
                                                <div className="absolute left-0 top-full mt-1 bg-white border border-border rounded-lg shadow-xl z-50 p-3">
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-xs font-medium text-foreground/70">Text Color</label>
                                                        <input
                                                            type="color"
                                                            onChange={(e) => applyColor(e.target.value)}
                                                            className="w-32 h-10 rounded cursor-pointer"
                                                            defaultValue="#000000"
                                                        />
                                                        <div className="grid grid-cols-5 gap-1">
                                                            {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000'].map(color => (
                                                                <button
                                                                    key={color}
                                                                    onClick={() => applyColor(color)}
                                                                    className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                                                                    style={{ backgroundColor: color }}
                                                                    title={color}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Background Color Picker */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowBgColorPicker(!showBgColorPicker)}
                                            disabled={!hasSelection}
                                            className="p-2 rounded-lg hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="Highlight Color"
                                        >
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M16.56 8.94L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15c-.59.59-.59 1.54 0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12zM5.21 10L10 5.21 14.79 10H5.21zM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5z" />
                                            </svg>
                                        </button>
                                        {showBgColorPicker && hasSelection && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setShowBgColorPicker(false)} />
                                                <div className="absolute left-0 top-full mt-1 bg-white border border-border rounded-lg shadow-xl z-50 p-3">
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-xs font-medium text-foreground/70">Highlight Color</label>
                                                        <input
                                                            type="color"
                                                            onChange={(e) => applyBackgroundColor(e.target.value)}
                                                            className="w-32 h-10 rounded cursor-pointer"
                                                            defaultValue="#FFFF00"
                                                        />
                                                        <div className="grid grid-cols-5 gap-1">
                                                            {['#FFFF00', '#00FFFF', '#FF00FF', '#FFA500', '#90EE90', '#FFB6C1', '#DDA0DD', '#F0E68C', '#E0FFFF', '#FFE4B5'].map(color => (
                                                                <button
                                                                    key={color}
                                                                    onClick={() => applyBackgroundColor(color)}
                                                                    className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                                                                    style={{ backgroundColor: color }}
                                                                    title={color}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Spacer - pushes right side to the end */}
                                <div className="flex-1"></div>

                                {/* Group 4: Utility Buttons (Far Right) */}
                                <div className="flex items-center gap-2">
                                    {/* Current note info */}
                                    {currentNoteId && (
                                        <div className="flex items-center gap-2 px-3 py-1 bg-secondary/50 rounded-lg">
                                            {isSyncing ? (
                                                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                            ) : syncError ? (
                                                <svg className="w-4 h-4 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                            <span className="text-xs font-medium text-foreground/70 truncate max-w-[150px]">
                                                {notes.find(n => n.id === currentNoteId)?.title || 'Untitled'}
                                            </span>
                                        </div>
                                    )}

                                    <div className="w-px h-6 bg-border"></div>

                                    {/* PDF Export */}
                                    {currentNoteId && (
                                        <button
                                            onClick={handleExportPDF}
                                            disabled={isExportingPDF}
                                            className="p-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-all disabled:opacity-50"
                                            title="Export as PDF"
                                        >
                                            {isExportingPDF ? (
                                                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            )}
                                        </button>
                                    )}

                                    {/* Lock */}
                                    <button
                                        onClick={toggleLock}
                                        className={`p-2 rounded-lg transition-all ${isLocked
                                            ? 'bg-warning/20 text-warning'
                                            : 'text-foreground/60 hover:text-foreground hover:bg-secondary'
                                            }`}
                                        title={isLocked ? 'Unlock' : 'Lock (Read-only)'}
                                    >
                                        {isLocked ? (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                            </svg>
                                        )}
                                    </button>

                                    <div className="w-px h-6 bg-border"></div>

                                    {/* Undo/Redo */}
                                    <button
                                        onClick={undo}
                                        disabled={historyIndex <= 0 || isLocked}
                                        className="p-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Undo"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={redo}
                                        disabled={historyIndex >= history.length - 1 || isLocked}
                                        className="p-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Redo"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                                        </svg>
                                    </button>

                                    <button
                                        onClick={handleClear}
                                        disabled={isLocked}
                                        className="p-2 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Clear"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>

                                </div>
                            </div>
                        )}

                        {/* Show toolbar button when hidden */}
                        {!isToolbarVisible && (
                            <div className="flex justify-center mb-3">
                                <button
                                    onClick={() => setIsToolbarVisible(true)}
                                    className="tap-target px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
                                >
                                    Show Toolbar
                                </button>
                            </div>
                        )}

                        {/* Rich Text Editor */}
                        <div
                            ref={editorRef}
                            contentEditable={!isLocked}
                            dir="ltr"
                            className={`w-full min-h-[400px] max-h-[600px] overflow-y-auto p-6 outline-none border border-border rounded-lg text-base leading-relaxed ${isLocked ? 'bg-muted/30 cursor-not-allowed' : 'bg-white focus:ring-2 focus:ring-primary/20'
                                }`}
                            onInput={handleInput}
                            onMouseUp={() => { }}
                            onKeyUp={() => { }}
                            onTouchEnd={() => { }}
                            suppressContentEditableWarning={true}
                            spellCheck={true}
                            autoCorrect="on"
                            autoCapitalize="on"
                            data-gramm="false"
                            data-gramm_editor="false"
                            data-enable-grammarly="false"
                        />

                        {/* CSS for placeholder effect */}
                        <style>{`
                            [contentEditable="true"]:empty:before {
                                content: attr(data-placeholder);
                                color: #9CA3AF;
                                cursor: text;
                            }
                        `}</style>
                    </div>
                </div>
            </div>

            {/* New Note Modal */}
            <Modal
                isOpen={showNewNoteModal}
                onClose={() => setShowNewNoteModal(false)}
                onConfirm={handleCreateNote}
                title="Create New Note"
                placeholder="Enter note title..."
                confirmText="Create"
                cancelText="Cancel"
            />

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={confirmDelete}
                title="Delete Notes"
                message={`Are you sure you want to delete ${selectedNotes.length} note${selectedNotes.length > 1 ? 's' : ''}? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                isDangerous={true}
            />

            {/* Clear Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                onConfirm={confirmClear}
                title="Clear Note Content"
                message="Are you sure you want to clear all content from this note? This action cannot be undone."
                confirmText="Clear"
                cancelText="Cancel"
                isDangerous={true}
            />
        </div>
    )
}
