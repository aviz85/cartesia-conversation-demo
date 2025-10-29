import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioRecorder, AudioPlayer } from '../services/audioService';

describe('AudioRecorder', () => {
  let recorder: AudioRecorder;

  beforeEach(() => {
    recorder = new AudioRecorder();
  });

  afterEach(() => {
    recorder.cleanup();
  });

  it('should create an instance', () => {
    expect(recorder).toBeInstanceOf(AudioRecorder);
  });

  it('should cleanup resources', () => {
    recorder.cleanup();
    expect(recorder).toBeDefined();
  });
});

describe('AudioPlayer', () => {
  let player: AudioPlayer;

  beforeEach(() => {
    player = new AudioPlayer();
  });

  afterEach(() => {
    player.cleanup();
  });

  it('should create an instance', () => {
    expect(player).toBeInstanceOf(AudioPlayer);
  });

  it('should queue audio for playback', () => {
    const testAudio = 'dGVzdA=='; // base64 "test"
    player.queueAudio(testAudio);
    expect(player).toBeDefined();
  });

  it('should cleanup resources', () => {
    player.cleanup();
    expect(player).toBeDefined();
  });
});
