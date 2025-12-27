import { useState, useEffect } from 'react'
import Header from './components/Header'
import Note from './components/Note'
import Login from './components/Login'
import { isAuthenticated } from './services/googleDrive'

function App() {
    const [currentPage, setCurrentPage] = useState('home')
    const [showHeaderInNote, setShowHeaderInNote] = useState(false)
    const [authenticated, setAuthenticated] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check if user is already authenticated
        setAuthenticated(isAuthenticated())
        setLoading(false)
    }, [])

    const handleLoginSuccess = () => {
        setAuthenticated(true)
        // Stay on home page after login
    }

    const handleSignOut = () => {
        setAuthenticated(false)
        setCurrentPage('home')
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    if (!authenticated) {
        return <Login onLoginSuccess={handleLoginSuccess} />
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Show header on home or when toggled on in note page */}
            {(currentPage !== 'note' || showHeaderInNote) && (
                <Header
                    onPageChange={setCurrentPage}
                    currentPage={currentPage}
                    onSignOut={handleSignOut}
                />
            )}

            {currentPage === 'home' && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <h2 className="text-2xl font-bold text-foreground mb-4">Welcome Home</h2>
                    <p className="text-foreground/60">Select a page from the menu</p>
                </div>
            )}

            {currentPage === 'note' && (
                <Note
                    showGlobalHeader={showHeaderInNote}
                    onToggleGlobalHeader={() => setShowHeaderInNote(!showHeaderInNote)}
                />
            )}
        </div>
    )
}

export default App
