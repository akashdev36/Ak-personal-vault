import { GOOGLE_CONFIG } from '../config/google'

declare global {
    interface Window {
        gapi: any
        google: any
    }
}

let gapiInitialized = false
let tokenClient: any = null

export interface GoogleUser {
    email: string
    name: string
    picture: string
    accessToken: string
}

// Initialize Google API
export const initializeGoogleAPI = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (gapiInitialized) {
            // If already initialized, restore token if exists
            const user = getCurrentUser()
            if (user && window.gapi?.client) {
                window.gapi.client.setToken({ access_token: user.accessToken })
            }
            resolve()
            return
        }

        const script = document.createElement('script')
        script.src = 'https://apis.google.com/js/api.js'
        script.onload = () => {
            window.gapi.load('client', async () => {
                try {
                    await window.gapi.client.init({
                        discoveryDocs: GOOGLE_CONFIG.discoveryDocs,
                    })
                    gapiInitialized = true

                    // Restore token if user was logged in before refresh
                    const user = getCurrentUser()
                    if (user) {
                        window.gapi.client.setToken({ access_token: user.accessToken })
                    }

                    resolve()
                } catch (error) {
                    reject(error)
                }
            })
        }
        script.onerror = reject
        document.body.appendChild(script)
    })
}

// Initialize Google Identity Services
export const initializeGIS = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://accounts.google.com/gsi/client'
        script.onload = () => resolve()
        script.onerror = reject
        document.body.appendChild(script)
    })
}

// Sign in with Google
export const signInWithGoogle = (): Promise<GoogleUser> => {
    return new Promise((resolve, reject) => {
        // Ensure GAPI is initialized first
        if (!gapiInitialized) {
            reject(new Error('Google API not initialized'))
            return
        }

        tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CONFIG.clientId,
            scope: GOOGLE_CONFIG.scopes.join(' '),
            callback: async (response: any) => {
                if (response.error) {
                    reject(response.error)
                    return
                }

                try {
                    // Set the access token for GAPI
                    window.gapi.client.setToken({ access_token: response.access_token })

                    // Get user info using the access token
                    const userInfo = await fetch(
                        'https://www.googleapis.com/oauth2/v2/userinfo',
                        {
                            headers: {
                                Authorization: `Bearer ${response.access_token}`,
                            },
                        }
                    )

                    if (!userInfo.ok) {
                        throw new Error(`Failed to get user info: ${userInfo.status}`)
                    }

                    const userData = await userInfo.json()

                    const user: GoogleUser = {
                        email: userData.email,
                        name: userData.name,
                        picture: userData.picture,
                        accessToken: response.access_token,
                    }

                    // Store user and token expiry in localStorage (persists across refreshes)
                    localStorage.setItem('googleUser', JSON.stringify(user))
                    // Tokens typically expire in 1 hour
                    const expiryTime = Date.now() + (3600 * 1000)
                    localStorage.setItem('tokenExpiry', expiryTime.toString())

                    resolve(user)
                } catch (error) {
                    console.error('Error getting user info:', error)
                    reject(error)
                }
            },
        })

        // Request access token with prompt
        tokenClient.requestAccessToken({ prompt: 'consent' })
    })
}

// Refresh token if expired
export const refreshTokenIfNeeded = async (): Promise<boolean> => {
    const expiryTime = localStorage.getItem('tokenExpiry')
    if (!expiryTime) return false

    const timeLeft = parseInt(expiryTime) - Date.now()

    // Refresh if less than 5 minutes remaining
    if (timeLeft < 5 * 60 * 1000) {
        try {
            // Request new token silently
            return new Promise((resolve) => {
                if (!tokenClient) {
                    resolve(false)
                    return
                }

                tokenClient.callback = async (response: any) => {
                    if (response.error) {
                        resolve(false)
                        return
                    }

                    window.gapi.client.setToken({ access_token: response.access_token })

                    const user = getCurrentUser()
                    if (user) {
                        user.accessToken = response.access_token
                        localStorage.setItem('googleUser', JSON.stringify(user))
                        const newExpiry = Date.now() + (3600 * 1000)
                        localStorage.setItem('tokenExpiry', newExpiry.toString())
                    }

                    resolve(true)
                }

                tokenClient.requestAccessToken({ prompt: '' })
            })
        } catch (error) {
            console.error('Error refreshing token:', error)
            return false
        }
    }

    return true
}

// Sign out
export const signOut = (): void => {
    // Clear localStorage first
    localStorage.removeItem('googleUser')
    localStorage.removeItem('tokenExpiry')

    // Revoke token if gapi is available
    if (window.gapi && window.gapi.client) {
        const token = window.gapi.client.getToken()
        if (token && window.google && window.google.accounts) {
            window.google.accounts.oauth2.revoke(token.access_token, () => {
                window.gapi.client.setToken(null)
            })
        } else if (window.gapi.client.setToken) {
            window.gapi.client.setToken(null)
        }
    }
}

// Get current user
export const getCurrentUser = (): GoogleUser | null => {
    const userStr = localStorage.getItem('googleUser')
    if (!userStr) return null
    return JSON.parse(userStr)
}

// Check if user is authenticated (persistent - like Instagram)
// User stays logged in until they manually sign out
export const isAuthenticated = (): boolean => {
    const user = getCurrentUser()
    return user !== null
}

// Check if token needs refresh (for API calls)
export const isTokenExpired = (): boolean => {
    const expiryStr = localStorage.getItem('tokenExpiry')
    if (!expiryStr) return true
    return Date.now() >= parseInt(expiryStr)
}

// Silent token refresh - call on app startup
export const silentTokenRefresh = async (): Promise<boolean> => {
    const user = getCurrentUser()
    if (!user) return false

    // If token not expired, just restore it
    if (!isTokenExpired()) {
        try {
            await initializeGoogleAPI()
            await initializeGIS()
            if (window.gapi?.client) {
                window.gapi.client.setToken({ access_token: user.accessToken })
            }
            return true
        } catch {
            return false
        }
    }

    // Token expired - try silent refresh
    try {
        await initializeGoogleAPI()
        await initializeGIS()

        return new Promise((resolve) => {
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CONFIG.clientId,
                scope: GOOGLE_CONFIG.scopes.join(' '),
                callback: async (response: any) => {
                    if (response.error) {
                        console.log('Silent refresh failed, user needs to re-login')
                        resolve(false)
                        return
                    }

                    // Update token
                    window.gapi.client.setToken({ access_token: response.access_token })
                    user.accessToken = response.access_token
                    localStorage.setItem('googleUser', JSON.stringify(user))
                    localStorage.setItem('tokenExpiry', (Date.now() + 3600000).toString())
                    console.log('✅ Token refreshed silently')
                    resolve(true)
                },
            })

            // Request token without prompt (silent)
            client.requestAccessToken({ prompt: '' })
        })
    } catch (error) {
        console.error('Silent refresh error:', error)
        return false
    }
}
