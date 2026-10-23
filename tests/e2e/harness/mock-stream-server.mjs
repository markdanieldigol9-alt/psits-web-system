/**
 * mock-stream-server.mjs
 * Reference contract server implementing RFC 7233 Range streaming, magic-byte upload validation,
 * URL sanitization, and SSRF filtering for hermetic E2E test execution.
 */

import http from 'node:http';
import { createValidMp4Buffer } from './fixtures.mjs';

export function isPrivateOrLoopbackHost(hostname) {
  const host = String(hostname || '').toLowerCase().trim();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan')
  ) {
    return true;
  }

  // Check 127.0.0.0/8
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  // Check 10.0.0.0/8
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  // Check 192.168.0.0/16
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  // Check 169.254.0.0/16 (Link-local & AWS metadata)
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  // Check 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  const m172 = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (m172) {
    const second = parseInt(m172[1], 10);
    if (second >= 16 && second <= 31) return true;
  }

  return false;
}

export function isValidVideoBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) return false;
  // MP4 / MOV brand identifiers
  const brand = buffer.slice(4, 8).toString('ascii');
  if (brand === 'ftyp' || brand === 'moov' || brand === 'mdat' || brand === 'skip' || brand === 'wide') {
    return true;
  }
  // WebM EBML header
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return true;
  }
  return false;
}

export function createMockStreamServer(options = {}) {
  const streamData = options.streamData || createValidMp4Buffer(options.streamSize || 65536);
  const streamSize = streamData.length;
  let activeRecording = streamData;

  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();

    // CORS and range exposure headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Authorization, Content-Type, Accept, Origin, X-Filename');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    // 1. Video streaming endpoint: /api/stream-events/:id/recording/stream
    if (pathname.includes('/recording/stream')) {
      const mimeType = 'video/mp4';
      res.setHeader('Accept-Ranges', 'bytes');

      if (method === 'HEAD') {
        res.writeHead(200, {
          'Content-Length': activeRecording.length,
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes',
        });
        return res.end();
      }

      if (method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: 'Method not allowed' }));
      }

      const rangeHeader = req.headers.range;
      const fileSize = activeRecording.length;

      if (!rangeHeader) {
        // Full content request
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes',
        });
        return res.end(activeRecording);
      }

      // RFC 7233 range parsing
      const match = rangeHeader.match(/bytes=([0-9]*)-([0-9]*)/);
      if (!match) {
        res.writeHead(416, {
          'Content-Range': `bytes */${fileSize}`,
          'Content-Type': 'application/json',
        });
        return res.end(JSON.stringify({ success: false, message: 'Invalid range syntax' }));
      }

      const [, startStr, endStr] = match;
      let start;
      let end;

      if (startStr === '' && endStr !== '') {
        // Suffix range: bytes=-N (last N bytes)
        const suffixLength = parseInt(endStr, 10);
        if (suffixLength <= 0) {
          res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
          return res.end();
        }
        start = Math.max(0, fileSize - suffixLength);
        end = fileSize - 1;
      } else if (startStr !== '' && endStr === '') {
        // Open-ended range: bytes=N-
        start = parseInt(startStr, 10);
        end = fileSize - 1;
      } else if (startStr !== '' && endStr !== '') {
        // Explicit range: bytes=N-M
        start = parseInt(startStr, 10);
        end = parseInt(endStr, 10);
      } else {
        res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
        return res.end();
      }

      // Out-of-bounds or inverted range check
      if (start >= fileSize || end >= fileSize || start > end || start < 0) {
        res.writeHead(416, {
          'Content-Range': `bytes */${fileSize}`,
          'Content-Type': 'application/json',
        });
        return res.end(JSON.stringify({ success: false, message: 'Range not satisfiable' }));
      }

      const chunkSize = end - start + 1;
      const chunk = activeRecording.subarray(start, end + 1);

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      });
      return res.end(chunk);
    }

    // 2. Video upload endpoint: PUT /api/stream-events/:id/recording
    if (pathname.includes('/recording') && method === 'PUT') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        if (!body.length) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: 'Recording upload body is empty.' }));
        }

        if (!isValidVideoBuffer(body)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: false,
              message: 'Invalid or unsupported video file header. Please upload a standard MP4, WebM, or QuickTime file.',
            })
          );
        }

        activeRecording = body;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            success: true,
            liveEvent: {
              id: 101,
              recordingEnabled: 1,
              recordingUrl: '/api/stream-events/101/recording/stream',
              sizeBytes: body.length,
              availableQualities: ['144p', '240p', '360p', '480p', '720p', 'Auto'],
            },
          })
        );
      });
      return;
    }

    // 3. Stream event creation / update with URL validation: POST or PUT /api/stream-events
    if ((pathname === '/api/stream-events' || pathname.startsWith('/api/stream-events/')) && (method === 'POST' || method === 'PUT')) {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        let payload = {};
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          payload = {};
        }

        const streamUrl = payload.streamUrl;
        if (streamUrl) {
          let parsed;
          try {
            parsed = new URL(streamUrl);
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, message: 'Invalid URL format.' }));
          }

          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(
              JSON.stringify({
                success: false,
                message: 'Invalid URL protocol. Only http: and https: are allowed.',
              })
            );
          }

          if (isPrivateOrLoopbackHost(parsed.hostname)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(
              JSON.stringify({
                success: false,
                message: 'Private network or local addresses are not permitted.',
              })
            );
          }
        }

        res.writeHead(method === 'POST' ? 201 : 200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            success: true,
            data: {
              id: 101,
              title: payload.title || 'Stream Event Test',
              streamSource: payload.streamSource || 'external',
              streamUrl: streamUrl || null,
              availableQualities: ['144p', '240p', '360p', '480p', '720p', 'Auto'],
            },
          })
        );
      });
      return;
    }

    // 4. Session details endpoint: GET /api/stream-events/:id
    if (pathname.startsWith('/api/stream-events/') && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(
        JSON.stringify({
          success: true,
          data: {
            id: 101,
            title: 'Annual PSITS Conference 2026',
            streamSource: 'external',
            streamUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            recordingUrl: '/api/stream-events/101/recording/stream',
            availableQualities: ['144p', '240p', '360p', '480p', '720p', 'Auto'],
          },
        })
      );
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Not found' }));
  });

  return {
    server,
    start: () =>
      new Promise((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => {
          const addr = server.address();
          const baseUrl = `http://127.0.0.1:${addr.port}`;
          resolve({ server, port: addr.port, baseUrl });
        });
        server.on('error', reject);
      }),
    stop: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
    getRecording: () => activeRecording,
  };
}
