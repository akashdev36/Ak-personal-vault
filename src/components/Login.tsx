import { useState } from 'react'
import { signInWithGoogle, initializeGoogleAPI, initializeGIS } from '../services/googleDrive'

interface LoginProps {
    onLoginSuccess: () => void
}

export default function Login({ onLoginSuccess }: LoginProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSignIn = async () => {
        setIsLoading(true)
        setError(null)

        try {
            // Initialize Google APIs
            await Promise.all([initializeGoogleAPI(), initializeGIS()])

            // Sign in
            await signInWithGoogle()
            onLoginSuccess()
        } catch (err: any) {
            console.error('Sign in error:', err)
            setError(err.message || 'Failed to sign in with Google')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Welcome Message */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
                        Welcome Back
                    </h1>
                </div>

                <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-12 text-center">
                    {/* App Icon/Logo - CSS Based */}
                    <div className="w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                        <div className="w-full h-full rounded-full border-[6px] border-black flex items-center justify-center bg-white shadow-lg transform hover:scale-105 transition-transform duration-300">
                            <span className="text-5xl font-bold text-black tracking-tighter" style={{ fontFamily: 'Arial, sans-serif' }}>
                                AK
                            </span>
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold text-foreground mb-2">My Notes App</h1>
                    <p className="text-foreground/60 mb-8">
                        Your personal note-taking app with cloud sync
                    </p>

                    {/* Sign In Button */}
                    <button
                        onClick={handleSignIn}
                        disabled={isLoading}
                        className="w-full bg-white border-2 border-border hover:border-primary rounded-xl px-6 py-4 flex items-center justify-center gap-3 transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                <span className="font-medium text-foreground">Signing in...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                <span className="font-medium text-foreground">Sign in with Google</span>
                            </>
                        )}
                    </button>

                    {error && (
                        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                            <p className="text-sm text-destructive">{error}</p>
                        </div>
                    )}

                    {/* Privacy Info */}
                    <div className="mt-8 pt-6 border-t border-border">
                        <p className="text-xs text-foreground/40">
                            Your notes are stored securely in your Google Drive. We never access your data without your permission.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
