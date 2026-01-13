import { useState, useEffect, useRef } from 'react'
import { sendCoachingMessage } from '../services/apiService'
import VoiceController from '../services/VoiceController'

interface CommunicationCoachProps {
    userEmail: string
    onBack: () => void
}

interface Message {
    id: string
    role: 'user' | 'coach'
    content: string
    timestamp: Date
}

export default function CommunicationCoach({ userEmail, onBack }: CommunicationCoachProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [currentTranscription, setCurrentTranscription] = useState('')
    const [interimText, setInterimText] = useState('') // Live words as user speaks
    const [isLoading, setIsLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Use ref to store transcription for sending (avoids stale closure)
    const transcriptionRef = useRef('')

    // Voice state
    const [voiceController] = useState(() => new VoiceController('localhost:8000'))
    const [isVoiceConnected, setIsVoiceConnected] = useState(false)
    const [isListening, setIsListening] = useState(false)

    // TTS
    const [isSpeaking, setIsSpeaking] = useState(false)

    // Update ref whenever state changes
    useEffect(() => {
        transcriptionRef.current = currentTranscription
    }, [currentTranscription])

    // Initialize voice controller
    useEffect(() => {
        // Final transcription - append to confirmed text
        voiceController.setOnTranscription((text) => {
            setCurrentTranscription(prev => {
                const newText = prev + ' ' + text
                transcriptionRef.current = newText.trim()
                return newText
            })
            setInterimText('') // Clear interim when we get final
        })

        // Interim (live) transcription - show words as user speaks
        voiceController.setOnInterim((text) => {
            setInterimText(text)
        })

        voiceController.setOnStatusChange((status) => {
            const recording = status === 'recording' ||
                status.toLowerCase().includes('recording') ||
                status.toLowerCase().includes('started')
            setIsListening(recording)
            if (!recording) {
                setInterimText('') // Clear interim when stopped
            }
        })

        voiceController.setOnError((error) => {
            console.error('Voice error:', error)
        })

        voiceController.connect()
            .then(() => setIsVoiceConnected(true))
            .catch(() => setIsVoiceConnected(false))

        return () => voiceController.disconnect()
    }, [])

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const sendToAI = async (text: string) => {
        if (!text.trim() || isLoading) return

        // Add user message
        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text.trim(),
            timestamp: new Date()
        }
        setMessages(prev => [...prev, userMessage])
        setCurrentTranscription('')
        transcriptionRef.current = ''
        setIsLoading(true)

        try {
            const response = await sendCoachingMessage(text.trim(), userEmail)

            const coachMessage: Message = {
                id: `coach-${Date.now()}`,
                role: 'coach',
                content: response.feedback,
                timestamp: new Date()
            }
            setMessages(prev => [...prev, coachMessage])

            // Speak the response
            speakResponse(response.feedback)

        } catch (error) {
            console.error('AI error:', error)
            const errorMessage: Message = {
                id: `error-${Date.now()}`,
                role: 'coach',
                content: "Sorry, I couldn't process that. Please try again.",
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
        } finally {
            setIsLoading(false)
        }
    }

    const speakResponse = (text: string) => {
        // Use browser's built-in TTS
        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel()

            const utterance = new SpeechSynthesisUtterance(text)
            utterance.rate = 0.9
            utterance.pitch = 1
            utterance.lang = 'en-US'

            utterance.onstart = () => setIsSpeaking(true)
            utterance.onend = () => setIsSpeaking(false)
            utterance.onerror = () => setIsSpeaking(false)

            window.speechSynthesis.speak(utterance)
        }
    }

    const toggleRecording = async () => {
        try {
            if (isListening) {
                // Stop recording and send to AI
                voiceController.stopRecording()

                // Wait a bit longer for mobile to capture final results
                setTimeout(() => {
                    // Get the combined text (transcription + any interim that wasn't finalized)
                    const textToSend = (transcriptionRef.current + ' ' + interimText).trim()

                    if (textToSend) {
                        sendToAI(textToSend)
                    }
                }, 800) // Longer delay for mobile
            } else {
                setCurrentTranscription('') // Clear previous transcription
                setInterimText('')
                transcriptionRef.current = ''
                await voiceController.startRecording()
            }
        } catch (error) {
            console.error('Recording error:', error)
        }
    }

    const stopSpeaking = () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel()
            setIsSpeaking(false)
        }
    }

    return (
        <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="flex-1 text-center">
                    <h1 className="text-white font-semibold">English Conversation</h1>
                    <p className="text-white/50 text-xs">Practice speaking naturally</p>
                </div>
                <div className="w-10" /> {/* Spacer for centering */}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
                <div className="max-w-lg mx-auto space-y-4">
                    {/* Welcome message if no messages */}
                    {messages.length === 0 && !currentTranscription && (
                        <div className="text-center py-16">
                            <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-purple-500/30">
                                <span className="text-5xl">🎙️</span>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Ready to Practice!</h2>
                            <p className="text-white/60 max-w-xs mx-auto">
                                Tap the microphone and start speaking in English. I'll listen and help you improve!
                            </p>
                        </div>
                    )}

                    {/* Chat messages */}
                    {messages.map(message => (
                        <div
                            key={message.id}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[85%] px-4 py-3 rounded-2xl ${message.role === 'user'
                                    ? 'bg-indigo-600 text-white rounded-br-md'
                                    : 'bg-white/10 text-white rounded-bl-md backdrop-blur-sm'
                                    }`}
                            >
                                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                                    {message.content}
                                </p>
                            </div>
                        </div>
                    ))}

                    {/* Current transcription (streaming with live words) */}
                    {(currentTranscription || interimText) && (
                        <div className="flex justify-end">
                            <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-indigo-600/60 text-white rounded-br-md border border-indigo-400/50">
                                <p className="text-[15px] leading-relaxed">
                                    {/* Confirmed text */}
                                    {currentTranscription}
                                    {/* Live typing text (faded) */}
                                    {interimText && (
                                        <span className="text-white/70">{currentTranscription ? ' ' : ''}{interimText}</span>
                                    )}
                                    <span className="inline-block w-1 h-4 bg-white ml-1 animate-pulse" />
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Loading indicator */}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="px-4 py-3 rounded-2xl bg-white/10 rounded-bl-md backdrop-blur-sm">
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
            </div>

            {/* Bottom Controls */}
            <div className="p-6 flex flex-col items-center gap-4">
                {/* Speaking indicator */}
                {isSpeaking && (
                    <button
                        onClick={stopSpeaking}
                        className="px-4 py-2 bg-white/10 text-white/80 rounded-full text-sm flex items-center gap-2 hover:bg-white/20 transition-colors"
                    >
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        Speaking... (tap to stop)
                    </button>
                )}

                {/* Status text */}
                <p className="text-white/50 text-sm">
                    {isListening ? '🎤 Listening...' : isLoading ? '🤔 Thinking...' : 'Tap to speak'}
                </p>

                {/* Big Microphone Button */}
                <button
                    onClick={toggleRecording}
                    disabled={!isVoiceConnected || isLoading}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform active:scale-95 ${isListening
                        ? 'bg-red-500 shadow-2xl shadow-red-500/50 scale-110'
                        : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-purple-500/30 hover:scale-105'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {isListening ? (
                        // Stop icon
                        <div className="w-6 h-6 bg-white rounded" />
                    ) : (
                        // Microphone icon
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    )}
                </button>

                {/* Connection status */}
                {!isVoiceConnected && (
                    <p className="text-red-400 text-xs">Voice not available. Use Chrome or Edge browser.</p>
                )}
            </div>
        </div>
    )
}
