/**
 * http-client.mjs
 * HTTP client utility for Stream Event E2E verification.
 */

import http from 'node:http';
import https from 'node:https';

export class HttpClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async request(method, path, options = {}) {
    const targetUrl = new URL(path.startsWith('http') ? path : `${this.baseUrl}${path}`);
    const isHttps = targetUrl.protocol === 'https:';
    const transport = isHttps ? https : http;

    const headers = {
      ...(options.headers || {}),
    };

    let bodyData = null;
    if (options.body) {
      if (Buffer.isBuffer(options.body)) {
        bodyData = options.body;
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/octet-stream';
        headers['Content-Length'] = bodyData.length;
      } else if (typeof options.body === 'object') {
        bodyData = Buffer.from(JSON.stringify(options.body), 'utf8');
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = bodyData.length;
      } else if (typeof options.body === 'string') {
        bodyData = Buffer.from(options.body, 'utf8');
        headers['Content-Length'] = bodyData.length;
      }
    }

    const reqOptions = {
      method: method.toUpperCase(),
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      headers,
    };

    return new Promise((resolve, reject) => {
      const req = transport.request(reqOptions, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const rawBuffer = Buffer.concat(chunks);
          const rawText = rawBuffer.toString('utf8');
          let json = null;
          try {
            json = rawText ? JSON.parse(rawText) : null;
          } catch {
            // Not JSON
          }

          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            rawBuffer,
            rawText,
            json,
            contentRange: res.headers['content-range'] || null,
            contentLength: res.headers['content-length'] ? parseInt(res.headers['content-length'], 10) : null,
            contentType: res.headers['content-type'] || null,
            acceptRanges: res.headers['accept-ranges'] || null,
          });
        });
      });

      req.on('error', reject);

      if (bodyData) {
        req.write(bodyData);
      }
      req.end();
    });
  }

  async get(path, headers = {}) {
    return this.request('GET', path, { headers });
  }

  async getRange(path, rangeHeader, extraHeaders = {}) {
    return this.request('GET', path, {
      headers: {
        Range: rangeHeader,
        ...extraHeaders,
      },
    });
  }

  async head(path, headers = {}) {
    return this.request('HEAD', path, { headers });
  }

  async postJson(path, data, headers = {}) {
    return this.request('POST', path, { body: data, headers });
  }

  async putBinary(path, buffer, headers = {}) {
    return this.request('PUT', path, { body: buffer, headers });
  }

  async delete(path, headers = {}) {
    return this.request('DELETE', path, { headers });
  }
}
