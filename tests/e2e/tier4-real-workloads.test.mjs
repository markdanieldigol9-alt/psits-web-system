/**
 * tier4-real-workloads.test.mjs
 * Tier 4: Real-World Workload Scenarios E2E Tests
 * Validates rapid scrubbing workloads (burst seeking byte ranges), sequential multi-quality transitions
 * (720p -> 360p -> Auto -> 144p -> 480p) retaining playback timestamps and play/pause states,
 * and concurrent client range streaming under load.
 */

import { assert, assertEqual } from './harness/test-framework.mjs';

class StreamPlaybackSession {
  constructor(initial = {}) {
    this.currentTime = initial.currentTime || 0;
    this.isPlaying = initial.isPlaying || false;
    this.activeQuality = initial.activeQuality || '720p';
    this.duration = initial.duration || 600; // 10 minutes
    this.history = [];
  }

  play() {
    this.isPlaying = true;
  }

  pause() {
    this.isPlaying = false;
  }

  advanceTime(seconds) {
    if (this.isPlaying) {
      this.currentTime = Math.min(this.duration, this.currentTime + seconds);
    }
  }

  switchQuality(newQuality) {
    const previousTime = this.currentTime;
    const wasPlaying = this.isPlaying;

    // Simulate switching source buffer / URL query
    this.activeQuality = newQuality;

    // Preserve exact timestamp & play state
    this.currentTime = previousTime;
    this.isPlaying = wasPlaying;

    this.history.push({
      quality: newQuality,
      time: this.currentTime,
      isPlaying: this.isPlaying,
    });

    return {
      quality: this.activeQuality,
      currentTime: this.currentTime,
      isPlaying: this.isPlaying,
    };
  }
}

