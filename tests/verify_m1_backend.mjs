import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const { validateAndSanitizeStreamUrl, toLiveEventDto } = require('../server/liveEvents');

console.log('=== Milestone 1 Backend Verification Suite ===\n');

// 1. Check server/index.js route aliases
console.log('1. Checking route aliases in server/index.js...');
const serverIndexContent = fs.readFileSync(path.join(projectRoot, 'server', 'index.js'), 'utf8');
const requiredRoutes = [
  "app.post('/api/stream-events'",
  "app.put('/api/stream-events/:id'",
  "app.delete('/api/stream-events/:id'",
  "app.post('/api/stream-events/:id/start'",
  "app.post('/api/stream-events/:id/end'",
  "app.post('/api/stream-events/:id/cancel'",
  "app.post('/api/stream-events/:id/join'",
  "app.post('/api/stream-events/:id/leave'",
  "app.get('/api/stream-events/:id/participants'",
  "app.get('/api/stream-events/:id/counts'",
  "app.get('/api/stream-events/:id/chat'",
  "app.post('/api/stream-events/:id/chat'"
];

for (const route of requiredRoutes) {
  assert(serverIndexContent.includes(route), `Missing expected route in server/index.js: ${route}`);
}
console.log('   All /api/stream-events route aliases verified successfully.\n');

// 2. Test URL Validation & SSRF Prevention
console.log('2. Testing URL Validation & SSRF Protection...');

// Valid YouTube URLs
const validYouTube = [
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'dQw4w9WgXcQ'],
  ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ['https://youtu.be/dQw4w9WgXcQ?feature=share', 'dQw4w9WgXcQ'],
  ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ['https://www.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ['https://www.youtube.com/v/dQw4w9WgXcQ', 'dQw4w9WgXcQ']
];

for (const [url, expectedId] of validYouTube) {
  const res = validateAndSanitizeStreamUrl(url);
  assert.strictEqual(res.ok, true, `Should accept valid YouTube URL: ${url}`);
  assert.strictEqual(res.type, 'youtube');
  assert.strictEqual(res.videoId, expectedId);
  assert.strictEqual(res.embedUrl, `https://www.youtube-nocookie.com/embed/${expectedId}`);
}
console.log('   YouTube normalization verified across 9 URL variants.');

// Valid Vimeo URLs
const validVimeo = [
  ['https://vimeo.com/76979871', '76979871'],
  ['https://www.vimeo.com/76979871', '76979871'],
  ['https://player.vimeo.com/video/76979871', '76979871'],
  ['https://vimeo.com/channels/staffpicks/76979871', '76979871'],
  ['https://vimeo.com/groups/motion/videos/76979871', '76979871']
];

for (const [url, expectedId] of validVimeo) {
  const res = validateAndSanitizeStreamUrl(url);
  assert.strictEqual(res.ok, true, `Should accept valid Vimeo URL: ${url}`);
  assert.strictEqual(res.type, 'vimeo');
  assert.strictEqual(res.videoId, expectedId);
  assert.strictEqual(res.embedUrl, `https://player.vimeo.com/video/${expectedId}`);
}
console.log('   Vimeo normalization verified across 5 URL variants.');

// Direct Video URLs
const directVideos = [
  'https://cdn.example.com/videos/keynote-2026.mp4',
  'https://media.org/stream.webm',
  'https://video.psits.org/hls/master.m3u8',
  '/uploads/live-recordings/test-video.mp4',
  '/api/stream-events/101/recording/stream'
];

for (const url of directVideos) {
  const res = validateAndSanitizeStreamUrl(url);
  assert.strictEqual(res.ok, true, `Should accept direct video: ${url}`);
  assert.strictEqual(res.type, 'direct');
}
console.log('   Direct video URLs and relative uploads verified.');

// Malicious Schemes (XSS, Script Injection)
const dangerousSchemes = [
  'javascript:alert(1)',
  'javascript:/*--></title></style></textarea>*/<script>alert(1)</script>',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'file:///etc/shadow',
  'file:///C:/Windows/win.ini',
  'vbscript:msgbox("pwnd")',
  'blob:https://example.com/uuid-here'
];

for (const s of dangerousSchemes) {
  const res = validateAndSanitizeStreamUrl(s);
  assert.strictEqual(res.ok, false, `Dangerous scheme must be rejected: ${s}`);
}
console.log('   7 malicious protocol injection vectors blocked.');

// SSRF Targets (Loopback, RFC 1918, Cloud Metadata, IPv6)
const ssrfTargets = [
  'http://localhost:3000/api/admin',
  'http://127.0.0.1:3306/',
  'http://127.0.0.2:8080/',
  'http://0.0.0.0:8000/',
  'http://[::1]:8080/secret',
  'http://169.254.169.254/latest/meta-data/',
  'http://10.0.0.1/internal-db',
  'http://10.255.255.254/',
  'http://172.16.0.1/metrics',
  'http://172.24.1.1/config',
  'http://172.31.255.255/',
  'http://192.168.0.1/router',
  'http://192.168.1.100/nas',
  'http://backend.localhost/',
  'http://internal-host.local/',
  'http://cluster.internal/',
  'http://2130706433/', // Integer notation of 127.0.0.1
  'http://0x7f000001/'  // Hex notation of 127.0.0.1
];

for (const u of ssrfTargets) {
  const res = validateAndSanitizeStreamUrl(u);
  assert.strictEqual(res.ok, false, `SSRF target must be rejected: ${u}`);
}
console.log('   18 SSRF targets (loopback, private, metadata, hex/int IPs) blocked.\n');

// 3. Test toLiveEventDto
console.log('3. Testing toLiveEventDto...');
const sampleRow = {
  id: 42,
  session_identifier: 'LS-TEST-ABCD',
  title: 'Annual Tech Summit',
  stream_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  stream_source: 'external',
  recording_url: '/uploads/live-recordings/summit.mp4',
  duration_minutes: 90
};

const dto = toLiveEventDto(sampleRow);
assert.deepStrictEqual(dto.availableQualities, ['144p', '240p', '360p', '480p', '720p', 'Auto']);
assert.strictEqual(dto.embedUrl, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
assert.strictEqual(dto.title, 'Annual Tech Summit');

const builtInRow = {
  id: 43,
  session_identifier: 'LS-BUILTIN-1234',
  title: 'Internal Workshop',
  stream_url: '/api/stream-events/43/recording/stream',
  stream_source: 'built_in'
};
const builtInDto = toLiveEventDto(builtInRow);
assert.strictEqual(builtInDto.embedUrl, null);
assert.deepStrictEqual(builtInDto.availableQualities, ['144p', '240p', '360p', '480p', '720p', 'Auto']);
console.log('   toLiveEventDto contract verified with availableQualities and embedUrl.\n');

console.log('====================================================');
console.log('  ALL BACKEND MILESTONE 1 VERIFICATIONS PASSED!     ');
console.log('====================================================');
