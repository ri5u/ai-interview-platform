import Editor from '@monaco-editor/react';
import { useState, useRef, useEffect } from 'react';
import TrackSelector from './components/TrackSelector';
import LanguageSelector from './components/LanguageSelector';
import AuthDialog from './components/AuthDialog';

import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || '';
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.host}/ws`;

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export default function App() {
  const timerRef = useRef(null);
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const scheduledSourcesRef = useRef([]);


  const [user, setUser] = useState(null);
  const [setupStep, setSetupStep] = useState('track');
  const [selectedTrack, setSelectedTrack] = useState("dsa");
  const [selectedLanguage, setSelectedLanguage] = useState("cpp");
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSocketOpen, setIsSocketOpen] = useState(false);

  //hydrating the page on refresh
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
          method: 'GET',
          credentials: 'include',
        });

        const userData = await response.json();
        if (!response.ok) {
          throw new Error('No existing session found');
        }
        setUser(userData.user);
      } catch (err) {
        console.error(err);
      } finally {
        setIsCheckingAuth(false);
      }
    }
    checkAuth();
  }, [])


  function playAudio(arrayBuffer) {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const pcmData = new Int16Array(arrayBuffer);
    const float32Data = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32Data[i] = pcmData[i] / 32768.0;
    }

    const buffer = ctx.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    nextStartTimeRef.current = Math.max(now, nextStartTimeRef.current);
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;

    scheduledSourcesRef.current.push(source);
    source.onended = () => {
      const idx = scheduledSourcesRef.current.indexOf(source);
      if (idx > -1) scheduledSourcesRef.current.splice(idx, 1);
    };
  }

  function stopAudioPlayback() {
    scheduledSourcesRef.current.forEach((src) => {
      try { src.stop(); } catch (_) { }
    });
    scheduledSourcesRef.current = [];
    nextStartTimeRef.current = 0;
  }

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    wsRef.current = socket;
    socket.onopen = () => {
      setIsSocketOpen(true);
    };

    socket.onclose = () => {
      setIsSocketOpen(false);
    };
    if (!user) {
      socket.close();
      return;
    }



    socket.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        if (packet.type === 'audio') {
          //atob() decodes the data from base64 encoded format to binary string
          const binaryString = atob(packet.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          playAudio(bytes.buffer);
        } else if (packet.type === 'interrupted') {
          stopAudioPlayback();
        }
      } catch (err) {
        console.error("Socket parse error:", err);
      }
    };

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      socket.close();
      wsRef.current = null;
      clearTimeout(timerRef.current);
    };
  }, [user]);

  function handleTyping(value) {
    if (!isInterviewActive) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (wsRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current?.send(JSON.stringify({
          type: "code",
          data: value,
          language: selectedLanguage
        }));
      }
    }, 2000);
  }

  async function handleStartInterview() {
    try {
      // 1. Set up audio hardware & request mic permissions FIRST
      const ctx = new window.AudioContext({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      await ctx.audioWorklet.addModule("/audio-processor.js");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true }
      });
      streamRef.current = stream;

      const micSource = ctx.createMediaStreamSource(stream);
      const micWorklet = new AudioWorkletNode(ctx, "audio-processor");
      micSource.connect(micWorklet);

      micWorklet.port.onmessage = (event) => {
        const float32Chunk = event.data;
        const pcm16 = new Int16Array(float32Chunk.length);
        for (let i = 0; i < float32Chunk.length; i++) {
          const s = Math.max(-1, Math.min(1, float32Chunk[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "audio",
            data: arrayBufferToBase64(pcm16.buffer)
          }));
        }
      };

      // 2. Only initialize the Gemini Live session ONCE mic permissions succeed
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "init",
          mode: selectedTrack,
          language: selectedLanguage
        }));
      }

      setIsInterviewActive(true);
    } catch (error) {
      console.error("Failed to start audio engine:", error);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    }
  }

  function handleStopInteview() {
    // Clean up any active audio stream if they log out mid-session
    stopAudioPlayback();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current?.send(JSON.stringify({
        type: 'stop'
      }))
    }


    //clear the timeout for the debounced text from the editor
    clearTimeout(timerRef.current);
    timerRef.current = null;

    setIsInterviewActive(false);
  }

  async function handleLogout() {
    try {
      const response = await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include"
      })
      if (!response.ok) throw new Error("Logout failed");
      handleStopInteview();
      setUser(null); // Re-triggers {!user && <AuthDialog ... />}
      setSetupStep('track');
    } catch (err) {
      console.error(err);
    }
  }
  return (
    <div className="stage-shell">
      {/* Step 1: Authentication Gate */}
      {!isCheckingAuth && !user && (
        <AuthDialog
          onAuthSuccess={(userData) => {
            setUser(userData);
            setSetupStep('track');
          }}
        />
      )}

      {/* Step 2: Track Selection Modal */}
      {!isCheckingAuth && user && setupStep === 'track' && (
        <TrackSelector
          onSelectTrack={(track) => {
            setSelectedTrack(track);
            setSetupStep('language');
          }}
        />
      )}

      {/* Step 3: Language Selection Modal */}
      {!isCheckingAuth && user && setupStep === 'language' && (
        <LanguageSelector
          onLanguageChange={(lang) => {
            setSelectedLanguage(lang);
            setSetupStep('ready');
          }}
        />
      )}

      {/* Step 4: Centered "Zoom-Style" Editor Stage */}
      <main className="editor-stage">
        <Editor
          height="100%"
          theme="vs-dark"
          language={selectedLanguage}
          onChange={handleTyping}
        />
      </main>

      {/* Bottom Control Dock */}
      <footer className="bottom-dock">
        <div className="dock-left">
          <span className="meta-chip">{selectedTrack.toUpperCase()}</span>
          <span className="meta-chip">{selectedLanguage}</span>
        </div>

        <div className="dock-center">
          {!isInterviewActive ? (
            isSocketOpen ? (
              <>
                <button onClick={handleStartInterview} className="btn btn-primary">
                  Start Interview
                </button>
                <span className="status-text">Ready when you are</span>
              </>
            ) : (
              user && <span className="status-text">Connecting to interview server...</span>
            )
          ) : (
            <>
              <button onClick={handleStopInteview} className="btn btn-danger">
                Stop Interview
              </button>
              <span className="live-badge">
                <span className="live-dot" />
                Interview Live • Listening
              </span>
            </>
          )}
        </div>

        <div className="dock-right">
          {user && (
            <>
              <span className="status-text">{user.username}</span>
              <button type="button" onClick={handleLogout} className="btn btn-ghost">
                Logout
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}