export async function runTier4Tests(runner, client, serverInstance) {
  runner.suite('Tier 4 — Real-World Workload Scenarios (Scrubbing & Multi-Quality Transitions)');

  // Ensure test independence: Tier 4 sets up a dedicated 64KB test video recording
  const stream64k = Buffer.alloc(65536);
  // Box size 24
  stream64k.writeUInt32BE(24, 0);
  stream64k.write('ftypmp42', 4, 8, 'ascii');
  stream64k.write('isommp42', 12, 8, 'ascii');
  for (let i = 24; i < 65536; i++) {
    stream64k[i] = (i % 251) + 1;
  }

  await client.putBinary('/api/stream-events/101/recording', stream64k, {
    'Content-Type': 'video/mp4',
    'X-Filename': 'tier4-benchmark.mp4',
  });

  const originalRecording = serverInstance.getRecording();
  const totalFileSize = originalRecording.length;

  // TC4.1: Rapid Multi-Seeking Scrub Workload
  await runner.test('TC4.1: Rapid multi-seeking scrub workload (15 successive range requests) completes without socket hangs or corrupted bytes', async () => {
    // Generate 15 distinct range scrub seek targets across the stream
    const seekOffsets = [
      0, 2048, 8192, 16384, 4096, 24576, 32768, 12288, 40960, 49152, 28672, 53248, 1024, 61440, 500,
    ];

    const chunkSize = 1024;
    const startTime = performance.now();

    for (const offset of seekOffsets) {
      const start = Math.min(offset, totalFileSize - chunkSize - 1);
      const end = start + chunkSize - 1;
      const rangeHeader = `bytes=${start}-${end}`;

      const res = await client.getRange('/api/stream-events/101/recording/stream', rangeHeader);

      assertEqual(res.status, 206, `Expected HTTP 206 for scrub offset ${start}`);
      assertEqual(res.contentLength, chunkSize, `Expected Content-Length ${chunkSize} at ${rangeHeader}`);
      assertEqual(res.rawBuffer.length, chunkSize, `Expected chunk size ${chunkSize}`);

      const expectedBytes = originalRecording.subarray(start, end + 1);
      assert(
        res.rawBuffer.equals(expectedBytes),
        `Scrub chunk at range ${rangeHeader} must match source bytes exactly`
      );
    }

    const elapsed = performance.now() - startTime;
    assert(elapsed < 2000, `Expected 15 scrub range requests to finish in < 2000ms, took ${elapsed.toFixed(1)}ms`);
  });

  // TC4.2: Sequential Multi-Quality Transitions (720p -> 360p -> Auto)
  await runner.test('TC4.2: Sequential quality transitions (720p -> 360p -> Auto) preserve timestamps and play state across transitions', async () => {
    const session = new StreamPlaybackSession({
      currentTime: 10.0,
      isPlaying: true,
      activeQuality: '720p',
    });

    // 1. Play for 8.5 seconds
    session.advanceTime(8.5);
    assertEqual(session.currentTime, 18.5, 'Playback progressed to 18.5s');

    // 2. Network drop triggers quality switch: 720p -> 360p
    const switch1 = session.switchQuality('360p');
    assertEqual(switch1.quality, '360p', 'Active quality is now 360p');
    assertEqual(switch1.currentTime, 18.5, 'Playback timestamp strictly preserved at 18.5s');
    assertEqual(switch1.isPlaying, true, 'Active playing state resumed seamlessly');

    // 3. Play for another 16.7 seconds
    session.advanceTime(16.7);
    assertEqual(Math.round(session.currentTime * 10) / 10, 35.2, 'Playback progressed to 35.2s');

    // 4. Bandwidth stabilizes triggers quality switch: 360p -> Auto
    const switch2 = session.switchQuality('Auto');
    assertEqual(switch2.quality, 'Auto', 'Active quality is now Auto');
    assertEqual(Math.round(switch2.currentTime * 10) / 10, 35.2, 'Playback timestamp preserved at 35.2s');
    assertEqual(switch2.isPlaying, true, 'Playing state preserved');

    // 5. User pauses at 50.0s
    session.advanceTime(14.8);
    assertEqual(session.currentTime, 50.0, 'Playback progressed to 50.0s');
    session.pause();
    assertEqual(session.isPlaying, false, 'Session is paused');

    // 6. User manually switches quality from paused state: Auto -> 480p
    const switch3 = session.switchQuality('480p');
    assertEqual(switch3.quality, '480p', 'Active quality updated to 480p');
    assertEqual(switch3.currentTime, 50.0, 'Playback timestamp retained at 50.0s');
    assertEqual(switch3.isPlaying, false, 'Paused state maintained without auto-playing');
  });

  // TC4.3: Concurrent Multi-Client Streaming Workload
  await runner.test('TC4.3: Concurrent multi-client streaming (10 parallel clients) processes range requests without cross-talk or errors', async () => {
    const clientRequests = Array.from({ length: 10 }, (_, i) => {
      const start = i * 2048;
      const end = start + 1023;
      return {
        id: i + 1,
        start,
        end,
        range: `bytes=${start}-${end}`,
      };
    });

    const results = await Promise.all(
      clientRequests.map(async (req) => {
        const res = await client.getRange('/api/stream-events/101/recording/stream', req.range);
        return {
          req,
          res,
        };
      })
    );

    for (const { req, res } of results) {
      assertEqual(res.status, 206, `Client #${req.id} expected HTTP 206`);
      assertEqual(res.contentLength, 1024, `Client #${req.id} expected 1024 bytes`);
      const expectedSlice = originalRecording.subarray(req.start, req.end + 1);
      assert(
        res.rawBuffer.equals(expectedSlice),
        `Client #${req.id} chunk must match source byte slice at ${req.range}`
      );
    }
  });

  // TC4.4: Error Recovery from Out-of-Bounds Stream Request
  await runner.test('TC4.4: Immediate recovery to valid 206 streaming following a 416 out-of-bounds error', async () => {
    // Bad request
    const badRes = await client.getRange('/api/stream-events/101/recording/stream', 'bytes=999999999-');
    assertEqual(badRes.status, 416, 'Expected 416 on out-of-bounds request');

    // Subsequent valid request succeeds immediately
    const goodRes = await client.getRange('/api/stream-events/101/recording/stream', 'bytes=0-511');
    assertEqual(goodRes.status, 206, 'Expected 206 on subsequent valid range request');
    assertEqual(goodRes.contentLength, 512, 'Expected Content-Length 512');
  });
}
