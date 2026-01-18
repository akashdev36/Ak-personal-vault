import { useState, useEffect, createContext, useContext, ReactNode } from 'react'

interface ToastContextType {
    showToast: (message: string, type?: 'error' | 'success' | 'warning') => void
    showAuthError: () => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export const useToast = () => {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within ToastProvider')
    }
    return context
}

interface ToastProviderProps {
    children: ReactNode
    onRelogin: () => void
}

interface Toast {
    id: number
    message: string
    type: 'error' | 'success' | 'warning'
    showRelogin?: boolean
}

export function ToastProvider({ children, onRelogin }: ToastProviderProps) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const showToast = (message: string, type: 'error' | 'success' | 'warning' = 'error') => {
        const id = Date.now()
        setToasts(prev => [...prev, { id, message, type }])

        // Auto-remove after 5 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 5000)
    }

    const showAuthError = () => {
        const id = Date.now()
        setToasts(prev => [...prev, {
            id,
            message: 'Session expired. Please re-login.',
            type: 'warning',
            showRelogin: true
        }])
    }

    // Listen for auth-error events from googleDrive service
    useEffect(() => {
        const handleAuthErrorEvent = () => {
            showAuthError()
        }

        window.addEventListener('auth-error', handleAuthErrorEvent)
        return () => window.removeEventListener('auth-error', handleAuthErrorEvent)
    }, [])

    // Listen for api-error events from apiService
    useEffect(() => {
        const handleApiErrorEvent = (event: CustomEvent<{ message: string }>) => {
            showToast(event.detail.message, 'error')
        }

        window.addEventListener('api-error', handleApiErrorEvent as EventListener)
        return () => window.removeEventListener('api-error', handleApiErrorEvent as EventListener)
    }, [])

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }

    return (
        <ToastContext.Provider value={{ showToast, showAuthError }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90%] max-w-md">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`p-4 rounded-xl shadow-lg flex items-center gap-3 animate-slideDown ${toast.type === 'error' ? 'bg-red-500 text-white' :
                            toast.type === 'warning' ? 'bg-amber-500 text-white' :
                                'bg-green-500 text-white'
                            }`}
                    >
                        {/* Icon */}
                        <div className="flex-shrink-0">
                            {toast.type === 'error' && (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                            {toast.type === 'warning' && (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            )}
                            {toast.type === 'success' && (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                        </div>

                        {/* Message */}
                        <div className="flex-1">
                            <p className="font-medium">{toast.message}</p>
                        </div>

                        {/* Re-login button */}
                        {toast.showRelogin && (
                            <button
                                onClick={() => {
                                    removeToast(toast.id)
                                    onRelogin()
                                }}
                                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                            >
                                Re-login
                            </button>
                        )}

                        {/* Close button */}
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="flex-shrink-0 hover:bg-white/20 rounded-full p-1 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}
