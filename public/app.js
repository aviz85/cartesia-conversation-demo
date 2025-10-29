let ws = null;
let audioContext = null;
let mediaStream = null;
let audioWorkletNode = null;
let isRecording = false;
let audioQueue = [];
let isPlaying = false;

// UI Elements
const statusEl = document.getElementById('status');
const conversationEl = document.getElementById('conversation');
const connectBtn = document.getElementById('connectBtn');
const recordBtn = document.getElementById('recordBtn');
const visualizerBars = document.querySelectorAll('.bar');

// Update status display
function updateStatus(status, className) {
  statusEl.textContent = status;
  statusEl.className = `status ${className}`;
}

// Add message to conversation
function addMessage(role, text) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${role}`;

  const labelEl = document.createElement('div');
  labelEl.className = 'label';
  labelEl.textContent = role === 'user' ? 'You' : role === 'assistant' ? 'AI Assistant' : 'System';

  const textEl = document.createElement('div');
  textEl.className = 'text';
  textEl.textContent = text;

  messageEl.appendChild(labelEl);
  messageEl.appendChild(textEl);
  conversationEl.appendChild(messageEl);
  conversationEl.scrollTop = conversationEl.scrollHeight;

  return textEl;
}

// Clear conversation
function clearConversation() {
  conversationEl.innerHTML = '<div class="message system"><div class="text">Conversation cleared</div></div>';
}

// Audio visualizer
function updateVisualizer(dataArray) {
  if (!dataArray) {
    visualizerBars.forEach(bar => {
      bar.style.height = '10px';
    });
    return;
  }

  const step = Math.floor(dataArray.length / visualizerBars.length);
  visualizerBars.forEach((bar, i) => {
    const value = dataArray[i * step] || 0;
    const height = Math.max(10, (value / 255) * 50);
    bar.style.height = `${height}px`;
  });
}

// Connect to server
async function connect() {
  try {
    updateStatus('Connecting...', 'connecting');
    connectBtn.disabled = true;

    // Initialize WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
      console.log('Connected to server');
      ws.send(JSON.stringify({ type: 'init' }));
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'ready':
          updateStatus('Ready - Click "Start Recording" to speak', 'ready');
          recordBtn.disabled = false;
          addMessage('system', 'All systems ready! You can start talking now.');
          break;

        case 'transcript':
          console.log('Transcript received:', data.text);
          addMessage('user', data.text);
          break;

        case 'thinking':
          updateStatus('AI is thinking...', 'thinking');
          break;

        case 'gpt_chunk':
          // Find or create assistant message
          let lastMessage = conversationEl.lastElementChild;
          if (!lastMessage || !lastMessage.classList.contains('assistant')) {
            const textEl = addMessage('assistant', '');
            lastMessage = conversationEl.lastElementChild;
          }
          const textEl = lastMessage.querySelector('.text');
          textEl.textContent += data.text;
          conversationEl.scrollTop = conversationEl.scrollHeight;
          break;

        case 'gpt_done':
          updateStatus('Ready - Click "Start Recording" to speak', 'ready');
          break;

        case 'audio':
          // Queue audio for playback
          audioQueue.push(data.data);
          if (!isPlaying) {
            playAudioQueue();
          }
          break;

        case 'audio_done':
          console.log('Audio stream complete');
          break;

        case 'error':
          console.error('Server error:', data.message);
          addMessage('system', `Error: ${data.message}`);
          updateStatus('Error - Check console', 'disconnected');
          break;
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      updateStatus('Connection error', 'disconnected');
      connectBtn.disabled = false;
    };

    ws.onclose = () => {
      console.log('Disconnected from server');
      updateStatus('Disconnected', 'disconnected');
      connectBtn.disabled = false;
      recordBtn.disabled = true;
    };

  } catch (error) {
    console.error('Connection error:', error);
    updateStatus('Connection failed', 'disconnected');
    connectBtn.disabled = false;
  }
}

// Initialize audio context and recording
async function initAudio() {
  if (audioContext) return;

  audioContext = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: 16000,
  });

  // Get microphone access
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });

  const source = audioContext.createMediaStreamSource(mediaStream);

  // Create audio processor
  await audioContext.audioWorklet.addModule(createAudioProcessorBlob());
  audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor');

  audioWorkletNode.port.onmessage = (event) => {
    if (isRecording && ws && ws.readyState === WebSocket.OPEN) {
      // Convert Float32Array to Int16Array (PCM S16LE)
      const float32Data = event.data;
      const int16Data = new Int16Array(float32Data.length);

      for (let i = 0; i < float32Data.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Data[i]));
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Send as base64
      const base64 = arrayBufferToBase64(int16Data.buffer);
      ws.send(JSON.stringify({
        type: 'audio',
        data: base64,
      }));

      // Update visualizer
      const dataArray = new Uint8Array(float32Data.length);
      for (let i = 0; i < float32Data.length; i++) {
        dataArray[i] = (float32Data[i] + 1) * 127.5;
      }
      updateVisualizer(dataArray);
    }
  };

  source.connect(audioWorkletNode);
  audioWorkletNode.connect(audioContext.destination);
}

// Create audio processor worklet
function createAudioProcessorBlob() {
  const processorCode = `
    class AudioProcessor extends AudioWorkletProcessor {
      process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length > 0) {
          this.port.postMessage(input[0]);
        }
        return true;
      }
    }
    registerProcessor('audio-processor', AudioProcessor);
  `;

  const blob = new Blob([processorCode], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}

// Toggle recording
async function toggleRecording() {
  if (!isRecording) {
    try {
      await initAudio();
      isRecording = true;
      updateStatus('Recording... Speak now', 'recording');
      recordBtn.innerHTML = '<span class="icon">⏹️</span> Stop Recording';
      recordBtn.classList.remove('btn-success');
      recordBtn.classList.add('btn-danger');
    } catch (error) {
      console.error('Failed to start recording:', error);
      addMessage('system', 'Microphone access denied. Please allow microphone access and try again.');
    }
  } else {
    isRecording = false;
    updateStatus('Processing...', 'thinking');
    recordBtn.innerHTML = '<span class="icon">🎤</span> Start Recording';
    recordBtn.classList.remove('btn-danger');
    recordBtn.classList.add('btn-success');
    updateVisualizer(null);

    // Signal end of audio
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'audio_end' }));
    }
  }
}

// Play audio queue
async function playAudioQueue() {
  if (audioQueue.length === 0) {
    isPlaying = false;
    return;
  }

  isPlaying = true;

  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000,
    });
  }

  while (audioQueue.length > 0) {
    const base64Audio = audioQueue.shift();

    try {
      // Decode base64 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert PCM S16LE to Float32
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);

      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
      }

      // Create audio buffer
      const audioBuffer = audioContext.createBuffer(1, float32Array.length, 16000);
      audioBuffer.getChannelData(0).set(float32Array);

      // Play audio
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      await new Promise((resolve) => {
        source.onended = resolve;
        source.start();
      });

    } catch (error) {
      console.error('Audio playback error:', error);
    }
  }

  isPlaying = false;
}

// Helper: Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Auto-connect on load (optional)
// window.addEventListener('load', connect);
