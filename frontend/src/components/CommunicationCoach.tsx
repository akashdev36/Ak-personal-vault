import { useState, useEffect, useRef } from 'react'
import { sendCoachingMessage } from '../services/apiService'
import { useVoiceRecording } from '../hooks/useVoiceRecording'

interface CommunicationCoachProps {
    userEmail: string
    onBack: () => void
}

interface Message {
    id: string
    role: 'user' | 'coach'
    content: string
}

export default function CommunicationCoach({ userEmail, onBack }: CommunicationCoachProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Voice recording hook - simplifies all voice logic
    const voice = useVoiceRecording()

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Send message to AI
    const sendToAI = async (text: string) => {
        if (!text.trim() || isLoading) return

        // Add user message
        setMessages(prev => [...prev, {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text.trim()
        }])
        voice.clearTranscript()
        setIsLoading(true)

        try {
            const response = await sendCoachingMessage(text.trim(), userEmail)
            setMessages(prev => [...prev, {
                id: `coach-${Date.now()}`,
                role: 'coach',
                content: response.feedback
            }])
            speakText(response.feedback)
        } catch (error) {
            console.error('AI error:', error)
            setMessages(prev => [...prev, {
                id: `error-${Date.now()}`,
                role: 'coach',
                content: "Sorry, I couldn't process that. Please try again."
            }])
        } finally {
            setIsLoading(false)
        }
    }

    // Text-to-speech
    const speakText = (text: string) => {
        if (!('speechSynthesis' in window)) return
        window.speechSynthesis.cancel()

        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = 0.9
        utterance.lang = 'en-US'
        utterance.onstart = () => setIsSpeaking(true)
        utterance.onend = () => setIsSpeaking(false)
        utterance.onerror = () => setIsSpeaking(false)
        window.speechSynthesis.speak(utterance)
    }

    const stopSpeaking = () => {
        window.speechSynthesis?.cancel()
        setIsSpeaking(false)
    }

    // Handle mic button
    const handleMicClick = async () => {
        if (voice.isListening) {
            const text = await voice.stopRecording()
            if (text) sendToAI(text)
        } else {
            await voice.startRecording()
        }
    }

    const displayText = voice.transcript + (voice.interimText ? ' ' + voice.interimText : '')

    return (
        <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header - Mobile optimized */}
            <header className="safe-top px-4 py-3 flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="p-2 text-white/70 hover:text-white active:bg-white/10 rounded-full transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="flex-1 text-center">
                    <h1 className="text-white font-semibold text-lg">English Conversation</h1>
                    <p className="text-white/50 text-xs">Practice speaking naturally</p>
                </div>
                <div className="w-10" />
            </header>

            {/* Messages Area */}
            <main className="flex-1 overflow-y-auto px-4 py-2">
                <div className="max-w-lg mx-auto space-y-3">
                    {/* Welcome message */}
                    {messages.length === 0 && !displayText && (
                        <div className="text-center py-12">
                            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl shadow-purple-500/30">
                                <span className="text-4xl">🎙️</span>
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Ready to Practice!</h2>
                            <p className="text-white/60 text-sm max-w-xs mx-auto">
                                Tap the microphone and start speaking in English
                            </p>
                        </div>
                    )}

                    {/* Chat messages */}
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] px-4 py-3 rounded-2xl ${msg.role === 'user'
                                    ? 'bg-indigo-600 text-white rounded-br-sm'
                                    : 'bg-white/10 text-white rounded-bl-sm backdrop-blur-sm'
                                }`}>
                                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                    ))}

                    {/* Live transcription */}
                    {displayText && (
                        <div className="flex justify-end">
                            <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-indigo-600/60 text-white rounded-br-sm border border-indigo-400/30">
                                <p className="text-[15px]">
                                    <span>{voice.transcript}</span>
                                    {voice.interimText && (
                                        <span className="text-white/60"> {voice.interimText}</span>
                                    )}
                                    <span className="inline-block w-0.5 h-4 bg-white ml-1 animate-pulse" />
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Loading dots */}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="px-4 py-3 rounded-2xl bg-white/10 rounded-bl-sm">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </main>

            {/* Bottom Controls - Mobile optimized */}
            <footer className="safe-bottom px-6 pb-6 pt-4 flex flex-col items-center gap-3">
                {/* Speaking indicator */}
                {isSpeaking && (
                    <button
                        onClick={stopSpeaking}
                        className="px-4 py-2 bg-white/10 text-white/80 rounded-full text-sm flex items-center gap-2 active:bg-white/20"
                    >
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        Speaking... tap to stop
                    </button>
                )}

                {/* Status */}
                <p className="text-white/50 text-sm">
                    {voice.isListening ? '🎧 Listening...' : isLoading ? '🤖 Thinking...' : 'Tap to speak'}
                </p>

                {/* Mic Button */}
                <button
                    onClick={handleMicClick}
                    disabled={!voice.isConnected || isLoading}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform active:scale-95 ${voice.isListening
                            ? 'bg-red-500 shadow-2xl shadow-red-500/50 scale-110'
                            : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-purple-500/30'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {voice.isListening ? (
                        <div className="w-6 h-6 bg-white rounded" />
                    ) : (
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    )}
                </button>

                {/* Error message */}
                {!voice.isConnected && (
                    <p className="text-red-400 text-xs text-center">
                        Voice not available. Use Chrome or Edge.
                    </p>
                )}
            </footer>
        </div>
    )
}
