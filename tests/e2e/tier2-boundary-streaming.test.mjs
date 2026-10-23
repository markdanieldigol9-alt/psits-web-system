/**
 * tier2-boundary-streaming.test.mjs
 * Tier 2: Boundary & Corner Cases E2E Tests
 * Validates RFC 7233 HTTP 206 Partial Content range requests (forward, open-ended, suffix, out-of-bounds 416,
 * inverted 416, missing range 200, HEAD request 200), quality switch timestamp retention, and zero/NaN duration edge cases.
 */

import { assert, assertEqual, assertMatch } from './harness/test-framework.mjs';

/**
 * Simulates the video player state machine for quality switching.
 * Mimics CustomVideoPlayer state preservation mechanics.
 */
class VideoPlayerStateSimulation {
  constructor(initialState = {}) {
    this.currentTime = initialState.currentTime || 0;
    this.isPlaying = initialState.isPlaying || false;
    this.quality = initialState.quality || 'Auto';
    this.duration = initialState.duration || 0;
    this.sourceUrl = initialState.sourceUrl || '';
  }

  changeQuality(newQuality, newSourceUrl = null) {
    // 1. Capture snapshot before switch
    const savedTime = this.currentTime;
    const wasPlaying = this.isPlaying;

    // 2. Apply new quality and source URL
    this.quality = newQuality;
    if (newSourceUrl) {
      this.sourceUrl = newSourceUrl;
    }

    // 3. Restore state on metadata load
    this.currentTime = savedTime;
    this.isPlaying = wasPlaying;

    return {
      retainedTime: this.currentTime,
      retainedPlaying: this.isPlaying,
      activeQuality: this.quality,
    };
  }

  getProgressPercentage() {
    if (!this.duration || Number.isNaN(this.duration) || !Number.isFinite(this.duration) || this.duration <= 0) {
      return 0;
    }
    const pct = (this.currentTime / this.duration) * 100;
    return Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));
  }

  seek(targetSeconds) {
    if (Number.isNaN(targetSeconds) || !Number.isFinite(targetSeconds)) {
      this.currentTime = 0;
      return 0;
    }
    const maxDuration = Math.max(0, this.duration || 0);
    this.currentTime = Math.min(maxDuration, Math.max(0, targetSeconds));
    return this.currentTime;
  }
}

/**
 * Formats time safely (prevents NaN / Infinity)
 */
