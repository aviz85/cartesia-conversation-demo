export interface LatencyMetrics {
  recording: number;
  stt: number;
  llm: number;
  llm_first_token: number;
  tts: number;
  tts_first_byte: number;
  end_to_end: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export type StreamEventType =
  | 'ready'
  | 'transcript'
  | 'thinking'
  | 'gpt_chunk'
  | 'gpt_done'
  | 'audio'
  | 'audio_done'
  | 'latency'
  | 'error';

export interface StreamEvent {
  type: StreamEventType;
  text?: string;
  data?: string;
  stage?: keyof LatencyMetrics;
  duration?: number;
  breakdown?: Partial<LatencyMetrics>;
  message?: string;
  timestamp?: number;
}

export interface ConversationRequest {
  audio: string; // base64 encoded PCM audio
  sessionId: string;
  model?: string; // Optional OpenAI model selection
}

export interface AudioConfig {
  sampleRate: number;
  channelCount: number;
  encoding: 'pcm_s16le';
}
