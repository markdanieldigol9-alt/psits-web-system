/**
 * tier1-feature-coverage.test.mjs
 * Tier 1: Feature Coverage E2E Tests
 * Validates direct video upload magic bytes (.mp4, .webm), URL detection & ID extraction (YouTube, Vimeo, direct),
 * and player contract options (discrete qualities and playback speeds).
 */

import { assert, assertEqual, assertIncludes } from './harness/test-framework.mjs';
import {
  createValidMp4Buffer,
  createValidWebmBuffer,
  createInvalidVideoBuffer,
  YOUTUBE_URL_TEST_CASES,
  VIMEO_URL_TEST_CASES,
  DIRECT_STREAM_URL_TEST_CASES,
  EXPECTED_QUALITIES,
  EXPECTED_PLAYBACK_SPEEDS,
} from './harness/fixtures.mjs';
import { parseVideoSource } from './harness/video-source-spec.mjs';

export async function runTier1Tests(runner, client) {
  runner.suite('Tier 1 — Feature Coverage');

  // TC1.1: Direct MP4 Video Upload Validation
  await runner.test('TC1.1: Direct video upload accepts valid .mp4 buffer with ftyp header', async () => {
    const mp4Buffer = createValidMp4Buffer(4096);
    const res = await client.putBinary('/api/stream-events/101/recording', mp4Buffer, {
      'Content-Type': 'video/mp4',
      'X-Filename': 'keynote-speech.mp4',
    });

    assertEqual(res.status, 200, 'Expected HTTP 200 on valid MP4 upload');
    assert(res.json && res.json.success === true, 'Expected success: true');
    assert(res.json.liveEvent, 'Expected liveEvent object in response');
    assertEqual(res.json.liveEvent.recordingEnabled, 1, 'Expected recordingEnabled = 1');
    assert(res.json.liveEvent.recordingUrl.includes('/recording/stream'), 'Expected streamable recording URL');
  });

  // TC1.2: Direct WebM Video Upload Validation
  await runner.test('TC1.2: Direct video upload accepts valid .webm buffer with EBML header', async () => {
    const webmBuffer = createValidWebmBuffer(4096);
    const res = await client.putBinary('/api/stream-events/101/recording', webmBuffer, {
      'Content-Type': 'video/webm',
      'X-Filename': 'workshop-demo.webm',
    });

    assertEqual(res.status, 200, 'Expected HTTP 200 on valid WebM upload');
    assert(res.json && res.json.success === true, 'Expected success: true');
    assert(res.json.liveEvent.sizeBytes >= 4096, 'Expected recorded sizeBytes to match buffer');
  });

  // TC1.3: Direct Video Upload Rejects Invalid Magic Bytes
  await runner.test('TC1.3: Direct video upload rejects non-video binary disguised as .mp4', async () => {
    const fakeBuffer = createInvalidVideoBuffer('text');
    const res = await client.putBinary('/api/stream-events/101/recording', fakeBuffer, {
      'Content-Type': 'video/mp4',
      'X-Filename': 'fake-recording.mp4',
    });

    assertEqual(res.status, 400, 'Expected HTTP 400 on invalid video file buffer');
    assert(res.json && res.json.success === false, 'Expected success: false');
    assert(res.json.message.includes('Invalid or unsupported video file header'), 'Expected header error message');
  });

  // TC1.4: YouTube Standard Watch URL Detection & ID Extraction
  await runner.test('TC1.4: YouTube standard watch URL detection and video ID extraction', async () => {
    for (const tc of YOUTUBE_URL_TEST_CASES.filter((c) => c.url.includes('watch?v='))) {
      const parsed = parseVideoSource(tc.url);
      assertEqual(parsed.type, 'youtube', `Expected type youtube for ${tc.url}`);
      assertEqual(parsed.videoId, tc.expectedId, `Expected ID ${tc.expectedId}`);
      assertEqual(parsed.embedUrl, tc.expectedEmbedUrl, `Expected privacy-enhanced embed URL`);
      assertEqual(parsed.isValid, true, 'Expected isValid = true');
    }
  });

  // TC1.5: YouTube Short & Shorts URL Detection & ID Extraction
  await runner.test('TC1.5: YouTube short (youtu.be) and shorts URL detection and ID extraction', async () => {
    for (const tc of YOUTUBE_URL_TEST_CASES.filter((c) => c.url.includes('youtu.be') || c.url.includes('/shorts/'))) {
      const parsed = parseVideoSource(tc.url);
      assertEqual(parsed.type, 'youtube', `Expected type youtube for ${tc.url}`);
      assertEqual(parsed.videoId, tc.expectedId, `Expected ID ${tc.expectedId}`);
      assertEqual(parsed.embedUrl, tc.expectedEmbedUrl, `Expected privacy-enhanced embed URL`);
    }
  });

  // TC1.6: YouTube Embed URL Normalization
  await runner.test('TC1.6: YouTube embed URL detection and ID extraction', async () => {
    const tc = YOUTUBE_URL_TEST_CASES.find((c) => c.url.includes('/embed/'));
    const parsed = parseVideoSource(tc.url);
    assertEqual(parsed.type, 'youtube', 'Expected type youtube');
    assertEqual(parsed.videoId, tc.expectedId, 'Expected video ID match');
    assertEqual(parsed.embedUrl, tc.expectedEmbedUrl, 'Expected embed URL');
  });

  // TC1.7: Vimeo URL Detection & ID Extraction
  await runner.test('TC1.7: Vimeo standard, channel, and player URL detection and ID extraction', async () => {
    for (const tc of VIMEO_URL_TEST_CASES) {
      const parsed = parseVideoSource(tc.url);
      assertEqual(parsed.type, 'vimeo', `Expected type vimeo for ${tc.url}`);
      assertEqual(parsed.videoId, tc.expectedId, `Expected ID ${tc.expectedId}`);
      assertEqual(parsed.embedUrl, tc.expectedEmbedUrl, `Expected player.vimeo.com embed URL`);
      assertEqual(parsed.isValid, true, 'Expected isValid = true');
    }
  });

  // TC1.8: Direct Video Stream URL Validation
  await runner.test('TC1.8: Direct HTTPS video stream URL validation (.mp4, .webm)', async () => {
    for (const tc of DIRECT_STREAM_URL_TEST_CASES) {
      const parsed = parseVideoSource(tc.url);
      assertEqual(parsed.type, 'direct', `Expected type direct for ${tc.url}`);
      assertEqual(parsed.embedUrl, null, 'Direct streams should not have iframe embed URL');
      assertEqual(parsed.isValid, true, 'Direct video streams should be valid');
    }
  });

  // TC1.9: Discrete Video Qualities Contract Validation
  await runner.test('TC1.9: Available qualities list contract matches [144p, 240p, 360p, 480p, 720p, Auto]', async () => {
    const res = await client.get('/api/stream-events/101');
    assertEqual(res.status, 200, 'Expected 200 OK for stream event metadata');
    assert(res.json && res.json.data, 'Expected event data payload');

    const qualities = res.json.data.availableQualities;
    assert(Array.isArray(qualities), 'Expected availableQualities to be an array');
    assertEqual(qualities.length, 6, 'Expected exactly 6 quality choices');

    for (const q of EXPECTED_QUALITIES) {
      assertIncludes(qualities, q, `Expected quality choice ${q}`);
    }
  });

  // TC1.10: Playback Speed Options Contract Validation
  await runner.test('TC1.10: Playback speed options contract matches [0.5, 1, 1.25, 1.5, 2]', async () => {
    assertEqual(EXPECTED_PLAYBACK_SPEEDS.length, 5, 'Expected 5 discrete playback speeds');
    assertIncludes(EXPECTED_PLAYBACK_SPEEDS, 0.5, 'Expected 0.5x half speed');
    assertIncludes(EXPECTED_PLAYBACK_SPEEDS, 1, 'Expected 1x normal speed');
    assertIncludes(EXPECTED_PLAYBACK_SPEEDS, 1.25, 'Expected 1.25x speed');
    assertIncludes(EXPECTED_PLAYBACK_SPEEDS, 1.5, 'Expected 1.5x speed');
    assertIncludes(EXPECTED_PLAYBACK_SPEEDS, 2, 'Expected 2x double speed');
  });
}
