import { useState, useEffect, useRef, useCallback } from 'react'
import VoiceController from '../services/VoiceController'

interface VoiceState {
    isListening: boolean
    isConnected: boolean
    transcript: string
    interimText: string
}

interface UseVoiceRecordingOptions {
    onFinalTranscript?: (text: string) => void
}

/**
 * Custom hook for voice recording functionality
 * Encapsulates all VoiceController logic for cleaner components
 */
export function useVoiceRecording(options: UseVoiceRecordingOptions = {}) {
    const [state, setState] = useState<VoiceState>({
        isListening: false,
        isConnected: false,
        transcript: '',
        interimText: ''
    })

    const voiceController = useRef<VoiceController | null>(null)
    const transcriptRef = useRef('')

    // Initialize voice controller
    useEffect(() => {
        voiceController.current = new VoiceController()

        // Final transcription handler
        voiceController.current.setOnTranscription((text) => {
            transcriptRef.current = (transcriptRef.current + ' ' + text).trim()
            setState(prev => ({
                ...prev,
                transcript: transcriptRef.current,
                interimText: ''
            }))
        })

        // Interim (live) transcription
        voiceController.current.setOnInterim((text) => {
            setState(prev => ({ ...prev, interimText: text }))
        })

        // Status updates
        voiceController.current.setOnStatusChange((status) => {
            const isRecording = status.toLowerCase().includes('recording') ||
                status.toLowerCase().includes('started')
            setState(prev => ({
                ...prev,
                isListening: isRecording,
                interimText: isRecording ? prev.interimText : ''
            }))
        })

        // Error handler
        voiceController.current.setOnError((error) => {
            console.error('Voice error:', error)
        })

        // Connect
        voiceController.current.connect()
            .then(() => setState(prev => ({ ...prev, isConnected: true })))
            .catch(() => setState(prev => ({ ...prev, isConnected: false })))

        return () => {
            voiceController.current?.disconnect()
        }
    }, [])

    // Start recording
    const startRecording = useCallback(async () => {
        transcriptRef.current = ''
        setState(prev => ({ ...prev, transcript: '', interimText: '' }))
        await voiceController.current?.startRecording()
    }, [])

    // Stop recording and get final text
    const stopRecording = useCallback((): Promise<string> => {
        return new Promise((resolve) => {
            voiceController.current?.stopRecording()

            // Wait for final transcription
            setTimeout(() => {
                const finalText = transcriptRef.current.trim()
                if (options.onFinalTranscript && finalText) {
                    options.onFinalTranscript(finalText)
                }
                resolve(finalText)
            }, 500)
        })
    }, [options])

    // Toggle recording
    const toggleRecording = useCallback(async () => {
        if (state.isListening) {
            return stopRecording()
        } else {
            await startRecording()
            return ''
        }
    }, [state.isListening, startRecording, stopRecording])

    // Clear transcript
    const clearTranscript = useCallback(() => {
        transcriptRef.current = ''
        setState(prev => ({ ...prev, transcript: '', interimText: '' }))
    }, [])

    return {
        ...state,
        startRecording,
        stopRecording,
        toggleRecording,
        clearTranscript
    }
}
