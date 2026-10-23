#!/usr/bin/env node

/**
 * run-all.mjs
 * Comprehensive Standalone E2E Test Runner for PSITS Stream Event Module.
 * Covers all 4 Tiers:
 * - Tier 1: Feature Coverage (Uploads, YouTube/Vimeo/Direct detection, Qualities & Speeds)
 * - Tier 2: Boundary & Corner Cases (RFC 7233 HTTP 206 Ranges, Retention, NaN duration)
 * - Tier 3: Cross-Feature & Security Cases (XSS URL Schemes, SSRF Defense, Magic Bytes)
 * - Tier 4: Real-World Workload Scenarios (Burst Scrubbing, Quality Transitions, Concurrency)
 *
 * Usage:
 *   node tests/e2e/run-all.mjs
 *   node tests/e2e/run-all.mjs --tap
 *   node tests/e2e/run-all.mjs --url http://127.0.0.1:3000
 */

import { TestRunner } from './harness/test-framework.mjs';
import { createMockStreamServer } from './harness/mock-stream-server.mjs';
import { HttpClient } from './harness/http-client.mjs';
import { runTier1Tests } from './tier1-feature-coverage.test.mjs';
import { runTier2Tests } from './tier2-boundary-streaming.test.mjs';
import { runTier3Tests } from './tier3-security-sanitization.test.mjs';
import { runTier4Tests } from './tier4-real-workloads.test.mjs';

async function main() {
  const args = process.argv.slice(2);
  const isTapMode = args.includes('--tap');
  const urlArgIndex = args.indexOf('--url');
  const targetUrl = urlArgIndex !== -1 ? args[urlArgIndex + 1] : process.env.API_BASE_URL;

  const runner = new TestRunner({
    name: 'PSITS Stream Event Module — E2E Test Suite (Tiers 1–4)',
    tapMode: isTapMode,
  });

  runner.start();

  let serverInstance = null;
  let baseUrl = targetUrl;

  if (!baseUrl) {
    // Start self-contained hermetic reference stream server on dynamic port
    serverInstance = createMockStreamServer({ streamSize: 65536 });
    const { baseUrl: startedUrl } = await serverInstance.start();
    baseUrl = startedUrl;
  }

  const client = new HttpClient(baseUrl);

  try {
    // Tier 1: Feature Coverage
    await runTier1Tests(runner, client);

    // Tier 2: Boundary & Corner Cases
    await runTier2Tests(runner, client, serverInstance);

    // Tier 3: Cross-Feature & Security Cases
    await runTier3Tests(runner, client);

    // Tier 4: Real-World Workload Scenarios
    await runTier4Tests(runner, client, serverInstance);
  } finally {
    if (serverInstance) {
      await serverInstance.stop();
    }
  }

  const summary = runner.finish();
  process.exit(summary.exitCode);
}

main().catch((err) => {
  console.error('Fatal E2E runner execution error:', err);
  process.exit(1);
});
