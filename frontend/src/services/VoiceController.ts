/**
 * Voice Controller - Uses Web Speech API for browser-based speech recognition
 * 
 * This is the simplest approach:
 * - Works directly in the browser
 * - No backend audio processing needed
 * - Uses Google's speech recognition (Chrome/Edge)
 * - Supports multiple languages including Tamil
 */

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
    isFinal: boolean;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onerror: ((this: SpeechRecognition, ev: Event) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
}

declare var webkitSpeechRecognition: {
    new(): SpeechRecognition;
};

export class VoiceController {
    private recognition: SpeechRecognition | null = null;
    private isRecording: boolean = false;
    private isSupported: boolean = false;

    // Callbacks
    private onTranscriptionCallback: ((text: string) => void) | null = null;
    private onInterimCallback: ((text: string) => void) | null = null;  // For live typing effect
    private onStatusChangeCallback: ((status: string) => void) | null = null;
    private onErrorCallback: ((error: string) => void) | null = null;

    constructor(_backendUrl?: string) {
        // Check if Web Speech API is supported
        this.isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

        if (this.isSupported) {
            this.initRecognition();
        } else {
            console.warn('⚠️ Web Speech API not supported in this browser');
        }
    }

    /**
     * Initialize speech recognition
     */
    private initRecognition(): void {
        // Use webkit prefix for Chrome/Edge
        const SpeechRecognitionAPI = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        this.recognition = new SpeechRecognitionAPI();

        // Guard check for TypeScript
        if (!this.recognition) return;

        const recognition = this.recognition;  // Local reference for closures

        // Configure
        recognition.continuous = true;      // Keep listening
        recognition.interimResults = true;  // Show partial results
        recognition.lang = 'en-US';         // Default language

        // Event handlers
        recognition.onstart = () => {
            console.log('🎤 Speech recognition started');
            this.isRecording = true;
            this.onStatusChangeCallback?.('recording');
        };

        recognition.onend = () => {
            console.log('🛑 Speech recognition ended');
            this.isRecording = false;
            this.onStatusChangeCallback?.('stopped');
        };

        recognition.onerror = (event: any) => {
            console.error('❌ Speech recognition error:', event.error);
            this.isRecording = false;

            // Provide helpful error messages
            let errorMsg = event.error;
            if (event.error === 'not-allowed') {
                errorMsg = 'Microphone permission denied. Please allow microphone access.';
            } else if (event.error === 'no-speech') {
                errorMsg = 'No speech detected. Try speaking louder.';
            } else if (event.error === 'network') {
                errorMsg = 'Network error. Check your internet connection.';
            }

            this.onErrorCallback?.(errorMsg);
            this.onStatusChangeCallback?.('error');
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript;
                } else {
                    interimTranscript += result[0].transcript;
                }
            }

            // Send interim results for live typing effect
            if (interimTranscript) {
                console.log('🔄 Interim:', interimTranscript);
                this.onInterimCallback?.(interimTranscript);
            }

            // Send final results
            if (finalTranscript) {
                console.log('📝 Final:', finalTranscript);
                this.onTranscriptionCallback?.(finalTranscript);
            }
        };
    }

    /**
     * Connect - for compatibility (Web Speech API doesn't need connection)
     */
    async connect(): Promise<void> {
        if (!this.isSupported) {
            throw new Error('Web Speech API not supported. Use Chrome or Edge browser.');
        }
        console.log('✅ Web Speech API ready');
        this.onStatusChangeCallback?.('connected');
    }

    /**
     * Start recording/listening
     */
    async startRecording(): Promise<void> {
        if (!this.isSupported) {
            throw new Error('Speech recognition not supported. Use Chrome or Edge browser.');
        }

        // Reinitialize if needed (React strict mode cleanup)
        if (!this.recognition) {
            this.initRecognition();
        }

        if (!this.recognition) {
            throw new Error('Failed to initialize speech recognition');
        }

        if (this.isRecording) {
            console.warn('⚠️ Already recording');
            return;
        }

        try {
            this.recognition.start();
        } catch (error: any) {
            console.error('Failed to start recording:', error);
            throw error;
        }
    }

    /**
     * Stop recording
     */
    stopRecording(): void {
        if (!this.recognition || !this.isRecording) {
            return;
        }

        try {
            this.recognition.stop();
        } catch (error) {
            console.error('Error stopping recording:', error);
        }
    }

    /**
     * Toggle recording state
     */
    toggleRecording(): void {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    /**
     * Set language for recognition
     * @param lang Language code (e.g., 'en-US', 'ta-IN' for Tamil)
     */
    setLanguage(lang: string): void {
        if (this.recognition) {
            this.recognition.lang = lang;
            console.log(`🌐 Language set to: ${lang}`);
        }
    }

    /**
     * Set callback for transcription events
     */
    setOnTranscription(callback: (text: string) => void): void {
        this.onTranscriptionCallback = callback;
    }

    /**
     * Set callback for interim (real-time) transcription events
     */
    setOnInterim(callback: (text: string) => void): void {
        this.onInterimCallback = callback;
    }

    /**
     * Set callback for status change events
     */
    setOnStatusChange(callback: (status: string) => void): void {
        this.onStatusChangeCallback = callback;
    }

    /**
     * Set callback for error events
     */
    setOnError(callback: (error: string) => void): void {
        this.onErrorCallback = callback;
    }

    /**
     * Check if currently recording
     */
    isCurrentlyRecording(): boolean {
        return this.isRecording;
    }

    /**
     * Check if connected/ready
     */
    isCurrentlyConnected(): boolean {
        return this.isSupported;
    }

    /**
     * Disconnect and cleanup
     */
    disconnect(): void {
        this.stopRecording();
        this.recognition = null;
        console.log('🔌 Disconnected');
    }
}

export default VoiceController;
