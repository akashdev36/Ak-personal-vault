import { useState, useEffect, useRef } from 'react'
import { sendChatMessage, getChatHistory, checkBackendHealth } from '../services/apiService'
import VoiceController from '../services/VoiceController'

interface AiChatProps {
    userEmail: string
    onBack: () => void
}

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    extractedData?: {
        sleep_hours?: number
        water_liters?: number
        gym_session?: boolean
        mood?: string
    }
}

export default function AiChat({ userEmail, onBack }: AiChatProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [inputValue, setInputValue] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Voice state
    const [voiceController] = useState(() => new VoiceController('localhost:8000'))
    const [isVoiceConnected, setIsVoiceConnected] = useState(false)
    const [isListening, setIsListening] = useState(false)
    const [enableTTS, setEnableTTS] = useState(false)

    // Initialize voice controller
    useEffect(() => {
        // Setup voice callbacks
        voiceController.setOnTranscription((text) => {
            setInputValue(prev => prev + ' ' + text)
        })

        voiceController.setOnStatusChange((status) => {
            // Handle recording state
            const recording = status === 'recording' || status.toLowerCase().includes('recording') || status.toLowerCase().includes('started')
            setIsListening(recording)
        })

        voiceController.setOnError((error) => {
            console.error('Voice error:', error)
            alert('Voice error: ' + error)
        })

        // Web Speech API - just check if supported
        voiceController.connect()
            .then(() => {
                console.log('✅ Voice ready')
                setIsVoiceConnected(true)
            })
            .catch((err) => {
                console.error('Voice not supported:', err)
                setIsVoiceConnected(false)
            })

        // Cleanup on unmount
        return () => {
            voiceController.disconnect()
        }
    }, [])

    // Check backend health on mount
    useEffect(() => {
        checkBackendHealth().then(setIsBackendOnline)
        loadChatHistory()
    }, [userEmail])

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const loadChatHistory = async () => {
        try {
            const history = await getChatHistory(userEmail, 50)
            const formattedMessages: Message[] = history.map((item: any) => ({
                id: item.id || `${Date.now()}-${Math.random()}`,
                role: item.role,
                content: item.message,
                timestamp: new Date(item.created_at)
            })).reverse()
            setMessages(formattedMessages)
        } catch (error) {
            console.log('No chat history or backend unavailable')
        }
    }

    const handleSend = async () => {
        if (!inputValue.trim() || isLoading) return

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: inputValue.trim(),
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setInputValue('')
        setIsLoading(true)

        try {
            const response = await sendChatMessage(inputValue.trim(), userEmail)

            const aiMessage: Message = {
                id: `ai-${Date.now()}`,
                role: 'assistant',
                content: response.response,
                timestamp: new Date(response.timestamp),
                extractedData: response.extracted_data
            }

            setMessages(prev => [...prev, aiMessage])

            // Play TTS if enabled (TTS feature coming later)
            // if (enableTTS && response.response) {
            //     voiceController.playTTS(response.response)
            // }
        } catch (error) {
            const errorMessage: Message = {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: '❌ Sorry, I couldn\'t connect to the server. Please make sure the backend is running.',
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
            setIsBackendOnline(false)
        } finally {
            setIsLoading(false)
            inputRef.current?.focus()
        }
    }

    const toggleVoiceRecording = async () => {
        try {
            if (isListening) {
                voiceController.stopRecording()
            } else {
                await voiceController.startRecording()
            }
        } catch (error) {
            console.error('Voice error:', error)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="h-screen flex flex-col bg-[#efeae2]">
            {/* WhatsApp-style Header */}
            <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3 shadow-md">
                <button
                    onClick={onBack}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="w-10 h-10 bg-[#25d366] rounded-full flex items-center justify-center">
                    <span className="text-xl">🤖</span>
                </div>
                <div className="flex-1">
                    <h1 className="font-semibold text-base">AI Assistant</h1>
                    <p className="text-xs text-white/70">
                        {isBackendOnline === null ? 'Connecting...' :
                            isBackendOnline ? 'online' : 'offline'}
                    </p>
                </div>
                {/* TTS Toggle */}
                <button
                    onClick={() => setEnableTTS(!enableTTS)}
                    className="p-2 hover:bg-white/10 rounded-full"
                    title={enableTTS ? 'TTS On' : 'TTS Off'}
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        {enableTTS ? (
                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                        ) : (
                            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                        )}
                    </svg>
                </button>
            </div>

            {/* Backend Offline Warning */}
            {isBackendOnline === false && (
                <div className="bg-yellow-100 px-4 py-2 text-yellow-800 text-sm border-b border-yellow-200">
                    ⚠️ Backend offline. Run: <code className="bg-yellow-200 px-1 rounded">uvicorn app.main:app --reload</code>
                </div>
            )}

            {/* Chat Messages Area - WhatsApp wallpaper style */}
            <div
                className="flex-1 overflow-y-auto px-3 py-4"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4cfc6' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    backgroundColor: '#efeae2'
                }}
            >
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center px-8">
                        <div className="w-20 h-20 bg-[#25d366] rounded-full flex items-center justify-center mb-4">
                            <span className="text-4xl">🤖</span>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">AI Assistant</h2>
                        <p className="text-gray-500 text-sm mb-6">
                            Tell me about your habits, sleep, mood, or gym sessions!
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {['I slept 7 hours', 'Went to gym today', 'Feeling great!', 'Drank 2L water'].map(suggestion => (
                                <button
                                    key={suggestion}
                                    onClick={() => setInputValue(suggestion)}
                                    className="px-3 py-2 bg-white rounded-full text-sm text-gray-700 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-1 max-w-3xl mx-auto">
                    {messages.map((message, index) => {
                        const showTail = index === 0 || messages[index - 1]?.role !== message.role

                        return (
                            <div
                                key={message.id}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`relative max-w-[85%] px-3 py-2 shadow-sm ${message.role === 'user'
                                        ? 'bg-[#dcf8c6] rounded-lg rounded-tr-none'
                                        : 'bg-white rounded-lg rounded-tl-none'
                                        }`}
                                    style={{ marginTop: showTail ? '8px' : '2px' }}
                                >
                                    {/* WhatsApp-style tail */}
                                    {showTail && (
                                        <div
                                            className={`absolute top-0 w-3 h-3 ${message.role === 'user'
                                                ? 'right-0 -mr-2 bg-[#dcf8c6]'
                                                : 'left-0 -ml-2 bg-white'
                                                }`}
                                            style={{
                                                clipPath: message.role === 'user'
                                                    ? 'polygon(0 0, 100% 0, 0 100%)'
                                                    : 'polygon(100% 0, 0 0, 100% 100%)'
                                            }}
                                        />
                                    )}

                                    <p className="text-[15px] text-gray-800 whitespace-pre-wrap break-words">
                                        {message.content}
                                    </p>

                                    {/* Extracted Data Badges */}
                                    {message.extractedData && Object.values(message.extractedData).some(v => v !== null && v !== undefined) && (
                                        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-200">
                                            {message.extractedData.sleep_hours && (
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                                    😴 {message.extractedData.sleep_hours}h
                                                </span>
                                            )}
                                            {message.extractedData.water_liters && (
                                                <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full text-xs font-medium">
                                                    💧 {message.extractedData.water_liters}L
                                                </span>
                                            )}
                                            {message.extractedData.gym_session && (
                                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                    💪 Gym
                                                </span>
                                            )}
                                            {message.extractedData.mood && (
                                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                                    {message.extractedData.mood}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <div className={`flex items-center justify-end gap-1 mt-1 ${message.role === 'user' ? 'text-gray-500' : 'text-gray-400'}`}>
                                        <span className="text-[11px]">{formatTime(message.timestamp)}</span>
                                        {message.role === 'user' && (
                                            <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}

                    {/* Typing Indicator */}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white rounded-lg rounded-tl-none px-4 py-3 shadow-sm">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* WhatsApp-style Input Bar */}
            <div className="bg-[#f0f0f0] px-2 py-2 pb-4 md:pb-2 flex items-center gap-2">
                <button className="p-2 text-gray-500 hover:text-gray-700">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </button>

                <div className="flex-1 relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message"
                        disabled={isLoading}
                        className="w-full px-4 py-2.5 bg-white rounded-full outline-none text-[15px] disabled:opacity-50"
                    />
                </div>

                {/* Voice Input Button */}
                <button
                    onClick={toggleVoiceRecording}
                    disabled={!isVoiceConnected}
                    className={`p-2.5 rounded-full transition-all ${isListening
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={isListening ? 'Stop listening' : 'Start voice input'}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                </button>

                {/* Send Button */}
                <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isLoading}
                    className="p-2.5 bg-[#25d366] text-white rounded-full hover:bg-[#128c7e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                </button>
            </div>
        </div>
    )
}
