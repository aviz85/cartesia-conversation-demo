import { AudioConfig } from '../types';

const AUDIO_CONFIG: AudioConfig = {
  sampleRate: 16000,
  channelCount: 1,
  encoding: 'pcm_s16le',
};

export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private onAudioData: ((data: string) => void) | null = null;

  async initialize(onAudioData: (data: string) => void): Promise<void> {
    this.onAudioData = onAudioData;

    // Create audio context
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: AUDIO_CONFIG.sampleRate,
    });

    // Get microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: AUDIO_CONFIG.sampleRate,
        channelCount: AUDIO_CONFIG.channelCount,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Create audio processor worklet
    const processorCode = `
      class AudioProcessor extends AudioWorkletProcessor {
        process(inputs) {
          const input = inputs[0];
          if (input.length > 0 && input[0]) {
            this.port.postMessage(input[0]);
          }
          return true;
        }
      }
      registerProcessor('audio-processor', AudioProcessor);
    `;

    const blob = new Blob([processorCode], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);

    await this.audioContext.audioWorklet.addModule(blobUrl);

    this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');

    this.workletNode.port.onmessage = (event) => {
      const float32Data = event.data as Float32Array;
      const pcmData = this.float32ToPCM(float32Data);
      const base64 = this.arrayBufferToBase64(pcmData.buffer as ArrayBuffer);
      this.onAudioData?.(base64);
    };

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    source.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination);
  }

  private float32ToPCM(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  cleanup(): void {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private audioQueue: string[] = [];
  private isPlaying = false;

  async initialize(): Promise<void> {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: AUDIO_CONFIG.sampleRate,
    });
  }

  queueAudio(base64Audio: string): void {
    this.audioQueue.push(base64Audio);
    if (!this.isPlaying) {
      this.playQueue();
    }
  }

  private async playQueue(): Promise<void> {
    if (this.audioQueue.length === 0 || !this.audioContext) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;

    while (this.audioQueue.length > 0) {
      const base64Audio = this.audioQueue.shift()!;

      try {
        // Decode base64
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Convert PCM S16LE to Float32
        const int16Array = new Int16Array(bytes.buffer);
        const float32Array = new Float32Array(int16Array.length);

        for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
        }

        // Create audio buffer
        const audioBuffer = this.audioContext.createBuffer(
          1,
          float32Array.length,
          AUDIO_CONFIG.sampleRate
        );
        audioBuffer.getChannelData(0).set(float32Array);

        // Play audio
        await this.playBuffer(audioBuffer);
      } catch (error) {
        console.error('Audio playback error:', error);
      }
    }

    this.isPlaying = false;
  }

  private playBuffer(buffer: AudioBuffer): Promise<void> {
    return new Promise((resolve) => {
      const source = this.audioContext!.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext!.destination);
      source.onended = () => resolve();
      source.start();
    });
  }

  cleanup(): void {
    this.audioQueue = [];
    this.isPlaying = false;
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
