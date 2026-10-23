/**
 * fixtures.mjs
 * Test fixtures, binary generators, and specification test vectors for Stream Event E2E suite.
 */

/**
 * Creates a valid MP4 buffer with ftyp box at offset 4.
 * @param {number} totalSize Total size in bytes (minimum 24)
 * @returns {Buffer}
 */
export function createValidMp4Buffer(totalSize = 4096) {
  const size = Math.max(24, totalSize);
  const buf = Buffer.alloc(size);

  // Box size: 24 bytes
  buf.writeUInt32BE(24, 0);
  // Major brand: 'ftyp'
  buf.write('ftyp', 4, 4, 'ascii');
  // Minor version: 'mp42'
  buf.write('mp42', 8, 4, 'ascii');
  // Compatible brands: 'isom'
  buf.write('isom', 12, 4, 'ascii');
  // 'mp42'
  buf.write('mp42', 16, 4, 'ascii');

  // Fill remainder with deterministic pattern
  for (let i = 24; i < size; i++) {
    buf[i] = (i % 251) + 1;
  }
  return buf;
}

/**
 * Creates a valid WebM buffer with EBML header (0x1A 0x45 0xDF 0xA3).
 * @param {number} totalSize Total size in bytes (minimum 16)
 * @returns {Buffer}
 */
export function createValidWebmBuffer(totalSize = 4096) {
  const size = Math.max(16, totalSize);
  const buf = Buffer.alloc(size);

  // EBML ID: 0x1A 0x45 0xDF 0xA3
  buf[0] = 0x1a;
  buf[1] = 0x45;
  buf[2] = 0xdf;
  buf[3] = 0xa3;

  // Header size descriptor & EBML docType 'webm'
  buf[4] = 0x01;
  buf.write('webm', 5, 4, 'ascii');

  for (let i = 9; i < size; i++) {
    buf[i] = (i % 251) + 1;
  }
  return buf;
}

/**
 * Creates an invalid/corrupted file buffer (e.g. text or PE header disguised as mp4).
 * @param {'text' | 'executable' | 'empty'} type
 * @returns {Buffer}
 */
export function createInvalidVideoBuffer(type = 'text') {
  if (type === 'empty') {
    return Buffer.alloc(0);
  }
  if (type === 'executable') {
    const buf = Buffer.alloc(512);
    buf.write('MZ', 0, 2, 'ascii'); // Windows DOS/PE stub
    return buf;
  }
  return Buffer.from('<!DOCTYPE html><html><body><h1>Not a video file</h1></body></html>', 'utf8');
}

/**
 * Generates synthetic video stream data with deterministic byte values for range tests.
 * @param {number} size Total size in bytes (e.g. 65,536 = 64KB)
 * @returns {Buffer}
 */
export function createDeterministicStreamData(size = 65536) {
  const buf = createValidMp4Buffer(size);
  return buf;
}

/**
 * YouTube test URLs with expected parsed metadata.
 */
export const YOUTUBE_URL_TEST_CASES = [
  {
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    expectedId: 'dQw4w9WgXcQ',
    expectedType: 'youtube',
    expectedEmbedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  },
  {
    url: 'https://youtu.be/dQw4w9WgXcQ',
    expectedId: 'dQw4w9WgXcQ',
    expectedType: 'youtube',
    expectedEmbedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  },
  {
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    expectedId: 'dQw4w9WgXcQ',
    expectedType: 'youtube',
    expectedEmbedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  },
  {
    url: 'https://www.youtube.com/shorts/5AcZ3C7xJ3M',
    expectedId: '5AcZ3C7xJ3M',
    expectedType: 'youtube',
    expectedEmbedUrl: 'https://www.youtube-nocookie.com/embed/5AcZ3C7xJ3M',
  },
  {
    url: 'https://m.youtube.com/watch?v=M7lc1UVf-VE',
    expectedId: 'M7lc1UVf-VE',
    expectedType: 'youtube',
    expectedEmbedUrl: 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
  },
];

/**
 * Vimeo test URLs with expected parsed metadata.
 */
export const VIMEO_URL_TEST_CASES = [
  {
    url: 'https://vimeo.com/76979871',
    expectedId: '76979871',
    expectedType: 'vimeo',
    expectedEmbedUrl: 'https://player.vimeo.com/video/76979871',
  },
  {
    url: 'https://player.vimeo.com/video/76979871',
    expectedId: '76979871',
    expectedType: 'vimeo',
    expectedEmbedUrl: 'https://player.vimeo.com/video/76979871',
  },
  {
    url: 'https://vimeo.com/channels/staffpicks/987654321',
    expectedId: '987654321',
    expectedType: 'vimeo',
    expectedEmbedUrl: 'https://player.vimeo.com/video/987654321',
  },
];

/**
 * Direct video stream URLs.
 */
export const DIRECT_STREAM_URL_TEST_CASES = [
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    expectedType: 'direct',
    isValid: true,
  },
  {
    url: 'https://stream.psits.org/2026/hackathon-replay.webm',
    expectedType: 'direct',
    isValid: true,
  },
];

/**
 * Malicious URL schemes that must be strictly rejected.
 */
export const MALICIOUS_SCHEME_TEST_CASES = [
  { url: 'javascript:alert(1)', description: 'JavaScript pseudo-protocol XSS attempt' },
  { url: 'javascript:/*--></title></style></textarea></script></xmp><svg/onload=\'+/"/+/onmouseover=1/+/[*/[]/+alert(1)//\'>', description: 'Advanced polymorphic JavaScript payload' },
  { url: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', description: 'Data URI HTML/JS injection' },
  { url: 'file:///etc/passwd', description: 'Local UNIX file URI scheme' },
  { url: 'file:///C:/Windows/win.ini', description: 'Local Windows file URI scheme' },
  { url: 'vbscript:MsgBox(1)', description: 'VBScript scheme execution' },
  { url: 'blob:https://psits.org/12345-67890', description: 'Blob URL impersonation' },
];

/**
 * SSRF target URLs that must be blocked by the server and client.
 */
export const SSRF_TARGET_TEST_CASES = [
  { url: 'http://localhost:3000/api/admin', reason: 'Loopback hostname localhost' },
  { url: 'http://127.0.0.1:8080/internal', reason: 'IPv4 loopback address 127.0.0.1' },
  { url: 'http://127.0.0.2:9000', reason: 'IPv4 loopback subnet 127.0.0.0/8' },
  { url: 'http://10.0.0.1/router/config', reason: 'Class A RFC 1918 private network 10.0.0.0/8' },
  { url: 'http://172.16.0.1/intranet', reason: 'Class B RFC 1918 private network 172.16.0.0/12' },
  { url: 'http://192.168.1.1/admin', reason: 'Class C RFC 1918 private network 192.168.0.0/16' },
  { url: 'http://169.254.169.254/latest/meta-data/', reason: 'Cloud metadata / Link-local address' },
  { url: 'http://[::1]:8080/secret', reason: 'IPv6 loopback address [::1]' },
  { url: 'http://0.0.0.0:8000/', reason: 'Unspecified address 0.0.0.0' },
];

/**
 * Stream player contracts.
 */
export const EXPECTED_QUALITIES = ['144p', '240p', '360p', '480p', '720p', 'Auto'];
export const EXPECTED_PLAYBACK_SPEEDS = [0.5, 1, 1.25, 1.5, 2];
