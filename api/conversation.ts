import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OpenAI } from 'openai';
import WebSocket from 'ws';

// Edge runtime configuration
export const config = {
  runtime: 'edge',
};

interface ConversationRequest {
  audio: string;
  sessionId: string;
  model?: string;
}

interface LatencyMetrics {
  recordingStart: number;
  recordingEnd: number;
  sttStart: number;
  sttEnd: number;
  llmStart: number;
  llmFirstToken: number;
  llmEnd: number;
  ttsStart: number;
  ttsFirstAudio: number;
  ttsEnd: number;
}

// Session storage (in production, use Redis or similar)
const sessions = new Map<string, any[]>();

export default async function handler(req: Request) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json() as ConversationRequest;
    const { audio, sessionId, model } = body;

    // Initialize latency tracking
    const latency: Partial<LatencyMetrics> = {
      recordingEnd: Date.now(),
      sttStart: Date.now(),
    };

    // Create streaming response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Helper to send SSE events
    const sendEvent = async (type: string, data: any) => {
      const event = `data: ${JSON.stringify({ type, ...data, timestamp: Date.now() })}\n\n`;
      await writer.write(encoder.encode(event));
    };

    // Start processing in background
    processConversation(audio, sessionId, model, latency, sendEvent).finally(() => {
      writer.close();
    });

    // Return streaming response
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function processConversation(
  audioBase64: string,
  sessionId: string,
  model: string | undefined,
  latency: Partial<LatencyMetrics>,
  sendEvent: (type: string, data: any) => Promise<void>
) {
  try {
    // Get or create conversation history
    let history = sessions.get(sessionId) || [];

    // Step 1: Speech-to-Text with Cartesia
    const transcript = await transcribeAudio(audioBase64, latency, sendEvent);

    if (!transcript) {
      await sendEvent('error', { message: 'Failed to transcribe audio' });
      return;
    }

    // Add user message to history
    history.push({ role: 'user', content: transcript });

    // Step 2: Generate LLM response with streaming
    const response = await generateResponse(history, model, latency, sendEvent);

    // Add assistant response to history
    history.push({ role: 'assistant', content: response });
    sessions.set(sessionId, history);

    // Send completion
    await sendEvent('gpt_done', {});
  } catch (error) {
    console.error('Conversation processing error:', error);
    await sendEvent('error', { message: (error as Error).message });
  }
}

async function transcribeAudio(
  audioBase64: string,
  latency: Partial<LatencyMetrics>,
  sendEvent: (type: string, data: any) => Promise<void>
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.CARTESIA_API_KEY;
    const apiVersion = process.env.CARTESIA_API_VERSION || '2025-04-16';

    const sttUrl = `wss://api.cartesia.ai/stt/stream?api_key=${apiKey}&cartesia_version=${apiVersion}&encoding=pcm_s16le&sample_rate=16000&language=he&model=ink-whisper`;

    const ws = new WebSocket(sttUrl);
    let transcript = '';

    ws.on('open', () => {
      // Send audio data
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      ws.send(audioBuffer);
      ws.send(JSON.stringify({ type: 'end_of_audio' }));
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'transcript') {
          latency.sttEnd = Date.now();
          transcript = message.text;

          const sttDuration = latency.sttEnd - latency.sttStart!;
          await sendEvent('transcript', { text: transcript });
          await sendEvent('latency', { stage: 'stt', duration: sttDuration });

          ws.close();
          resolve(transcript);
        }

        if (message.type === 'error') {
          console.error('STT error:', message);
          ws.close();
          reject(new Error(message.error));
        }
      } catch (error) {
        console.error('Error parsing STT message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('STT WebSocket error:', error);
      reject(error);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (ws.readyState !== WebSocket.CLOSED) {
        ws.close();
        reject(new Error('STT timeout'));
      }
    }, 30000);
  });
}

