import { useState } from 'react'
import { getCurrentUser, signOut } from '../services/googleDrive'

interface HeaderProps {
    onPageChange: (page: string) => void
    currentPage: string
    onSignOut: () => void
}

export default function Header({ onPageChange, currentPage, onSignOut }: HeaderProps) {
    const user = getCurrentUser()
    const [isMenuOpen, setIsMenuOpen] = useState(false)

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen)
    }

    const handleNavClick = (page: string) => {
        onPageChange(page)
        setIsMenuOpen(false)
    }

    return (
        <>
            <header className="sticky top-0 z-50 glass border-b border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Menu button on left */}
                        <button
                            onClick={toggleMenu}
                            className="tap-target p-2 rounded-lg hover:bg-secondary transition-colors"
                            aria-label="Toggle menu"
                        >
                            {isMenuOpen ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            )}
                        </button>

                        {/* Page title */}
                        <h1 className="text-lg font-semibold text-foreground capitalize">
                            {currentPage === 'videos' ? 'Shorts' : currentPage}
                        </h1>

                        {/* Empty space for balance */}
                        <div className="w-10"></div>
                    </div>
                </div>
            </header>

            {/* Backdrop */}
            {isMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
                    onClick={() => setIsMenuOpen(false)}
                ></div>
            )}

            {/* Sidebar Navigation */}
            <aside className={`fixed top-0 left-0 h-full w-80 bg-background border-r border-border z-50 transform transition-transform duration-300 ease-in-out ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'
                }`}>
                <div className="flex flex-col h-full">
                    {/* Sidebar Header */}
                    <div className="flex items-center justify-between p-4 border-b border-border">
                        <h2 className="text-xl font-bold text-foreground">Menu</h2>
                        <button
                            onClick={() => setIsMenuOpen(false)}
                            className="p-2 rounded-lg hover:bg-secondary transition-colors"
                            aria-label="Close menu"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* User Info */}
                    {user && (
                        <div className="p-4 border-b border-border bg-secondary/30">
                            <div className="flex items-center gap-3">
                                {/* Letter Avatar */}
                                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center border-2 border-primary">
                                    <span className="text-xl font-bold text-primary-foreground">
                                        {user.email.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-foreground truncate">{user.name}</p>
                                    <p className="text-sm text-foreground/60 truncate">{user.email}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navigation Links */}
                    <nav className="flex-1 p-4 overflow-y-auto">
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => handleNavClick('home')}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition-colors ${currentPage === 'home'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-foreground hover:bg-secondary'
                                    }`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                Home
                            </button>

                            <button
                                onClick={() => handleNavClick('note')}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition-colors ${currentPage === 'note'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-foreground hover:bg-secondary'
                                    }`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Notes
                            </button>

                            <button
                                onClick={() => handleNavClick('videos')}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition-colors ${currentPage === 'videos'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-foreground hover:bg-secondary'
                                    }`}
                            >
                                <svg className="w-5 h-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                    <path fill="#ff3d00" d="M29.103,2.631c4.217-2.198,9.438-0.597,11.658,3.577c2.22,4.173,0.6,9.337-3.617,11.534l-3.468,1.823c2.987,0.109,5.836,1.75,7.328,4.555c2.22,4.173,0.604,9.337-3.617,11.534L18.897,45.37c-4.217,2.198-9.438,0.597-11.658-3.577s-0.6-9.337,3.617-11.534l3.468-1.823c-2.987-0.109-5.836-1.75-7.328-4.555c-2.22-4.173-0.6-9.337,3.617-11.534C10.612,12.346,29.103,2.631,29.103,2.631z M19.122,17.12l11.192,6.91l-11.192,6.877C19.122,30.907,19.122,17.12,19.122,17.12z" />
                                    <path fill="#fff" d="M19.122,17.12v13.787l11.192-6.877L19.122,17.12z" />
                                </svg>
                                Shorts
                            </button>
                        </div>
                    </nav>

                    {/* Sign Out Button */}
                    <div className="p-4 border-t border-border">
                        <button
                            onClick={() => {
                                signOut()
                                onSignOut()
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left font-medium text-destructive hover:bg-destructive/10 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Sign Out
                        </button>
                    </div>
                </div>
            </aside>
        </>
    )
}
