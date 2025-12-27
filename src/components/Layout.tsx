import { ReactNode } from 'react'

interface LayoutProps {
    children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
    return (
        <div className="min-h-screen bg-background">
            {/* Main content area */}
            <main className="pb-20 md:pb-8">
                {children}
            </main>

            {/* Bottom Navigation - Mobile Only */}
            <nav className="fixed bottom-0 left-0 right-0 md:hidden glass border-t border-border z-40">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-around py-2">
                        <a href="#dashboard" className="flex flex-col items-center gap-1 tap-target px-3 py-2 rounded-lg text-primary">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                            </svg>
                            <span className="text-xs font-medium">Dashboard</span>
                        </a>

                        <a href="#habits" className="flex flex-col items-center gap-1 tap-target px-3 py-2 rounded-lg text-foreground/60 hover:text-foreground transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            <span className="text-xs font-medium">Habits</span>
                        </a>

                        <a href="#goals" className="flex flex-col items-center gap-1 tap-target px-3 py-2 rounded-lg text-foreground/60 hover:text-foreground transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="text-xs font-medium">Goals</span>
                        </a>

                        <a href="#analytics" className="flex flex-col items-center gap-1 tap-target px-3 py-2 rounded-lg text-foreground/60 hover:text-foreground transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span className="text-xs font-medium">Analytics</span>
                        </a>
                    </div>
                </div>
            </nav>
        </div>
    )
}
