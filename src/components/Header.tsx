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
                    <h1 className="text-lg font-semibold text-foreground capitalize">{currentPage}</h1>

                    {/* Empty space for balance */}
                    <div className="w-10"></div>
                </div>

                {/* Mobile menu */}
                {isMenuOpen && (
                    <nav className="py-4 border-t border-border animate-fade-in">
                        <div className="flex flex-col gap-1">
                            <button
                                onClick={() => {
                                    signOut()
                                    onSignOut()
                                }}
                                className="tap-target px-4 py-3 rounded-lg text-left font-medium text-destructive hover:bg-destructive/10 transition-colors"
                            >
                                Sign Out {user && `(${user.email})`}
                            </button>
                            <button
                                onClick={() => handleNavClick('home')}
                                className={`tap-target px-4 py-3 rounded-lg text-left font-medium transition-colors ${currentPage === 'home'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-foreground hover:bg-secondary'
                                    }`}
                            >
                                Home
                            </button>
                            <button
                                onClick={() => handleNavClick('note')}
                                className={`tap-target px-4 py-3 rounded-lg text-left font-medium transition-colors ${currentPage === 'note'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-foreground hover:bg-secondary'
                                    }`}
                            >
                                Note
                            </button>
                        </div>
                    </nav>
                )}
            </div>
        </header>
    )
}
