"""
Voice Service - Real-time Speech-to-Text and Text-to-Speech

Uses RealtimeSTT with faster-whisper for accurate STT
Uses pyttsx3 for local TTS
"""

from RealtimeSTT import AudioToTextRecorder
import pyttsx3
import threading
import io
import wave
from typing import Callable, Optional


class VoiceService:
    """
    Provides real-time speech-to-text and text-to-speech capabilities
    """
    
    def __init__(self):
        """Initialize STT and TTS engines"""
        self.recorder: Optional[AudioToTextRecorder] = None
        self.tts_engine: Optional[pyttsx3.Engine] = None
        self.is_listening = False
        self._init_lock = threading.Lock()
    
    def _init_stt(self):
        """Initialize RealtimeSTT recorder (lazy loading)"""
        if self.recorder is None:
            with self._init_lock:
                if self.recorder is None:  # Double-check locking
                    print("🎙️ Initializing RealtimeSTT...")
                    self.recorder = AudioToTextRecorder(
                        model="tiny",  # Start with tiny model (~40MB)
                        language="en",
                        device="cpu",  # Use CPU by default, can be changed to "cuda"
                        compute_type="int8",  # Optimize for CPU
                        spinner=False,  # Disable spinner for server
                        use_microphone=True,
                        enable_realtime_transcription=True,
                        realtime_processing_pause=0.1,
                        silero_sensitivity=0.4,
                    )
                    print("✅ RealtimeSTT initialized!")
    
    def _init_tts(self):
        """Initialize pyttsx3 TTS engine (lazy loading)"""
        if self.tts_engine is None:
            with self._init_lock:
                if self.tts_engine is None:  # Double-check locking
                    print("🔊 Initializing TTS engine...")
                    self.tts_engine = pyttsx3.init()
                    # Configure TTS properties
                    self.tts_engine.setProperty('rate', 175)  # Speed (150-200)
                    self.tts_engine.setProperty('volume', 0.9)  # Volume (0.0-1.0)
                    print("✅ TTS engine initialized!")
    
    def transcribe_audio(self, text_callback: Callable[[str], None]) -> None:
        """
        Start listening and transcribe audio in real-time
        
        Args:
            text_callback: Function to call with transcribed text
        """
        self._init_stt()
        
        if self.is_listening:
            print("⚠️ Already listening!")
            return
        
        self.is_listening = True
        print("🎤 Listening...")
        
        try:
            # Start listening with callback
            while self.is_listening:
                text = self.recorder.text()
                if text and text.strip():
                    print(f"📝 Transcribed: {text}")
                    text_callback(text)
        except Exception as e:
            print(f"❌ STT Error: {e}")
            raise
        finally:
            self.is_listening = False
    
    def stop_listening(self):
        """Stop listening for audio input"""
        self.is_listening = False
        if self.recorder:
            self.recorder.stop()
        print("🛑 Stopped listening")
    
    def text_to_speech(self, text: str) -> bytes:
        """
        Convert text to speech and return audio bytes
        
        Args:
            text: Text to convert to speech
            
        Returns:
            Audio bytes in WAV format
        """
        self._init_tts()
        
        print(f"🔊 Speaking: {text[:50]}...")
        
        # Save to in-memory buffer
        audio_buffer = io.BytesIO()
        
        # Create a temporary file to capture audio
        temp_file = "temp_tts.wav"
        self.tts_engine.save_to_file(text, temp_file)
        self.tts_engine.runAndWait()
        
        # Read the file and return bytes
        try:
            with open(temp_file, 'rb') as f:
                audio_bytes = f.read()
            return audio_bytes
        except Exception as e:
            print(f"❌ TTS Error: {e}")
            raise
    
    def speak_async(self, text: str):
        """
        Speak text asynchronously (non-blocking)
        
        Args:
            text: Text to speak
        """
        def _speak():
            self._init_tts()
            self.tts_engine.say(text)
            self.tts_engine.runAndWait()
        
        thread = threading.Thread(target=_speak, daemon=True)
        thread.start()
    
    def get_available_voices(self) -> list:
        """Get list of available TTS voices"""
        self._init_tts()
        voices = self.tts_engine.getProperty('voices')
        return [{"id": v.id, "name": v.name, "lang": v.languages} for v in voices]
    
    def set_voice(self, voice_id: str):
        """Set TTS voice by ID"""
        self._init_tts()
        self.tts_engine.setProperty('voice', voice_id)
    
    def cleanup(self):
        """Clean up resources"""
        if self.recorder:
            self.recorder.shutdown()
        if self.tts_engine:
            self.tts_engine.stop()


# Singleton instance
_voice_service: Optional[VoiceService] = None


def get_voice_service() -> VoiceService:
    """Get the singleton voice service instance"""
    global _voice_service
    if _voice_service is None:
        _voice_service = VoiceService()
    return _voice_service
