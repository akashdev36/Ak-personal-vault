import { useState, useEffect } from 'react'
import Header from './components/Header'
import Note from './components/Note'
import Videos from './components/Videos'
import Login from './components/Login'
import { isAuthenticated } from './services/googleDrive'
import { AppDataProvider } from './contexts/AppDataContext'

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
        <AppDataProvider isAuthenticated={authenticated}>
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
                    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4 relative overflow-hidden">
                        {/* Animated background blobs */}
                        <div className="absolute top-20 left-10 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
                        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

                        {/* Welcome Card */}
                        <div className="relative z-10 max-w-2xl mx-auto pt-4">
                            <div className="backdrop-blur-md bg-white/30 rounded-3xl p-12 border border-white/50 shadow-2xl text-center">
                                <h2 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent mb-4 animate-fadeIn">
                                    Your Workspace
                                </h2>
                                <p className="text-xl md:text-2xl text-foreground/70 font-medium animate-slideUp">
                                    Ready to create something amazing?
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {currentPage === 'note' && (
                    <Note
                        showGlobalHeader={showHeaderInNote}
                        onToggleGlobalHeader={() => setShowHeaderInNote(!showHeaderInNote)}
                    />
                )}

                {currentPage === 'videos' && <Videos />}
            </div>
        </AppDataProvider>
    )
}

export default App
