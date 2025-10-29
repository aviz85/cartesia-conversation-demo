import 'dotenv/config';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import OpenAI from 'openai';
import WebSocket from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// WebSocket connection handler
wss.on('connection', (clientWs) => {
  console.log('Client connected');

  let cartesiaTtsWs = null;
  let cartesiaSttWs = null;
  let conversationHistory = [];
  let currentContextId = null;

  // Initialize Cartesia TTS WebSocket
  const initCartesiaTts = () => {
    return new Promise((resolve, reject) => {
      cartesiaTtsWs = new WebSocket(
        `wss://api.cartesia.ai/tts/websocket?api_key=${process.env.CARTESIA_API_KEY}&cartesia_version=${process.env.CARTESIA_API_VERSION}`
      );

      cartesiaTtsWs.on('open', () => {
        console.log('Connected to Cartesia TTS');
        resolve();
      });

      cartesiaTtsWs.on('message', (data) => {
        const message = JSON.parse(data.toString());

        // Forward audio chunks to client
        if (message.type === 'chunk' && message.data) {
          clientWs.send(JSON.stringify({
            type: 'audio',
            data: message.data,
          }));
        }

        if (message.type === 'done') {
          clientWs.send(JSON.stringify({ type: 'audio_done' }));
        }

        if (message.type === 'error') {
          console.error('Cartesia TTS error:', message);
          clientWs.send(JSON.stringify({
            type: 'error',
            message: 'TTS error: ' + message.error,
          }));
        }
      });

      cartesiaTtsWs.on('error', (error) => {
        console.error('Cartesia TTS WebSocket error:', error);
        reject(error);
      });

      cartesiaTtsWs.on('close', () => {
        console.log('Cartesia TTS WebSocket closed');
      });
    });
  };

  // Initialize Cartesia STT WebSocket
  const initCartesiaStt = () => {
    return new Promise((resolve, reject) => {
      const sttUrl = `wss://api.cartesia.ai/stt/stream?api_key=${process.env.CARTESIA_API_KEY}&cartesia_version=${process.env.CARTESIA_API_VERSION}&encoding=pcm_s16le&sample_rate=16000&language=he&model=ink-whisper`;

      cartesiaSttWs = new WebSocket(sttUrl);

      cartesiaSttWs.on('open', () => {
        console.log('Connected to Cartesia STT');
        resolve();
      });

      cartesiaSttWs.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'transcript') {
          const transcript = message.text;
          console.log('Transcription:', transcript);

          // Send transcript to client for display
          clientWs.send(JSON.stringify({
            type: 'transcript',
            text: transcript,
          }));

          // Process with GPT and get response
          processWithGPT(transcript);
        }

        if (message.type === 'error') {
          console.error('Cartesia STT error:', message);
          clientWs.send(JSON.stringify({
            type: 'error',
            message: 'STT error: ' + message.error,
          }));
        }
      });

      cartesiaSttWs.on('error', (error) => {
        console.error('Cartesia STT WebSocket error:', error);
        reject(error);
      });

      cartesiaSttWs.on('close', () => {
        console.log('Cartesia STT WebSocket closed');
      });
    });
  };

  // Process user input with GPT-4o-mini
  const processWithGPT = async (userMessage) => {
    try {
      // Add user message to conversation history
      conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      // Send thinking status to client
      clientWs.send(JSON.stringify({
        type: 'thinking',
      }));

      // Create streaming completion
      const stream = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'אתה עוזר AI מועיל המנהל שיחה קולית. שמור על תשובות תמציתיות וטבעיות לדיאלוג מדובר. השב תמיד בעברית.',
          },
          ...conversationHistory,
        ],
        stream: true,
      });

      let fullResponse = '';
      let currentSentence = '';

      // Generate new context ID for this response
      currentContextId = `ctx_${Date.now()}`;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';

        if (content) {
          fullResponse += content;
          currentSentence += content;

          // Send to client for display
          clientWs.send(JSON.stringify({
            type: 'gpt_chunk',
            text: content,
          }));

          // Stream to TTS when we have a complete sentence
          if (content.match(/[.!?]\s*$/)) {
            await streamToTTS(currentSentence.trim(), false);
            currentSentence = '';
          }
        }
      }

      // Stream any remaining text
      if (currentSentence.trim()) {
        await streamToTTS(currentSentence.trim(), true);
      }

      // Add assistant response to history
      conversationHistory.push({
        role: 'assistant',
        content: fullResponse,
      });

      clientWs.send(JSON.stringify({
        type: 'gpt_done',
      }));

    } catch (error) {
      console.error('GPT processing error:', error);
      clientWs.send(JSON.stringify({
        type: 'error',
        message: 'GPT error: ' + error.message,
      }));
    }
  };

  // Stream text to Cartesia TTS
  const streamToTTS = async (text, isFinal) => {
    if (!cartesiaTtsWs || cartesiaTtsWs.readyState !== WebSocket.OPEN) {
      console.error('TTS WebSocket not ready');
      return;
    }

    const request = {
      context_id: currentContextId,
      model_id: process.env.CARTESIA_MODEL_ID || 'sonic-english',
      transcript: text,
      continue: !isFinal,
      voice: {
        mode: 'id',
        id: process.env.CARTESIA_VOICE_ID || 'a0e99841-438c-4a64-b679-ae501e7d6091',
      },
      output_format: {
        container: 'raw',
        encoding: 'pcm_s16le',
        sample_rate: 16000,
      },
    };

    cartesiaTtsWs.send(JSON.stringify(request));
  };

  // Handle messages from client
  clientWs.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'init') {
        // Initialize both Cartesia connections
        await Promise.all([initCartesiaTts(), initCartesiaStt()]);

        clientWs.send(JSON.stringify({
          type: 'ready',
          message: 'All connections established',
        }));
      }

      if (data.type === 'audio') {
        // Forward audio to STT
        if (cartesiaSttWs && cartesiaSttWs.readyState === WebSocket.OPEN) {
          // Convert base64 to binary if needed
          const audioBuffer = Buffer.from(data.data, 'base64');
          cartesiaSttWs.send(audioBuffer);
        }
      }

      if (data.type === 'audio_end') {
        // Signal end of audio stream to STT
        if (cartesiaSttWs && cartesiaSttWs.readyState === WebSocket.OPEN) {
          cartesiaSttWs.send(JSON.stringify({ type: 'end_of_audio' }));
        }
      }
    } catch (error) {
      console.error('Error processing client message:', error);
      clientWs.send(JSON.stringify({
        type: 'error',
        message: error.message,
      }));
    }
  });

  // Cleanup on client disconnect
  clientWs.on('close', () => {
    console.log('Client disconnected');

    if (cartesiaTtsWs) {
      cartesiaTtsWs.close();
    }

    if (cartesiaSttWs) {
      cartesiaSttWs.close();
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
