import { useState, useEffect } from 'react'
import Header from './components/Header'
import Note from './components/Note'
import Videos from './components/Videos'
import Habits from './components/Habits'
import HomeDashboard from './components/HomeDashboard'
import Journal from './components/Journal'
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
                    <HomeDashboard onNavigateTo={setCurrentPage} />
                )}

                {currentPage === 'note' && (
                    <Note
                        showGlobalHeader={showHeaderInNote}
                        onToggleGlobalHeader={() => setShowHeaderInNote(!showHeaderInNote)}
                        onBack={() => setCurrentPage('home')}
                    />
                )}

                {currentPage === 'habits' && (
                    <div className="p-4 md:p-8">
                        <Habits />
                    </div>
                )}

                {currentPage === 'videos' && (
                    <Videos />
                )}

                {currentPage === 'journal' && (
                    <Journal onBack={() => setCurrentPage('home')} />
                )}
            </div>
        </AppDataProvider>
    )
}

export default App
