import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { type TranscribeAudioInput } from '../schema';
import { transcribeAudio } from '../handlers/transcribe_audio';

// Valid base64 encoded audio data (simulated)
const validVeryShortAudio = 'U2hvcnQ='; // 8 chars - very short
const validShortAudio = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='; // 64 chars  
const validMediumAudio = 'UklGRiQAAABXQVZGZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAABBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB'; // 400+ chars
const validLongAudio = 'UklGRiQAAABXQVZGZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA' + 'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB'; // Valid long base64

describe('transcribeAudio', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should transcribe short audio chunk', async () => {
    const input: TranscribeAudioInput = {
      audio_chunk: validShortAudio
    };

    const result = await transcribeAudio(input);

    expect(result).toEqual({
      partial_transcript: expect.any(String)
    });
    expect(result.partial_transcript).toBeDefined();
  });

  it('should return empty transcript for very short audio', async () => {
    const input: TranscribeAudioInput = {
      audio_chunk: validVeryShortAudio // Very short base64
    };

    const result = await transcribeAudio(input);

    expect(result.partial_transcript).toBe('');
  });

  it('should return partial word for short audio', async () => {
    const input: TranscribeAudioInput = {
      audio_chunk: validShortAudio
    };

    const result = await transcribeAudio(input);

    expect(result.partial_transcript).toBe('Hello');
  });

  it('should return partial sentence for medium audio', async () => {
    const input: TranscribeAudioInput = {
      audio_chunk: validMediumAudio
    };

    const result = await transcribeAudio(input);

    expect(result.partial_transcript).toBe('Hello, this is a');
  });

  it('should return full sentence for long audio', async () => {
    const input: TranscribeAudioInput = {
      audio_chunk: validLongAudio
    };

    const result = await transcribeAudio(input);

    expect(result.partial_transcript).toBe('Hello, this is a test transcription from the audio chunk');
  });

  it('should handle meeting_id when provided', async () => {
    const input: TranscribeAudioInput = {
      audio_chunk: validMediumAudio,
      meeting_id: '550e8400-e29b-41d4-a716-446655440000'
    };

    const result = await transcribeAudio(input);

    expect(result.partial_transcript).toBe('Hello, this is a');
    // In real implementation, meeting_id might affect transcription context
    // For now, we just verify it doesn't break the functionality
  });

  it('should reject empty audio chunk', async () => {
    const input: TranscribeAudioInput = {
      audio_chunk: ''
    };

    await expect(transcribeAudio(input)).rejects.toThrow(/audio chunk cannot be empty/i);
  });

  it('should reject whitespace-only audio chunk', async () => {
    const input: TranscribeAudioInput = {
      audio_chunk: '   '
    };

    await expect(transcribeAudio(input)).rejects.toThrow(/audio chunk cannot be empty/i);
  });

  it('should reject invalid base64 format', async () => {
    const input: TranscribeAudioInput = {
      audio_chunk: 'invalid-base64-@#$%'
    };

    await expect(transcribeAudio(input)).rejects.toThrow(/invalid base64 audio format/i);
  });

  it('should handle various valid base64 formats', async () => {
    const testCases = [
      'SGVsbG8=', // Standard base64
      'SGVsbG93b3JsZA==', // With double padding
      'QUJDREVGRw', // No padding needed
    ];

    for (const audioChunk of testCases) {
      const input: TranscribeAudioInput = {
        audio_chunk: audioChunk
      };

      const result = await transcribeAudio(input);
      expect(result.partial_transcript).toBeDefined();
      expect(typeof result.partial_transcript).toBe('string');
    }
  });

  it('should process transcription in reasonable time', async () => {
    const input: TranscribeAudioInput = {
      audio_chunk: validMediumAudio
    };

    const startTime = Date.now();
    await transcribeAudio(input);
    const endTime = Date.now();

    // Should complete within 200ms (allowing for processing delay simulation)
    expect(endTime - startTime).toBeLessThan(200);
  });

  it('should handle concurrent transcription requests', async () => {
    const input: TranscribeAudioInput = {
      audio_chunk: validMediumAudio
    };

    // Process multiple chunks concurrently
    const promises = Array.from({ length: 5 }, () => transcribeAudio(input));
    const results = await Promise.all(promises);

    // All should succeed and return consistent results
    expect(results).toHaveLength(5);
    results.forEach(result => {
      expect(result.partial_transcript).toBe('Hello, this is a');
    });
  });

  it('should handle different meeting IDs correctly', async () => {
    const meetingIds = [
      '550e8400-e29b-41d4-a716-446655440000',
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      '6ba7b811-9dad-11d1-80b4-00c04fd430c8'
    ];

    for (const meetingId of meetingIds) {
      const input: TranscribeAudioInput = {
        audio_chunk: validMediumAudio,
        meeting_id: meetingId
      };

      const result = await transcribeAudio(input);
      expect(result.partial_transcript).toBeDefined();
      expect(typeof result.partial_transcript).toBe('string');
    }
  });
});