async function generateResponse(
  history: any[],
  model: string | undefined,
  latency: Partial<LatencyMetrics>,
  sendEvent: (type: string, data: any) => Promise<void>
): Promise<string> {
  latency.llmStart = Date.now();

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  await sendEvent('thinking', {});

  const stream = await openai.chat.completions.create({
    model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'אתה עוזר AI מועיל המנהל שיחה קולית. שמור על תשובות תמציתיות וטבעיות לדיאלוג מדובר. השב תמיד בעברית.',
      },
      ...history,
    ],
    stream: true,
    stream_options: { include_usage: false },
  });

  let fullResponse = '';
  let currentSentence = '';
  let isFirstToken = true;

  const contextId = `ctx_${Date.now()}`;
  latency.ttsStart = Date.now();

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';

    if (content) {
      if (isFirstToken) {
        latency.llmFirstToken = Date.now();
        const ttft = latency.llmFirstToken - latency.llmStart!;
        await sendEvent('latency', { stage: 'llm_first_token', duration: ttft });
        isFirstToken = false;
      }

      fullResponse += content;
      currentSentence += content;

      await sendEvent('gpt_chunk', { text: content });

      // Stream to TTS on sentence boundaries
      if (content.match(/[.!?,;:]\s*$/)) {
        if (currentSentence.trim()) {
          await synthesizeSpeech(currentSentence.trim(), contextId, false, latency, sendEvent);
          currentSentence = '';
        }
      }
    }
  }

  latency.llmEnd = Date.now();
  const llmDuration = latency.llmEnd - latency.llmStart!;
  await sendEvent('latency', { stage: 'llm', duration: llmDuration });

  // Send any remaining text
  if (currentSentence.trim()) {
    await synthesizeSpeech(currentSentence.trim(), contextId, true, latency, sendEvent);
  }

  return fullResponse;
}

async function synthesizeSpeech(
  text: string,
  contextId: string,
  isFinal: boolean,
  latency: Partial<LatencyMetrics>,
  sendEvent: (type: string, data: any) => Promise<void>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.CARTESIA_API_KEY;
    const apiVersion = process.env.CARTESIA_API_VERSION || '2025-04-16';

    const ttsUrl = `wss://api.cartesia.ai/tts/websocket?api_key=${apiKey}&cartesia_version=${apiVersion}`;
    const ws = new WebSocket(ttsUrl);

    ws.on('open', () => {
      const request = {
        context_id: contextId,
        model_id: process.env.CARTESIA_MODEL_ID || 'sonic-multilingual',
        transcript: text,
        continue: !isFinal,
        language: 'he',
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

      ws.send(JSON.stringify(request));
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'chunk' && message.data) {
          if (!latency.ttsFirstAudio) {
            latency.ttsFirstAudio = Date.now();
            const ttfb = latency.ttsFirstAudio - latency.ttsStart!;
            await sendEvent('latency', { stage: 'tts_first_byte', duration: ttfb });
          }

          await sendEvent('audio', { data: message.data });
        }

        if (message.type === 'done') {
          latency.ttsEnd = Date.now();
          const ttsDuration = latency.ttsEnd - latency.ttsStart!;
          await sendEvent('latency', { stage: 'tts', duration: ttsDuration });
          await sendEvent('audio_done', {});

          // Calculate end-to-end latency
          if (latency.recordingEnd && latency.ttsEnd) {
            const e2e = latency.ttsEnd - latency.recordingEnd;
            await sendEvent('latency', {
              stage: 'end_to_end',
              duration: e2e,
              breakdown: {
                stt: latency.sttEnd! - latency.sttStart!,
                llm: latency.llmEnd! - latency.llmStart!,
                llm_first_token: latency.llmFirstToken! - latency.llmStart!,
                tts: latency.ttsEnd! - latency.ttsStart!,
                tts_first_byte: latency.ttsFirstAudio! - latency.ttsStart!,
              },
            });
          }

          ws.close();
          resolve();
        }

        if (message.type === 'error') {
          console.error('TTS error:', message);
          ws.close();
          reject(new Error(message.error));
        }
      } catch (error) {
        console.error('Error parsing TTS message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('TTS WebSocket error:', error);
      reject(error);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (ws.readyState !== WebSocket.CLOSED) {
        ws.close();
        reject(new Error('TTS timeout'));
      }
    }, 30000);
  });
}
