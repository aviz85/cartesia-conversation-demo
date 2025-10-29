import { StreamEvent, ConversationRequest } from '../types';

export class ConversationClient {
  private sessionId: string;

  constructor() {
    this.sessionId = `session_${Date.now()}`;
  }

  async *sendAudio(audioBase64: string): AsyncGenerator<StreamEvent> {
    const request: ConversationRequest = {
      audio: audioBase64,
      sessionId: this.sessionId,
    };

    const response = await fetch('/api/conversation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          try {
            const data = line.slice(6); // Remove 'data: ' prefix
            if (data === '[DONE]') continue;

            const event: StreamEvent = JSON.parse(data);
            yield event;
          } catch (error) {
            console.error('Error parsing SSE event:', error, line);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  resetSession(): void {
    this.sessionId = `session_${Date.now()}`;
  }
}
