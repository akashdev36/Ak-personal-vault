import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import Note from './components/Note'
import Videos from './components/Videos'
import Habits from './components/Habits'
import HomeDashboard from './components/HomeDashboard'
import Journal from './components/Journal'
import AiChat from './components/AiChat'
import CommunicationCoach from './components/CommunicationCoach'
import DayActivities from './components/DayActivities'
import Login from './components/Login'
import BottomNav from './components/BottomNav'
import { ToastProvider } from './components/ToastProvider'
import { isAuthenticated, getCurrentUser, silentTokenRefresh, signOut } from './services/googleDrive'
import { AppDataProvider } from './contexts/AppDataContext'

function App() {
    const [currentPage, setCurrentPage] = useState('home')
    const [authenticated, setAuthenticated] = useState(false)
    const [loading, setLoading] = useState(true)
    const [isVideoPlaying, setIsVideoPlaying] = useState(false)
    const [selectedDate, setSelectedDate] = useState<string>('')

    // Simple navigation function
    const navigateTo = useCallback((page: string) => {
        console.log('Navigating to:', page)
        setCurrentPage(page)
    }, [])

    // Navigate to day activities page
    const navigateToDayActivities = useCallback((date: string) => {
        console.log('Navigating to day-activities for date:', date)
        setSelectedDate(date)
        setCurrentPage('day-activities')
    }, [])

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
        signOut()
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
        <ToastProvider onRelogin={handleSignOut}>
            <AppDataProvider isAuthenticated={authenticated}>
                {/* Main container with bottom padding for mobile nav */}
                <div className="min-h-screen bg-background pb-24 md:pb-0">
                    {/* Show header on all pages except note page */}
                    {currentPage !== 'note' && (
                        <Header
                            onPageChange={navigateTo}
                            currentPage={currentPage}
                            onSignOut={handleSignOut}
                        />
                    )}

                    {currentPage === 'home' && (
                        <HomeDashboard
                            onNavigateTo={navigateTo}
                            onDateSelect={navigateToDayActivities}
                        />
                    )}

                    {currentPage === 'note' && (
                        <Note onBack={() => window.history.back()} />
                    )}

                    {currentPage === 'habits' && (
                        <div className="p-4 md:p-8">
                            <Habits />
                        </div>
                    )}

                    {currentPage === 'videos' && (
                        <Videos onVideoPlaying={setIsVideoPlaying} />
                    )}

                    {currentPage === 'journal' && (
                        <Journal onBack={() => window.history.back()} />
                    )}

                    {currentPage === 'ai-chat' && (
                        <AiChat
                            userEmail={getCurrentUser()?.email || 'anonymous'}
                            onBack={() => window.history.back()}
                        />
                    )}

                    {currentPage === 'communication-coach' && (
                        <CommunicationCoach
                            userEmail={getCurrentUser()?.email || 'anonymous'}
                            onBack={() => window.history.back()}
                        />
                    )}

                    {currentPage === 'day-activities' && selectedDate && (
                        <DayActivities
                            date={selectedDate}
                            onBack={() => window.history.back()}
                        />
                    )}

                    {/* Global Mobile Bottom Navigation - Hidden during video playback */}
                    {currentPage !== 'videos' || !isVideoPlaying ? (
                        <BottomNav currentPage={currentPage} onNavigateTo={navigateTo} />
                    ) : null}
                </div>
            </AppDataProvider>
        </ToastProvider>
    )
}

export default App
