import { describe, it, expect } from 'vitest';
import OpenAI from 'openai';
import WebSocket from 'ws';

// Load environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY || '';
const CARTESIA_API_VERSION = process.env.CARTESIA_API_VERSION || '2025-04-16';
const CARTESIA_VOICE_ID = process.env.CARTESIA_VOICE_ID || '';
const CARTESIA_MODEL_ID = process.env.CARTESIA_MODEL_ID || 'sonic-multilingual';

describe('Integration Tests', () => {
  describe('OpenAI API Integration', () => {
    it('should successfully connect to OpenAI API and get models', async () => {
      expect(OPENAI_API_KEY).toBeTruthy();

      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
        dangerouslyAllowBrowser: true // Allow in test environment
      });
      const models = await openai.models.list();

      expect(models.data).toBeDefined();
      expect(Array.isArray(models.data)).toBe(true);
      expect(models.data.length).toBeGreaterThan(0);

      // Check if gpt-4o-mini is available
      const hasGpt4oMini = models.data.some(model => model.id === 'gpt-4o-mini');
      expect(hasGpt4oMini).toBe(true);
    }, 10000);

    it('should successfully generate a streaming response from OpenAI', async () => {
      expect(OPENAI_API_KEY).toBeTruthy();

      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
        dangerouslyAllowBrowser: true // Allow in test environment
      });
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that responds in Hebrew.',
          },
          {
            role: 'user',
            content: 'שלום, מה שלומך?',
          },
        ],
        stream: true,
      });

      let fullResponse = '';
      let chunkCount = 0;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullResponse += content;
        chunkCount++;
      }

      expect(chunkCount).toBeGreaterThan(0);
      expect(fullResponse.length).toBeGreaterThan(0);
      console.log(`✓ OpenAI streaming test: received ${chunkCount} chunks, ${fullResponse.length} chars`);
    }, 30000);
  });

  describe('Cartesia TTS API Integration', () => {
    it('should successfully connect to Cartesia TTS WebSocket', async () => {
      expect(CARTESIA_API_KEY).toBeTruthy();
      expect(CARTESIA_VOICE_ID).toBeTruthy();

      const wsUrl = `wss://api.cartesia.ai/tts/websocket?api_key=${CARTESIA_API_KEY}&cartesia_version=${CARTESIA_API_VERSION}`;

      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 10000);

        ws.on('open', () => {
          clearTimeout(timeout);

          // Send a test TTS request
          const request = {
            model_id: CARTESIA_MODEL_ID,
            transcript: 'שלום, זהו בדיקת טקסט לדיבור',
            continue: false,
            voice: {
              mode: 'id',
              id: CARTESIA_VOICE_ID,
            },
            language: 'he',
            output_format: {
              container: 'raw',
              encoding: 'pcm_s16le',
              sample_rate: 16000,
            },
          };

          ws.send(JSON.stringify(request));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.done) {
            console.log('✓ Cartesia TTS test: successfully generated audio');
            ws.close();
            resolve();
          } else if (message.error) {
            ws.close();
            reject(new Error(`Cartesia error: ${message.error}`));
          } else if (message.data) {
            // Received audio data chunk
            expect(message.data).toBeDefined();
            expect(typeof message.data).toBe('string');
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    }, 15000);

    it('should generate audio with context-based streaming', async () => {
      expect(CARTESIA_API_KEY).toBeTruthy();
      expect(CARTESIA_VOICE_ID).toBeTruthy();

      const wsUrl = `wss://api.cartesia.ai/tts/websocket?api_key=${CARTESIA_API_KEY}&cartesia_version=${CARTESIA_API_VERSION}`;

      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const contextId = `test_context_${Date.now()}`;
        let chunkCount = 0;

        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 15000);

        ws.on('open', () => {
          clearTimeout(timeout);

          // Send first chunk with context
          const request1 = {
            model_id: CARTESIA_MODEL_ID,
            transcript: 'זוהי משפט ראשון.',
            continue: true,
            context_id: contextId,
            voice: {
              mode: 'id',
              id: CARTESIA_VOICE_ID,
            },
            language: 'he',
            output_format: {
              container: 'raw',
              encoding: 'pcm_s16le',
              sample_rate: 16000,
            },
          };

          ws.send(JSON.stringify(request1));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.done) {
            chunkCount++;

            if (chunkCount === 1) {
              // Send second chunk with same context
              const request2 = {
                model_id: CARTESIA_MODEL_ID,
                transcript: 'זוהי משפט שני.',
                continue: false,
                context_id: contextId,
                voice: {
                  mode: 'id',
                  id: CARTESIA_VOICE_ID,
                },
                language: 'he',
                output_format: {
                  container: 'raw',
                  encoding: 'pcm_s16le',
                  sample_rate: 16000,
                },
              };

              ws.send(JSON.stringify(request2));
            } else {
              console.log(`✓ Cartesia context streaming test: successfully generated ${chunkCount} chunks`);
              ws.close();
              resolve();
            }
          } else if (message.error) {
            ws.close();
            reject(new Error(`Cartesia error: ${message.error}`));
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    }, 20000);
  });

  describe('Cartesia STT API Integration', () => {
    it('should successfully connect to Cartesia STT WebSocket', async () => {
      expect(CARTESIA_API_KEY).toBeTruthy();

      const wsUrl = `wss://api.cartesia.ai/stt/websocket?api_key=${CARTESIA_API_KEY}&cartesia_version=${CARTESIA_API_VERSION}`;

      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 10000);

        ws.on('open', () => {
          clearTimeout(timeout);
          console.log('✓ Cartesia STT test: successfully connected to WebSocket');
          ws.close();
          resolve();
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    }, 15000);
  });

  describe('Full Models API Integration', () => {
    it('should successfully fetch and filter GPT models', async () => {
      expect(OPENAI_API_KEY).toBeTruthy();

      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
        dangerouslyAllowBrowser: true // Allow in test environment
      });
      const models = await openai.models.list();

      // Filter like we do in api/models.ts
      const chatModels = models.data
        .filter(model =>
          model.id.includes('gpt') &&
          !model.id.includes('instruct') &&
          !model.id.includes('embedding')
        )
        .sort((a, b) => b.created - a.created);

      expect(chatModels.length).toBeGreaterThan(0);

      // Verify popular models are present
      const modelIds = chatModels.map(m => m.id);
      const expectedModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'];
      const foundModels = expectedModels.filter(id => modelIds.includes(id));

      expect(foundModels.length).toBeGreaterThan(0);
      console.log(`✓ Models API test: found ${chatModels.length} chat models including: ${foundModels.join(', ')}`);
    }, 10000);
  });
});