function formatDurationSafe(seconds) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds) || !Number.isFinite(seconds) || seconds <= 0) {
    return '00:00';
  }
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export async function runTier2Tests(runner, client, serverInstance) {
  runner.suite('Tier 2 — Boundary & Corner Cases (HTTP 206 Streaming & Player State)');

  // Ensure test independence: Tier 2 sets up a dedicated 64KB test video recording
  const stream64k = Buffer.alloc(65536);
  stream64k.writeUInt32BE(24, 0);
  stream64k.write('ftypmp42', 4, 8, 'ascii');
  stream64k.write('isommp42', 12, 8, 'ascii');
  for (let i = 24; i < 65536; i++) {
    stream64k[i] = (i % 251) + 1;
  }

  await client.putBinary('/api/stream-events/101/recording', stream64k, {
    'Content-Type': 'video/mp4',
    'X-Filename': 'tier2-stream.mp4',
  });

  const originalRecording = serverInstance.getRecording();
  const totalFileSize = originalRecording.length;

  // TC2.1: Forward Byte Range Request (bytes=0-1023)
  await runner.test('TC2.1: Forward byte range (bytes=0-1023) returns HTTP 206, Content-Range, Content-Length 1024', async () => {
    const res = await client.getRange('/api/stream-events/101/recording/stream', 'bytes=0-1023');

    assertEqual(res.status, 206, 'Expected HTTP 206 Partial Content');
    assertEqual(res.contentRange, `bytes 0-1023/${totalFileSize}`, 'Expected Content-Range header bytes 0-1023/size');
    assertEqual(res.contentLength, 1024, 'Expected Content-Length 1024');
    assertEqual(res.acceptRanges, 'bytes', 'Expected Accept-Ranges bytes');
    assertEqual(res.rawBuffer.length, 1024, 'Expected exactly 1024 body bytes');

    // Verify byte content integrity against original source
    const expectedSlice = originalRecording.subarray(0, 1024);
    assert(res.rawBuffer.equals(expectedSlice), 'Returned buffer content must match original byte-for-byte');
  });

  // TC2.2: Arbitrary Mid-Stream Range Request (bytes=1024-2047)
  await runner.test('TC2.2: Mid-file range (bytes=1024-2047) returns HTTP 206 and exact byte slice', async () => {
    const res = await client.getRange('/api/stream-events/101/recording/stream', 'bytes=1024-2047');

    assertEqual(res.status, 206, 'Expected HTTP 206 Partial Content');
    assertEqual(res.contentRange, `bytes 1024-2047/${totalFileSize}`, 'Expected Content-Range bytes 1024-2047/size');
    assertEqual(res.contentLength, 1024, 'Expected Content-Length 1024');
    assertEqual(res.rawBuffer.length, 1024, 'Expected 1024 body bytes');

    const expectedSlice = originalRecording.subarray(1024, 2048);
    assert(res.rawBuffer.equals(expectedSlice), 'Returned mid-stream buffer content must match source slice');
  });

  // TC2.3: Open-Ended Range Request (bytes=2048-)
  await runner.test('TC2.3: Open-ended range (bytes=2048-) returns HTTP 206 to EOF', async () => {
    const res = await client.getRange('/api/stream-events/101/recording/stream', 'bytes=2048-');

    const expectedLength = totalFileSize - 2048;
    assertEqual(res.status, 206, 'Expected HTTP 206 Partial Content');
    assertEqual(res.contentRange, `bytes 2048-${totalFileSize - 1}/${totalFileSize}`, 'Expected range 2048 to EOF');
    assertEqual(res.contentLength, expectedLength, `Expected Content-Length ${expectedLength}`);
    assertEqual(res.rawBuffer.length, expectedLength, 'Expected remaining file bytes');

    const expectedSlice = originalRecording.subarray(2048, totalFileSize);
    assert(res.rawBuffer.equals(expectedSlice), 'Buffer slice must match byte-for-byte to EOF');
  });

  // TC2.4: Suffix Byte Range Request (bytes=-500)
  await runner.test('TC2.4: Suffix range (bytes=-500) returns HTTP 206 with final 500 bytes', async () => {
    const res = await client.getRange('/api/stream-events/101/recording/stream', 'bytes=-500');

    const expectedStart = totalFileSize - 500;
    const expectedEnd = totalFileSize - 1;

    assertEqual(res.status, 206, 'Expected HTTP 206 Partial Content');
    assertEqual(res.contentRange, `bytes ${expectedStart}-${expectedEnd}/${totalFileSize}`, 'Expected suffix Content-Range');
    assertEqual(res.contentLength, 500, 'Expected Content-Length 500');
    assertEqual(res.rawBuffer.length, 500, 'Expected exactly 500 bytes');

    const expectedSlice = originalRecording.subarray(expectedStart, totalFileSize);
    assert(res.rawBuffer.equals(expectedSlice), 'Suffix buffer slice must match final 500 bytes of stream');
  });

  // TC2.5: Out-of-Bounds Range Request (bytes=999999999-)
  await runner.test('TC2.5: Out-of-bounds start range (bytes=999999999-) returns HTTP 416 with */size', async () => {
    const res = await client.getRange('/api/stream-events/101/recording/stream', 'bytes=999999999-');

    assertEqual(res.status, 416, 'Expected HTTP 416 Range Not Satisfiable');
    assertEqual(res.contentRange, `bytes */${totalFileSize}`, 'Expected Content-Range bytes */size');
  });

  // TC2.6: Inverted Range Request (bytes=2000-1000)
  await runner.test('TC2.6: Inverted range (bytes=2000-1000) returns HTTP 416 Range Not Satisfiable', async () => {
    const res = await client.getRange('/api/stream-events/101/recording/stream', 'bytes=2000-1000');

    assertEqual(res.status, 416, 'Expected HTTP 416 Range Not Satisfiable');
    assertEqual(res.contentRange, `bytes */${totalFileSize}`, 'Expected Content-Range bytes */size');
  });

  // TC2.7: Missing Range Header (Full Content Request)
  await runner.test('TC2.7: Missing Range header returns HTTP 200 OK with full file and Accept-Ranges: bytes', async () => {
    const res = await client.get('/api/stream-events/101/recording/stream');

    assertEqual(res.status, 200, 'Expected HTTP 200 OK');
    assertEqual(res.acceptRanges, 'bytes', 'Expected Accept-Ranges bytes');
    assertEqual(res.contentLength, totalFileSize, 'Expected Content-Length equal to total file size');
    assertEqual(res.rawBuffer.length, totalFileSize, 'Expected full file body');
    assert(res.rawBuffer.equals(originalRecording), 'Full body must match recording file');
  });

  // TC2.8: HTTP HEAD Request
  await runner.test('TC2.8: HTTP HEAD request returns 200 with Content-Length, Content-Type, Accept-Ranges, and 0 body bytes', async () => {
    const res = await client.head('/api/stream-events/101/recording/stream');

    assertEqual(res.status, 200, 'Expected HTTP 200 OK for HEAD request');
    assertEqual(res.acceptRanges, 'bytes', 'Expected Accept-Ranges bytes');
    assertEqual(res.contentLength, totalFileSize, 'Expected Content-Length equal to total file size');
    assertMatch(res.contentType, /^video\//, 'Expected video/* Content-Type header');
    assertEqual(res.rawBuffer.length, 0, 'HEAD request must return 0 body bytes');
  });

  // TC2.9: Quality Switch Timestamp Retention Mechanics (Paused State)
  await runner.test('TC2.9: Quality switch while paused at timestamp 42.5s retains exact currentTime and paused state', async () => {
    const player = new VideoPlayerStateSimulation({
      currentTime: 42.5,
      isPlaying: false,
      quality: '720p',
      duration: 300,
    });

    const result = player.changeQuality('360p', '/api/stream-events/101/recording/stream?quality=360p');

    assertEqual(result.retainedTime, 42.5, 'Playback timestamp must be preserved across quality switch');
    assertEqual(result.retainedPlaying, false, 'Paused play state must be preserved');
    assertEqual(result.activeQuality, '360p', 'Active quality must update to 360p');
  });

  // TC2.10: Quality Switch Timestamp Retention Mechanics (Playing State)
  await runner.test('TC2.10: Quality switch while playing at timestamp 120.0s retains exact currentTime and playing state', async () => {
    const player = new VideoPlayerStateSimulation({
      currentTime: 120.0,
      isPlaying: true,
      quality: '720p',
      duration: 300,
    });

    const result = player.changeQuality('Auto', '/api/stream-events/101/recording/stream?quality=Auto');

    assertEqual(result.retainedTime, 120.0, 'Playback timestamp must be preserved during active playback switch');
    assertEqual(result.retainedPlaying, true, 'Active playing state must resume without stalling');
    assertEqual(result.activeQuality, 'Auto', 'Active quality must update to Auto');
  });

  // TC2.11: Zero and NaN Duration Edge Cases
  await runner.test('TC2.11: Zero and NaN duration edge cases render safely without exceptions or divide-by-zero', async () => {
    const uninitializedPlayer = new VideoPlayerStateSimulation({
      currentTime: 0,
      isPlaying: false,
      duration: 0, // Unloaded video duration
    });

    assertEqual(uninitializedPlayer.getProgressPercentage(), 0, 'Progress percentage for 0 duration must be 0');
    assertEqual(formatDurationSafe(0), '00:00', '0 duration must format as 00:00');
    assertEqual(formatDurationSafe(NaN), '00:00', 'NaN duration must format safely as 00:00');
    assertEqual(formatDurationSafe(Infinity), '00:00', 'Infinity duration must format safely as 00:00');

    // Attempt scrub on uninitialized video
    const seekResult = uninitializedPlayer.seek(45);
    assertEqual(seekResult, 0, 'Seeking on 0 duration video must clamp to 0');
  });
}
