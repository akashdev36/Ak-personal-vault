import { useState, useEffect } from 'react'
import Header from './components/Header'
import Note from './components/Note'
import Videos from './components/Videos'
import Habits from './components/Habits'
import HomeDashboard from './components/HomeDashboard'
import Journal from './components/Journal'
import AiChat from './components/AiChat'
import CommunicationCoach from './components/CommunicationCoach'
import Login from './components/Login'
import { isAuthenticated, getCurrentUser, silentTokenRefresh } from './services/googleDrive'
import { AppDataProvider } from './contexts/AppDataContext'

function App() {
    const [currentPage, setCurrentPage] = useState('home')
    const [authenticated, setAuthenticated] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check if user is authenticated (persistent login)
        const checkAuth = async () => {
            if (isAuthenticated()) {
                // User exists in localStorage - try to refresh token silently
                setAuthenticated(true)
                // Refresh token in background (don't block UI)
                silentTokenRefresh().then(success => {
                    if (!success) {
                        console.log('Token refresh needed on next API call')
                    }
                })
            }
            setLoading(false)
        }
        checkAuth()
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
                {/* Show header on all pages except note page */}
                {currentPage !== 'note' && (
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
                    <Note onBack={() => setCurrentPage('home')} />
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

                {currentPage === 'ai-chat' && (
                    <AiChat
                        userEmail={getCurrentUser()?.email || 'anonymous'}
                        onBack={() => setCurrentPage('home')}
                    />
                )}

                {currentPage === 'communication-coach' && (
                    <CommunicationCoach
                        userEmail={getCurrentUser()?.email || 'anonymous'}
                        onBack={() => setCurrentPage('home')}
                    />
                )}
            </div>
        </AppDataProvider>
    )
}

export default App
