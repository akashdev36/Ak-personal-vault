import { useState, useRef, useEffect } from 'react'
import { saveNotesToDrive, loadNotesFromDrive, NoteItem } from '../services/notesService'
import { initializeGoogleAPI } from '../services/googleDrive'
import { exportNoteToPDF } from '../services/pdfService'
import Modal from './Modal'



interface NoteProps {
    showGlobalHeader: boolean
    onToggleGlobalHeader: () => void
}

export default function Note({ showGlobalHeader, onToggleGlobalHeader }: NoteProps) {
    const [notes, setNotes] = useState<NoteItem[]>([])
    const [currentNoteId, setCurrentNoteId] = useState<number | null>(null)
    const [noteContent, setNoteContent] = useState('')
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isDeleteMode, setIsDeleteMode] = useState(false)
    const [selectedNotes, setSelectedNotes] = useState<number[]>([])
    const [isToolbarVisible, setIsToolbarVisible] = useState(true)
    const [isLocked, setIsLocked] = useState(false)
    const [history, setHistory] = useState<string[]>([])
    const [historyIndex, setHistoryIndex] = useState(-1)
    const [hasSelection, setHasSelection] = useState(false)
    const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
    const [editingTitle, setEditingTitle] = useState('')
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncError, setSyncError] = useState<string | null>(null)
    const [isExportingPDF, setIsExportingPDF] = useState(false)
    const [currentFont, setCurrentFont] = useState('Arial')
    const [showNewNoteModal, setShowNewNoteModal] = useState(false)
    const editorRef = useRef<HTMLDivElement>(null)

    // Load notes from Google Drive on mount
    useEffect(() => {
        const loadNotes = async () => {
            try {
                await initializeGoogleAPI()
                const loadedNotes = await loadNotesFromDrive()

                if (loadedNotes.length > 0) {
                    // Sort notes: pinned first, then by creation date (newest first)
                    loadedNotes.sort((a, b) => {
                        if (a.isPinned && !b.isPinned) return -1
                        if (!a.isPinned && b.isPinned) return 1
                        return b.createdAt.getTime() - a.createdAt.getTime()
                    })

                    setNotes(loadedNotes)
                    // Auto-open first note if available and no note is currently selected
                    if (!currentNoteId) {
                        const firstNote = loadedNotes[0]
                        setCurrentNoteId(firstNote.id)
                        setNoteContent(firstNote.content)
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

    // Auto-save notes to Google Drive
    const syncNotes = async (updatedNotes: NoteItem[]) => {
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

    // Track selection changes
    useEffect(() => {
        const handleSelectionChange = () => {
            const selection = window.getSelection()
            if (editorRef.current?.contains(selection?.anchorNode || null)) {
                setHasSelection(!!selection && selection.toString().length > 0)
            }
        }

        document.addEventListener('selectionchange', handleSelectionChange)
        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange)
        }
    }, [])

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen)
    }

    const togglePin = (noteId: number) => {
        const updatedNotes = notes.map(note =>
            note.id === noteId ? { ...note, isPinned: !note.isPinned } : note
        )
        // Sort after toggling pin
        updatedNotes.sort((a, b) => {
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
            setNoteContent(note.content)
            setCurrentNoteId(note.id)
            if (editorRef.current) {
                editorRef.current.innerHTML = note.content
            }
            setIsSidebarOpen(false)
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
        setNoteContent('')
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
            const content = editorRef.current.innerHTML
            setNoteContent(content)
            const updatedNotes = notes.map(note =>
                note.id === currentNoteId ? { ...note, content } : note
            )
            setNotes(updatedNotes)
            syncNotes(updatedNotes)
        }
    }

    const handleContentChange = () => {
        saveCurrentNote()
        if (editorRef.current) {
            const content = editorRef.current.innerHTML
            setHistory(prev => [...prev.slice(0, historyIndex + 1), content])
            setHistoryIndex(prev => prev + 1)
        }
    }

    const handleInput = () => {
        handleContentChange()
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
        const updatedNotes = notes.filter(note => !selectedNotes.includes(note.id))
        setNotes(updatedNotes)
        setSelectedNotes([])
        setIsDeleteMode(false)
        if (currentNoteId && selectedNotes.includes(currentNoteId)) {
            setCurrentNoteId(null)
            setNoteContent('')
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

    const makeBold = () => document.execCommand('bold')
    const makeHighlight = () => document.execCommand('backColor', false, '#FFFF00')
    const makeH1 = () => document.execCommand('formatBlock', false, '<h1>')
    const makeH2 = () => document.execCommand('formatBlock', false, '<h2>')
    const makeH3 = () => document.execCommand('formatBlock', false, '<h3>')

    const applyColor = (color: string) => {
        document.execCommand('foreColor', false, color)
        handleContentChange()
    }

    const applyFont = (font: string) => {
        document.execCommand('fontName', false, font)
        setCurrentFont(font)
        handleContentChange()
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
        if (editorRef.current && !isLocked) {
            editorRef.current.innerHTML = ''
            handleContentChange()
        }
    }

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <div
                className={`fixed left-0 top-16 bottom-0 w-80 bg-white border-r border-border shadow-lg transition-transform duration-300 z-30 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
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
                        {notes.map((note) => (
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
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'ml-80' : 'ml-0'}`}>
                {/* Note Editor */}
                <div className="flex-1 p-4 sm:p-6">
                    <div className="max-w-4xl mx-auto h-full flex flex-col">
                        {/* Top Toolbar */}
                        {isToolbarVisible && (
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={onToggleGlobalHeader}
                                        className="tap-target p-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-colors"
                                        title={showGlobalHeader ? "Minimize (hide header)" : "Maximize (show header)"}
                                    >
                                        {showGlobalHeader ? (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                            </svg>
                                        )}
                                    </button>

                                    {/* Current Note Title with Sync Status */}
                                    {currentNoteId && (
                                        <div className="flex items-center gap-2 text-xs">
                                            {/* Sync/Error Icon */}
                                            {isSyncing ? (
                                                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                            ) : syncError ? (
                                                <svg className="w-4 h-4 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            ) : null}

                                            {/* Note Title */}
                                            <span className={`font-medium ${syncError ? 'text-destructive' : 'text-foreground/70'}`}>
                                                {notes.find(n => n.id === currentNoteId)?.title || 'Untitled'}
                                            </span>
                                        </div>
                                    )}

                                    {/* Save as PDF Button */}
                                    {currentNoteId && (
                                        <button
                                            onClick={handleExportPDF}
                                            disabled={isExportingPDF}
                                            className="tap-target p-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                                            title="Save as PDF to Drive"
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

                                    <button
                                        onClick={toggleSidebar}
                                        className="tap-target p-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-colors"
                                        title="Toggle sidebar"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="flex gap-1">
                                    {/* Formatting buttons */}
                                    <button
                                        onClick={makeBold}
                                        disabled={isLocked || !hasSelection}
                                        className="tap-target p-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Bold"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={makeHighlight}
                                        disabled={isLocked || !hasSelection}
                                        className="tap-target p-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Highlight"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                        </svg>
                                    </button>

                                    {/* Headings dropdown */}
                                    <div className="relative group">
                                        <button
                                            disabled={isLocked || !hasSelection}
                                            className="tap-target p-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="Headings"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                                            </svg>
                                        </button>
                                        {!isLocked && hasSelection && (
                                            <div className="hidden group-hover:block absolute top-full left-0 mt-1 bg-white border border-border rounded-lg shadow-lg py-1 z-10">
                                                <button onClick={makeH1} className="w-full px-4 py-2 text-left hover:bg-secondary transition-colors text-lg font-bold">H1</button>
                                                <button onClick={makeH2} className="w-full px-4 py-2 text-left hover:bg-secondary transition-colors text-base font-bold">H2</button>
                                                <button onClick={makeH3} className="w-full px-4 py-2 text-left hover:bg-secondary transition-colors text-sm font-bold">H3</button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Color picker */}
                                    <div className="relative group">
                                        <button
                                            disabled={isLocked || !hasSelection}
                                            className="tap-target p-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="Text Color"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                            </svg>
                                        </button>
                                        {!isLocked && hasSelection && (
                                            <div className="hidden group-hover:block absolute top-full left-0 mt-1 bg-white border border-border rounded-lg shadow-lg p-2 z-10">
                                                <div className="grid grid-cols-4 gap-2">
                                                    <button onClick={() => applyColor('#000000')} className="w-8 h-8 rounded bg-black border border-border"></button>
                                                    <button onClick={() => applyColor('#FF0000')} className="w-8 h-8 rounded bg-red-500 border border-border"></button>
                                                    <button onClick={() => applyColor('#00FF00')} className="w-8 h-8 rounded bg-green-500 border border-border"></button>
                                                    <button onClick={() => applyColor('#0000FF')} className="w-8 h-8 rounded bg-blue-500 border border-border"></button>
                                                    <button onClick={() => applyColor('#FFFF00')} className="w-8 h-8 rounded bg-yellow-400 border border-border"></button>
                                                    <button onClick={() => applyColor('#FF00FF')} className="w-8 h-8 rounded bg-purple-500 border border-border"></button>
                                                    <button onClick={() => applyColor('#00FFFF')} className="w-8 h-8 rounded bg-cyan-400 border border-border"></button>
                                                    <button onClick={() => applyColor('#FFA500')} className="w-8 h-8 rounded bg-orange-500 border border-border"></button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Font Family Picker */}
                                    <div className="relative group">
                                        <button
                                            className="tap-target px-3 py-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-colors text-sm font-medium min-w-[100px] text-left"
                                            title="Font Family"
                                        >
                                            {currentFont}
                                        </button>
                                        <div className="hidden group-hover:block absolute top-full left-0 mt-1 bg-white border border-border rounded-lg shadow-lg py-1 z-10 min-w-[150px]">
                                            <button onClick={() => applyFont('Arial')} className="w-full px-4 py-2 text-left hover:bg-secondary transition-colors" style={{ fontFamily: 'Arial' }}>Arial</button>
                                            <button onClick={() => applyFont('Georgia')} className="w-full px-4 py-2 text-left hover:bg-secondary transition-colors" style={{ fontFamily: 'Georgia' }}>Georgia</button>
                                            <button onClick={() => applyFont('Times New Roman')} className="w-full px-4 py-2 text-left hover:bg-secondary transition-colors" style={{ fontFamily: 'Times New Roman' }}>Times New Roman</button>
                                            <button onClick={() => applyFont('Courier New')} className="w-full px-4 py-2 text-left hover:bg-secondary transition-colors" style={{ fontFamily: 'Courier New' }}>Courier New</button>
                                            <button onClick={() => applyFont('Verdana')} className="w-full px-4 py-2 text-left hover:bg-secondary transition-colors" style={{ fontFamily: 'Verdana' }}>Verdana</button>
                                            <button onClick={() => applyFont('Comic Sans MS')} className="w-full px-4 py-2 text-left hover:bg-secondary transition-colors" style={{ fontFamily: 'Comic Sans MS' }}>Comic Sans MS</button>
                                        </div>
                                    </div>

                                    <div className="w-px h-6 bg-border mx-1"></div>

                                    {/* Lock button */}
                                    <button
                                        onClick={toggleLock}
                                        className={`tap-target p-2 rounded-lg transition-colors ${isLocked
                                                ? 'bg-warning/20 text-warning'
                                                : 'text-foreground/60 hover:text-foreground hover:bg-secondary'
                                            }`}
                                        title={isLocked ? 'Unlock (Read-only)' : 'Lock (Make read-only)'}
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

                                    <div className="w-px h-6 bg-border mx-1"></div>

                                    {/* Undo/Redo */}
                                    <button
                                        onClick={undo}
                                        disabled={historyIndex <= 0 || isLocked}
                                        className="tap-target p-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Undo"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={redo}
                                        disabled={historyIndex >= history.length - 1 || isLocked}
                                        className="tap-target p-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Redo"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                                        </svg>
                                    </button>

                                    <div className="w-px h-6 bg-border mx-1"></div>

                                    <button
                                        onClick={handleClear}
                                        disabled={isLocked}
                                        className="tap-target p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
                            className={`prose w-full min-h-[300px] p-4 outline-none ${isLocked ? 'bg-muted/30 cursor-not-allowed' : 'bg-background'
                                }`}
                            onInput={handleInput}
                            onMouseUp={() => { }}
                            onKeyUp={() => { }}
                            onTouchEnd={() => { }}
                            suppressContentEditableWarning={true}
                            spellCheck={true}
                            autoCorrect="on"
                            autoCapitalize="on"
                        >
                            {noteContent}
                        </div>
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
        </div>
    )
}
