import React, { useState, useRef } from 'react';
import { LatencyPanel } from './components/LatencyPanel';
import { AudioRecorder, AudioPlayer } from './services/audioService';
import { ConversationClient } from './services/apiClient';
import { LatencyMetrics, Message } from './types';

function App() {
  const [status, setStatus] = useState<'disconnected' | 'ready' | 'recording' | 'processing'>('disconnected');
  const [messages, setMessages] = useState<Message[]>([]);
  const [metrics, setMetrics] = useState<LatencyMetrics>({
    recording: 0,
    stt: 0,
    llm: 0,
    llm_first_token: 0,
    tts: 0,
    tts_first_byte: 0,
    end_to_end: 0,
  });
  const [isRecording, setIsRecording] = useState(false);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const clientRef = useRef<ConversationClient | null>(null);
  const audioChunksRef = useRef<string[]>([]);
  const recordingStartRef = useRef<number>(0);

  const initialize = async () => {
    try {
      setStatus('ready');

      // Initialize audio player
      if (!playerRef.current) {
        playerRef.current = new AudioPlayer();
        await playerRef.current.initialize();
      }

      // Initialize API client
      if (!clientRef.current) {
        clientRef.current = new ConversationClient();
      }

      addSystemMessage('All systems ready! Click "Start Recording" to speak.');
    } catch (error) {
      console.error('Initialization error:', error);
      addSystemMessage(`Error: ${(error as Error).message}`);
    }
  };

  const startRecording = async () => {
    try {
      if (!recorderRef.current) {
        recorderRef.current = new AudioRecorder();
        await recorderRef.current.initialize((audioData) => {
          audioChunksRef.current.push(audioData);
        });
      }

      audioChunksRef.current = [];
      recordingStartRef.current = Date.now();
      setIsRecording(true);
      setStatus('recording');
    } catch (error) {
      console.error('Recording error:', error);
      addSystemMessage('Microphone access denied. Please allow microphone access.');
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    setStatus('processing');

    const recordingDuration = Date.now() - recordingStartRef.current;
    setMetrics(prev => ({ ...prev, recording: recordingDuration }));

    // Combine all audio chunks
    const combinedAudio = audioChunksRef.current.join('');
    audioChunksRef.current = [];

    if (!clientRef.current) return;

    try {
      let currentAssistantMessage = '';

      for await (const event of clientRef.current.sendAudio(combinedAudio)) {
        switch (event.type) {
          case 'transcript':
            addMessage('user', event.text!);
            break;

          case 'thinking':
            setStatus('processing');
            break;

          case 'gpt_chunk':
            currentAssistantMessage += event.text;
            updateLastAssistantMessage(currentAssistantMessage);
            break;

          case 'gpt_done':
            setStatus('ready');
            break;

          case 'audio':
            if (playerRef.current && event.data) {
              playerRef.current.queueAudio(event.data);
            }
            break;

          case 'latency':
            if (event.stage && event.duration) {
              setMetrics(prev => ({ ...prev, [event.stage!]: event.duration }));
            }
            if (event.breakdown) {
              setMetrics(prev => ({ ...prev, ...event.breakdown }));
            }
            break;

          case 'error':
            console.error('Stream error:', event.message);
            addSystemMessage(`Error: ${event.message}`);
            setStatus('ready');
            break;
        }
      }
    } catch (error) {
      console.error('Processing error:', error);
      addSystemMessage(`Error: ${(error as Error).message}`);
      setStatus('ready');
    }
  };

  const addMessage = (role: 'user' | 'assistant' | 'system', content: string) => {
    setMessages(prev => [...prev, { role, content, timestamp: Date.now() }]);
  };

  const addSystemMessage = (content: string) => {
    addMessage('system', content);
  };

  const updateLastAssistantMessage = (content: string) => {
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant') {
        return [...prev.slice(0, -1), { ...last, content }];
      }
      return [...prev, { role: 'assistant', content, timestamp: Date.now() }];
    });
  };

  const clearConversation = () => {
    setMessages([]);
    setMetrics({
      recording: 0,
      stt: 0,
      llm: 0,
      llm_first_token: 0,
      tts: 0,
      tts_first_byte: 0,
      end_to_end: 0,
    });
    if (clientRef.current) {
      clientRef.current.resetSession();
    }
    addSystemMessage('Conversation cleared');
  };

  const getStatusStyle = () => {
    const styles = {
      disconnected: { background: '#fee', color: '#c33' },
      ready: { background: '#d4edda', color: '#155724' },
      recording: { background: '#d1ecf1', color: '#0c5460' },
      processing: { background: '#e7d4ff', color: '#5a189a' },
    };
    return styles[status];
  };

  const getStatusText = () => {
    const texts = {
      disconnected: 'Disconnected',
      ready: 'Ready - Click "Start Recording" to speak',
      recording: 'Recording... Speak now',
      processing: 'Processing...',
    };
    return texts[status];
  };

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        maxWidth: '900px',
        width: '100%',
        padding: '40px',
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>🎙️ Voice Conversation AI</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px', fontSize: '14px' }}>
          Powered by Cartesia.ai & OpenAI GPT-4o-mini (Hebrew)
        </p>

        <div style={{
          ...getStatusStyle(),
          padding: '15px',
          borderRadius: '10px',
          marginBottom: '20px',
          textAlign: 'center',
          fontWeight: 500,
        }}>
          {getStatusText()}
        </div>

        {metrics.end_to_end > 0 && <LatencyPanel metrics={metrics} />}

        <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', justifyContent: 'center' }}>
          {status === 'disconnected' && (
            <button
              onClick={initialize}
              style={{
                padding: '15px 30px',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🔌 Connect
            </button>
          )}

          {status !== 'disconnected' && (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={status === 'processing'}
              style={{
                padding: '15px 30px',
                background: isRecording ? '#e74c3c' : '#2ecc71',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: status === 'processing' ? 'not-allowed' : 'pointer',
                opacity: status === 'processing' ? 0.5 : 1,
              }}
            >
              {isRecording ? '⏹️ Stop Recording' : '🎤 Start Recording'}
            </button>
          )}

          <button
            onClick={clearConversation}
            style={{
              padding: '15px 30px',
              background: '#e74c3c',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🗑️ Clear
          </button>
        </div>

        <div style={{
          background: '#f8f9fa',
          borderRadius: '10px',
          padding: '20px',
          maxHeight: '400px',
          overflowY: 'auto',
        }}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: '15px',
                padding: '12px 16px',
                borderRadius: '10px',
                background: msg.role === 'user' ? '#667eea' : msg.role === 'assistant' ? '#e8eaf6' : '#fff3cd',
                color: msg.role === 'user' ? 'white' : msg.role === 'assistant' ? '#333' : '#856404',
                marginLeft: msg.role === 'user' ? '20%' : '0',
                marginRight: msg.role === 'assistant' ? '20%' : '0',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '5px', opacity: 0.8 }}>
                {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'AI Assistant' : 'System'}
              </div>
              <div style={{ lineHeight: 1.5 }}>{msg.content}</div>
            </div>
          ))}
        </div>

        <div style={{
          background: '#e7f3ff',
          borderLeft: '4px solid #2196F3',
          padding: '15px',
          borderRadius: '5px',
          fontSize: '14px',
          marginTop: '20px',
          lineHeight: 1.6,
        }}>
          <strong>How to use:</strong><br />
          1. Click "Connect" to establish connection<br />
          2. Click "Start Recording" and speak in Hebrew<br />
          3. Click "Stop Recording" when done<br />
          4. Monitor latency metrics in real-time
        </div>
      </div>
    </div>
  );
}

export default App;
