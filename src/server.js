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

  // Latency tracking
  let latencyMetrics = {
    recordingStart: null,
    recordingEnd: null,
    sttStart: null,
    sttEnd: null,
    llmStart: null,
    llmFirstToken: null,
    llmEnd: null,
    ttsStart: null,
    ttsFirstAudio: null,
    ttsEnd: null,
    playbackStart: null,
    playbackEnd: null,
  };

  // Initialize Cartesia TTS WebSocket (pre-connect for lowest latency)
  const initCartesiaTts = () => {
    return new Promise((resolve, reject) => {
      const ttsUrl = `wss://api.cartesia.ai/tts/websocket?api_key=${process.env.CARTESIA_API_KEY}&cartesia_version=${process.env.CARTESIA_API_VERSION}`;

      cartesiaTtsWs = new WebSocket(ttsUrl);

      cartesiaTtsWs.on('open', () => {
        console.log('✓ Connected to Cartesia TTS WebSocket');
        resolve();
      });

      cartesiaTtsWs.on('message', (data) => {
        const message = JSON.parse(data.toString());

        // Track first audio chunk
        if (message.type === 'chunk' && message.data) {
          if (!latencyMetrics.ttsFirstAudio) {
            latencyMetrics.ttsFirstAudio = Date.now();
            const ttfb = latencyMetrics.ttsFirstAudio - latencyMetrics.ttsStart;
            console.log(`⚡ TTS First Byte: ${ttfb}ms`);

            clientWs.send(JSON.stringify({
              type: 'latency',
              stage: 'tts_first_byte',
              duration: ttfb,
              timestamp: Date.now(),
            }));
          }

          // Forward audio chunks to client
          clientWs.send(JSON.stringify({
            type: 'audio',
            data: message.data,
            timestamp: Date.now(),
          }));
        }

        if (message.type === 'done') {
          latencyMetrics.ttsEnd = Date.now();
          const ttsDuration = latencyMetrics.ttsEnd - latencyMetrics.ttsStart;
          console.log(`✓ TTS Complete: ${ttsDuration}ms`);

          clientWs.send(JSON.stringify({
            type: 'audio_done',
            timestamp: Date.now(),
          }));

          // Send end-to-end latency
          if (latencyMetrics.recordingStart) {
            const e2e = latencyMetrics.ttsEnd - latencyMetrics.recordingStart;
            console.log(`🎯 END-TO-END LATENCY: ${e2e}ms`);

            clientWs.send(JSON.stringify({
              type: 'latency',
              stage: 'end_to_end',
              duration: e2e,
              timestamp: Date.now(),
              breakdown: {
                recording: latencyMetrics.recordingEnd - latencyMetrics.recordingStart,
                stt: latencyMetrics.sttEnd - latencyMetrics.sttStart,
                llm: latencyMetrics.llmEnd - latencyMetrics.llmStart,
                llm_first_token: latencyMetrics.llmFirstToken - latencyMetrics.llmStart,
                tts: latencyMetrics.ttsEnd - latencyMetrics.ttsStart,
                tts_first_byte: latencyMetrics.ttsFirstAudio - latencyMetrics.ttsStart,
              },
            }));
          }

          // Reset metrics for next turn
          resetLatencyMetrics();
        }

        if (message.type === 'error') {
          console.error('❌ Cartesia TTS error:', message);
          clientWs.send(JSON.stringify({
            type: 'error',
            message: 'TTS error: ' + message.error,
          }));
        }
      });

      cartesiaTtsWs.on('error', (error) => {
        console.error('❌ Cartesia TTS WebSocket error:', error);
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
        console.log('✓ Connected to Cartesia STT WebSocket');
        resolve();
      });

      cartesiaSttWs.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'transcript') {
          latencyMetrics.sttEnd = Date.now();
          const sttDuration = latencyMetrics.sttEnd - latencyMetrics.sttStart;

          const transcript = message.text;
          console.log(`✓ STT Complete: ${sttDuration}ms - "${transcript}"`);

          // Send transcript to client for display
          clientWs.send(JSON.stringify({
            type: 'transcript',
            text: transcript,
            timestamp: Date.now(),
          }));

          // Send STT latency
          clientWs.send(JSON.stringify({
            type: 'latency',
            stage: 'stt',
            duration: sttDuration,
            timestamp: Date.now(),
          }));

          // Process with GPT and get response
          processWithGPT(transcript);
        }

        if (message.type === 'error') {
          console.error('❌ Cartesia STT error:', message);
          clientWs.send(JSON.stringify({
            type: 'error',
            message: 'STT error: ' + message.error,
          }));
        }
      });

      cartesiaSttWs.on('error', (error) => {
        console.error('❌ Cartesia STT WebSocket error:', error);
        reject(error);
      });

      cartesiaSttWs.on('close', () => {
        console.log('Cartesia STT WebSocket closed');
      });
    });
  };

  // Reset latency metrics
  const resetLatencyMetrics = () => {
    latencyMetrics = {
      recordingStart: null,
      recordingEnd: null,
      sttStart: null,
      sttEnd: null,
      llmStart: null,
      llmFirstToken: null,
      llmEnd: null,
      ttsStart: null,
      ttsFirstAudio: null,
      ttsEnd: null,
      playbackStart: null,
      playbackEnd: null,
    };
  };

  // Process user input with GPT-4o-mini
  const processWithGPT = async (userMessage) => {
    try {
      latencyMetrics.llmStart = Date.now();

      // Add user message to conversation history
      conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      // Send thinking status to client
      clientWs.send(JSON.stringify({
        type: 'thinking',
        timestamp: Date.now(),
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
        stream_options: { include_usage: false }, // Optimize for speed
      });

      let fullResponse = '';
      let currentSentence = '';
      let isFirstToken = true;

      // Generate new context ID for this response (for TTS streaming)
      currentContextId = `ctx_${Date.now()}`;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';

        if (content) {
          // Track first token latency
          if (isFirstToken) {
            latencyMetrics.llmFirstToken = Date.now();
            const ttft = latencyMetrics.llmFirstToken - latencyMetrics.llmStart;
            console.log(`⚡ LLM First Token: ${ttft}ms`);

            clientWs.send(JSON.stringify({
              type: 'latency',
              stage: 'llm_first_token',
              duration: ttft,
              timestamp: Date.now(),
            }));

            isFirstToken = false;
          }

          fullResponse += content;
          currentSentence += content;

          // Send to client for display
          clientWs.send(JSON.stringify({
            type: 'gpt_chunk',
            text: content,
            timestamp: Date.now(),
          }));

          // Optimized: Stream to TTS aggressively for low latency
          // Stream on sentence boundaries or significant punctuation
          if (content.match(/[.!?,;:]\s*$/)) {
            if (currentSentence.trim().length > 0) {
              await streamToTTS(currentSentence.trim(), false);
              currentSentence = '';
            }
          }
        }
      }

      latencyMetrics.llmEnd = Date.now();
      const llmDuration = latencyMetrics.llmEnd - latencyMetrics.llmStart;
      console.log(`✓ LLM Complete: ${llmDuration}ms`);

      clientWs.send(JSON.stringify({
        type: 'latency',
        stage: 'llm',
        duration: llmDuration,
        timestamp: Date.now(),
      }));

      // Stream any remaining text
      if (currentSentence.trim()) {
        await streamToTTS(currentSentence.trim(), true);
      } else if (fullResponse.trim()) {
        // If no remaining sentence but we have content, finalize context
        await streamToTTS(' ', true);
      }

      // Add assistant response to history
      conversationHistory.push({
        role: 'assistant',
        content: fullResponse,
      });

      clientWs.send(JSON.stringify({
        type: 'gpt_done',
        timestamp: Date.now(),
      }));

    } catch (error) {
      console.error('❌ GPT processing error:', error);
      clientWs.send(JSON.stringify({
        type: 'error',
        message: 'GPT error: ' + error.message,
      }));
    }
  };

  // Stream text to Cartesia TTS (optimized for low latency)
  const streamToTTS = async (text, isFinal) => {
    if (!cartesiaTtsWs || cartesiaTtsWs.readyState !== WebSocket.OPEN) {
      console.error('❌ TTS WebSocket not ready');
      return;
    }

    // Track TTS start on first chunk
    if (!latencyMetrics.ttsStart) {
      latencyMetrics.ttsStart = Date.now();
    }

    const request = {
      context_id: currentContextId,
      model_id: process.env.CARTESIA_MODEL_ID || 'sonic-multilingual',
      transcript: text,
      continue: !isFinal, // Important: maintain prosody across chunks
      language: 'he', // Explicit language for multilingual model
      voice: {
        mode: 'id',
        id: process.env.CARTESIA_VOICE_ID || '5351f3f8-06be-4963-800d-fce17daab951',
      },
      output_format: {
        container: 'raw',
        encoding: 'pcm_s16le',
        sample_rate: 16000,
      },
    };

    cartesiaTtsWs.send(JSON.stringify(request));
    console.log(`→ TTS: "${text}" (continue: ${!isFinal})`);
  };

  // Handle messages from client
  clientWs.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'init') {
        console.log('🚀 Initializing connections...');

        // Pre-connect both WebSockets for lowest latency
        await Promise.all([initCartesiaTts(), initCartesiaStt()]);

        clientWs.send(JSON.stringify({
          type: 'ready',
          message: 'All connections established',
          timestamp: Date.now(),
        }));

        console.log('✅ All systems ready');
      }

      if (data.type === 'audio_start') {
        // Track recording start
        latencyMetrics.recordingStart = Date.now();
        latencyMetrics.sttStart = Date.now();
        console.log('🎤 Recording started');
      }

      if (data.type === 'audio') {
        // Forward audio to STT immediately
        if (cartesiaSttWs && cartesiaSttWs.readyState === WebSocket.OPEN) {
          const audioBuffer = Buffer.from(data.data, 'base64');
          cartesiaSttWs.send(audioBuffer);
        }
      }

      if (data.type === 'audio_end') {
        latencyMetrics.recordingEnd = Date.now();
        const recordingDuration = latencyMetrics.recordingEnd - latencyMetrics.recordingStart;
        console.log(`🎤 Recording ended: ${recordingDuration}ms`);

        // Signal end of audio stream to STT
        if (cartesiaSttWs && cartesiaSttWs.readyState === WebSocket.OPEN) {
          cartesiaSttWs.send(JSON.stringify({ type: 'end_of_audio' }));
        }

        clientWs.send(JSON.stringify({
          type: 'latency',
          stage: 'recording',
          duration: recordingDuration,
          timestamp: Date.now(),
        }));
      }
    } catch (error) {
      console.error('❌ Error processing client message:', error);
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
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
