import Editor from '@monaco-editor/react';
import { useState, useRef, useEffect } from 'react';
import { ws } from './socket';
import TrackSelector from './components/TrackSelector';
import LanguageSelector from './components/LanguageSelector';

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export default function App() {
  const someDefaultValue = "// HELLOOO WORLD";
  const timerRef = useRef(null);

  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const scheduledSourcesRef = useRef([]);

  const [selectedTrack, setSelectedTrack] = useState("dsa");
  const [selectedLanguage, setSelectedLanguage] = useState("python");
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
      try { src.stop(); } catch (_) {}
    });
    scheduledSourcesRef.current = [];
    nextStartTimeRef.current = 0;
  }

  useEffect(() => {
    ws.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        if (packet.type === 'audio') {
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
    };
  }, []);

  function handleTyping(value) {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "code",
          data: value
        }));
      }
    }, 2000);
  }

  async function handleStartInterview() {
    try {
      const ctx = new window.AudioContext({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      await ctx.audioWorklet.addModule("/audio-processor.js");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000 }
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

        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "audio",
            data: arrayBufferToBase64(pcm16.buffer)
          }));
        }
      };

      setIsInterviewActive(true);
    } catch (error) {
      console.error("Failed to start audio engine:", error);
    }
  }


  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px 16px", background: "#222", color: "#fff", display: "flex", alignItems: "center", gap: "12px" }}>
        {!isInterviewActive ? (
          <button onClick={handleStartInterview} style={{ padding: "6px 12px", cursor: "pointer" }}>
            Start Interview
          </button>
        ) : (
          <span style={{ color: "#4ec9b0" }}>● Interview Live</span>
        )}

        <TrackSelector
          selectedTrack={selectedTrack}
          onSelectTrack={setSelectedTrack}
          disabled={isInterviewActive}
        />

        <LanguageSelector 
          currentLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
          disabled={isInterviewActive}
        />

      </div>
      <div style={{ flex: 1 }}>
        <Editor
          height="100%"
          theme="vs-dark"
          language={selectedLanguage} 
          onChange={handleTyping}
        />
      </div>
    </div>
  );
}