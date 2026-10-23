/**
 * tier3-security-sanitization.test.mjs
 * Tier 3: Cross-Feature & Security Cases E2E Tests
 * Validates external URL sanitization, XSS scheme rejection (javascript:, data:, file:, vbscript:),
 * SSRF protection (loopback, RFC 1918 private subnets, cloud metadata 169.254.169.254, IPv6 loopback),
 * and binary magic byte verification rejecting disguised non-video files.
 */

import { assert, assertEqual } from './harness/test-framework.mjs';
import {
  MALICIOUS_SCHEME_TEST_CASES,
  SSRF_TARGET_TEST_CASES,
  createInvalidVideoBuffer,
} from './harness/fixtures.mjs';
import { parseVideoSource } from './harness/video-source-spec.mjs';

export async function runTier3Tests(runner, client) {
  runner.suite('Tier 3 — Cross-Feature & Security Cases (URL Sanitization & SSRF Defense)');

  // TC3.1: URL Sanitization Rejects Dangerous Schemes via API
  await runner.test('TC3.1: Server API strictly rejects malicious URL schemes with HTTP 400', async () => {
    for (const tc of MALICIOUS_SCHEME_TEST_CASES) {
      const res = await client.postJson('/api/stream-events', {
        title: `Malicious Scheme Test: ${tc.description}`,
        streamSource: 'external',
        streamUrl: tc.url,
      });

      assertEqual(res.status, 400, `Expected HTTP 400 rejecting ${tc.url}`);
      assert(res.json && res.json.success === false, 'Expected success: false in API response');
      assert(
        res.json.message.includes('Invalid URL protocol') || res.json.message.includes('Invalid URL format'),
        `Expected protocol validation error message, got: ${res.json.message}`
      );
    }
  });

  // TC3.2: URL Sanitization in Client-Side Parser
  await runner.test('TC3.2: Client-side video source parser flags dangerous schemes as invalid', async () => {
    for (const tc of MALICIOUS_SCHEME_TEST_CASES) {
      const parsed = parseVideoSource(tc.url);
      assertEqual(parsed.isValid, false, `Expected isValid = false for scheme in ${tc.url}`);
      assertEqual(parsed.type, 'unknown', `Expected type unknown for dangerous scheme ${tc.url}`);
      assert(parsed.errorMessage, 'Expected descriptive error message for dangerous scheme');
    }
  });

  // TC3.3: SSRF Protection Rejects Localhost and Loopback Addresses
  await runner.test('TC3.3: SSRF filter blocks localhost, 127.0.0.1, and 127.0.0.0/8 loopback subnet with HTTP 400', async () => {
    const loopbacks = SSRF_TARGET_TEST_CASES.filter((c) => c.url.includes('localhost') || c.url.includes('127.0.'));

    for (const tc of loopbacks) {
      const res = await client.postJson('/api/stream-events', {
        title: `SSRF Test: ${tc.reason}`,
        streamSource: 'external',
        streamUrl: tc.url,
      });

      assertEqual(res.status, 400, `Expected HTTP 400 blocking SSRF target ${tc.url}`);
      assert(res.json && res.json.success === false, 'Expected success: false');
      assert(
        res.json.message.includes('Private network or local addresses are not permitted'),
        `Expected SSRF rejection error message, got: ${res.json.message}`
      );
    }
  });

  // TC3.4: SSRF Protection Rejects RFC 1918 Private Subnets
  await runner.test('TC3.4: SSRF filter blocks RFC 1918 private subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)', async () => {
    const privates = SSRF_TARGET_TEST_CASES.filter(
      (c) => c.url.includes('10.0.0.1') || c.url.includes('172.16.0.1') || c.url.includes('192.168.1.1')
    );

    for (const tc of privates) {
      const res = await client.postJson('/api/stream-events', {
        title: `SSRF Test: ${tc.reason}`,
        streamSource: 'external',
        streamUrl: tc.url,
      });

      assertEqual(res.status, 400, `Expected HTTP 400 blocking private network ${tc.url}`);
      assert(res.json.message.includes('Private network or local addresses are not permitted'), 'Expected SSRF error');
    }
  });

  // TC3.5: SSRF Protection Rejects Cloud Metadata IP
  await runner.test('TC3.5: SSRF filter blocks AWS/Cloud metadata IP (169.254.169.254)', async () => {
    const metadataTc = SSRF_TARGET_TEST_CASES.find((c) => c.url.includes('169.254.169.254'));

    const res = await client.postJson('/api/stream-events', {
      title: 'SSRF Cloud Metadata Probe',
      streamSource: 'external',
      streamUrl: metadataTc.url,
    });

    assertEqual(res.status, 400, 'Expected HTTP 400 blocking cloud metadata IP');
    assert(res.json && res.json.success === false, 'Expected success: false');
    assert(
      res.json.message.includes('Private network or local addresses are not permitted'),
      'Expected private/link-local address rejection'
    );
  });

  // TC3.6: SSRF Protection Rejects IPv6 Loopback
  await runner.test('TC3.6: SSRF filter blocks IPv6 loopback ([::1])', async () => {
    const ipv6Tc = SSRF_TARGET_TEST_CASES.find((c) => c.url.includes('[::1]'));

    const res = await client.postJson('/api/stream-events', {
      title: 'SSRF IPv6 Probe',
      streamSource: 'external',
      streamUrl: ipv6Tc.url,
    });

    assertEqual(res.status, 400, 'Expected HTTP 400 blocking IPv6 loopback');
    assert(res.json.message.includes('Private network or local addresses are not permitted'), 'Expected rejection message');
  });

  // TC3.7: Binary Magic Byte Verification Rejects Disguised Executable (.exe as .mp4)
  await runner.test('TC3.7: Binary magic byte verification rejects Windows PE executable disguised as .mp4', async () => {
    const exeBuffer = createInvalidVideoBuffer('executable');
    const res = await client.putBinary('/api/stream-events/101/recording', exeBuffer, {
      'Content-Type': 'video/mp4',
      'X-Filename': 'exploit.mp4',
    });

    assertEqual(res.status, 400, 'Expected HTTP 400 on disguised executable');
    assert(res.json && res.json.success === false, 'Expected success: false');
    assert(
      res.json.message.includes('Invalid or unsupported video file header'),
      'Expected invalid header error message'
    );
  });

  // TC3.8: Binary Magic Byte Verification Rejects Empty Uploads
  await runner.test('TC3.8: Binary upload rejects zero-byte payload with HTTP 400', async () => {
    const emptyBuffer = createInvalidVideoBuffer('empty');
    const res = await client.putBinary('/api/stream-events/101/recording', emptyBuffer, {
      'Content-Type': 'video/mp4',
      'X-Filename': 'empty.mp4',
    });

    assertEqual(res.status, 400, 'Expected HTTP 400 on empty upload body');
    assert(res.json && res.json.success === false, 'Expected success: false');
    assert(
      res.json.message.includes('empty'),
      'Expected empty body message'
    );
  });
}
