"""
Voice Routes - WebSocket endpoint for real-time audio streaming and transcription
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import asyncio
import json
import base64
import tempfile
import os

router = APIRouter()


class TTSRequest(BaseModel):
    """Request model for text-to-speech"""
    text: str


@router.websocket("/stream")
async def voice_stream(websocket: WebSocket):
    """
    WebSocket endpoint for real-time voice streaming and transcription
    
    Flow:
    1. Client connects
    2. Client sends: {"action": "start_recording"}
    3. Client sends audio chunks: {"action": "audio_chunk", "audio": "base64..."}
    4. Server transcribes and sends: {"type": "transcription", "text": "..."}
    5. Client sends: {"action": "stop_recording"}
    """
    await websocket.accept()
    
    print(f"🔌 Voice WebSocket connected")
    
    # Audio buffer for accumulating chunks
    audio_chunks = []
    is_recording = False
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            action = message.get("action")
            
            if action == "start_recording":
                print("🎤 Client started recording")
                is_recording = True
                audio_chunks = []
                await websocket.send_json({
                    "type": "status",
                    "message": "Recording started"
                })
            
            elif action == "audio_chunk":
                if is_recording:
                    # Decode base64 audio and add to buffer
                    audio_data = message.get("audio", "")
                    if audio_data:
                        audio_chunks.append(base64.b64decode(audio_data))
                        
                        # Process chunks periodically (every 5 chunks ~= 500ms)
                        if len(audio_chunks) >= 5:
                            await process_audio_chunks(websocket, audio_chunks)
                            audio_chunks = []
            
            elif action == "stop_recording":
                print("🛑 Client stopped recording")
                is_recording = False
                
                # Process any remaining audio
                if audio_chunks:
                    await process_audio_chunks(websocket, audio_chunks)
                    audio_chunks = []
                
                await websocket.send_json({
                    "type": "status",
                    "message": "Recording stopped"
                })
            
            elif action == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        print("🔌 Voice WebSocket disconnected")
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass


async def process_audio_chunks(websocket: WebSocket, chunks: list):
    """
    Process accumulated audio chunks and send transcription
    
    1. Save chunks to temp file
    2. Convert WebM to WAV using pydub
    3. Use faster-whisper to transcribe
    4. Send result back
    """
    try:
        # Combine chunks
        audio_data = b''.join(chunks)
        
        if len(audio_data) < 1000:  # Too small, skip
            return
        
        # Save WebM to temp file
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as f:
            f.write(audio_data)
            webm_path = f.name
        
        wav_path = webm_path.replace('.webm', '.wav')
        
        try:
            # Convert WebM to WAV using pydub
            from pydub import AudioSegment
            
            try:
                audio = AudioSegment.from_file(webm_path, format="webm")
                audio = audio.set_frame_rate(16000).set_channels(1)  # 16kHz mono for Whisper
                audio.export(wav_path, format="wav")
            except Exception as conv_error:
                print(f"⚠️ pydub conversion failed: {conv_error}")
                # Try direct file if conversion fails
                wav_path = webm_path
            
            # Transcribe using faster-whisper
            from faster_whisper import WhisperModel
            
            # Use tiny model for speed (lazy load)
            if not hasattr(process_audio_chunks, 'model'):
                print("🔄 Loading Whisper model (first time)...")
                process_audio_chunks.model = WhisperModel(
                    "tiny",
                    device="cpu",
                    compute_type="int8"
                )
                print("✅ Whisper model loaded!")
            
            model = process_audio_chunks.model
            
            # Transcribe
            segments, info = model.transcribe(
                wav_path,
                language="en",  # Auto-detect: None, English: "en", Tamil: "ta"
                beam_size=1,    # Faster
                vad_filter=True # Filter out silence
            )
            
            # Get text from segments
            text_parts = []
            for segment in segments:
                text_parts.append(segment.text.strip())
            
            full_text = ' '.join(text_parts)
            
            if full_text:
                print(f"📝 Transcribed: {full_text}")
                await websocket.send_json({
                    "type": "transcription",
                    "text": full_text
                })
        
        finally:
            # Cleanup temp files
            try:
                os.unlink(webm_path)
            except:
                pass
            try:
                if wav_path != webm_path:
                    os.unlink(wav_path)
            except:
                pass
                
    except Exception as e:
        print(f"❌ Transcription error: {e}")
        # Don't send error for every chunk, just log it


@router.post("/tts")
async def text_to_speech(request: TTSRequest):
    """
    Convert text to speech and return audio file
    """
    try:
        import pyttsx3
        import tempfile
        
        # Initialize TTS engine
        engine = pyttsx3.init()
        engine.setProperty('rate', 175)
        
        # Save to temp file
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
            temp_path = f.name
        
        engine.save_to_file(request.text, temp_path)
        engine.runAndWait()
        
        # Read and return
        with open(temp_path, 'rb') as f:
            audio_bytes = f.read()
        
        # Cleanup
        os.unlink(temp_path)
        
        return Response(
            content=audio_bytes,
            media_type="audio/wav",
            headers={
                "Content-Disposition": "attachment; filename=speech.wav"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
