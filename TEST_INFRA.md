# PSITS Stream Event Module — Test Infrastructure & Methodology (`TEST_INFRA.md`)

## 1. Overview & Architecture

The E2E Test Suite for the PSITS Stream Event Module provides a standalone, opaque-box testing harness designed to validate all 4 tiers of video streaming, URL parsing, security filtering, and player state management specified in `PROJECT.md` and `ORIGINAL_REQUEST.md`.

### Key Design Tenets
1. **Zero External Dependencies**: Built entirely on native Node.js (`node:http`, `node:crypto`, `node:assert`, `Buffer`, `performance`). Runs cleanly in any CI/CD environment without requiring heavy browser binaries or third-party test runners.
2. **Hermetic & Standalone**: Employs an in-process RFC 7233 compliant reference server running on ephemeral ports (`server.listen(0)`). Tests execute deterministically without requiring a live database or external network access.
3. **Dual Execution Target**:
   - **Hermetic Mode (Default)**: Automatically boots the embedded reference server and tests the exact protocol contracts.
   - **Target Mode (`--url <URL>` or `API_BASE_URL`)**: Runs the same test suite directly against a live staging or production backend.
4. **Structured & TAP v13 Reporting**: Outputs human-readable colorized terminal summaries or machine-readable TAP v13 streams (`--tap`) with exit code 0 on success and exit code 1 on failure.

---

## 2. Directory Layout & Module Structure

```
tests/e2e/
├── run-all.mjs                         # Master E2E runner with CLI flag parsing and exit code handling
├── harness/
│   ├── test-framework.mjs              # Custom test runner, TAP v13 emitter, and assertion engine
│   ├── mock-stream-server.mjs          # Reference HTTP server with RFC 7233 byte-range, upload, & security filters
│   ├── http-client.mjs                 # Network client supporting range requests, binary uploads, and HEAD calls
│   ├── fixtures.mjs                    # Magic byte generators, synthetic stream payloads, and URL vectors
│   └── video-source-spec.mjs           # Reference parser for YouTube/Vimeo/Direct detection & embed URLs
├── tier1-feature-coverage.test.mjs     # Tier 1: Direct upload validation, URL extraction, quality & speed contracts
├── tier2-boundary-streaming.test.mjs   # Tier 2: HTTP 206 range variants, out-of-bounds 416, state retention, NaN duration
├── tier3-security-sanitization.test.mjs # Tier 3: Malicious URL schemes, SSRF IP filtering, magic byte enforcement
└── tier4-real-workloads.test.mjs       # Tier 4: Burst scrub workloads, quality transition chains, concurrency
```

---

## 3. 4-Tier Test Matrix & Feature Inventory

| Tier | Test Case | Category | Specification / Assertion |
|---|---|---|---|
| **Tier 1** | TC1.1 | Upload Validation | Direct video upload accepts valid `.mp4` buffer with `ftyp` box at offset 4 |
| **Tier 1** | TC1.2 | Upload Validation | Direct video upload accepts valid `.webm` buffer with EBML header (`0x1A 0x45 0xDF 0xA3`) |
| **Tier 1** | TC1.3 | Upload Validation | Direct upload rejects non-video binary disguised as `.mp4` with HTTP 400 |
| **Tier 1** | TC1.4 | URL Detection | YouTube standard watch URL (`youtube.com/watch?v=...`) detected; ID extracted; embed URL generated |
| **Tier 1** | TC1.5 | URL Detection | YouTube short (`youtu.be/...`) and shorts (`youtube.com/shorts/...`) detected and normalized |
| **Tier 1** | TC1.6 | URL Detection | YouTube embed URL (`youtube.com/embed/...`) parsed into privacy-enhanced embed format |
| **Tier 1** | TC1.7 | URL Detection | Vimeo standard, channel, and player URLs detected; numerical ID extracted; embed normalized |
| **Tier 1** | TC1.8 | URL Detection | Direct HTTPS video stream URL (`.mp4`, `.webm`) identified as `direct` source |
| **Tier 1** | TC1.9 | Player Contract | Available qualities contract matches discrete list: `['144p', '240p', '360p', '480p', '720p', 'Auto']` |
| **Tier 1** | TC1.10 | Player Contract | Playback speeds contract matches discrete list: `[0.5, 1, 1.25, 1.5, 2]` |
| **Tier 2** | TC2.1 | RFC 7233 Range | Forward byte range `Range: bytes=0-1023` -> HTTP 206, `Content-Range: bytes 0-1023/size`, `Content-Length: 1024`, exact byte match |
| **Tier 2** | TC2.2 | RFC 7233 Range | Mid-file range `Range: bytes=1024-2047` -> HTTP 206, `Content-Range: bytes 1024-2047/size`, `Content-Length: 1024` |
| **Tier 2** | TC2.3 | RFC 7233 Range | Open-ended range `Range: bytes=2048-` -> HTTP 206 streaming from offset 2048 to EOF |
| **Tier 2** | TC2.4 | RFC 7233 Range | Suffix range `Range: bytes=-500` -> HTTP 206 streaming final 500 bytes of the video |
| **Tier 2** | TC2.5 | RFC 7233 Range | Out-of-bounds start `Range: bytes=999999999-` -> HTTP 416 with `Content-Range: bytes */size` |
| **Tier 2** | TC2.6 | RFC 7233 Range | Inverted range `Range: bytes=2000-1000` -> HTTP 416 Range Not Satisfiable |
| **Tier 2** | TC2.7 | RFC 7233 Range | Missing Range header -> HTTP 200 with full stream body and `Accept-Ranges: bytes` |
| **Tier 2** | TC2.8 | RFC 7233 Range | HTTP `HEAD` request -> HTTP 200 with headers and 0-byte body |
| **Tier 2** | TC2.9 | State Retention | Quality switch while paused at timestamp 42.5s retains exact `currentTime` and paused state |
| **Tier 2** | TC2.10 | State Retention | Quality switch while playing at timestamp 120.0s retains exact `currentTime` and active playback |
| **Tier 2** | TC2.11 | Duration Resilience | Zero and `NaN` duration edge cases render `00:00` safely without divide-by-zero or crashes |
| **Tier 3** | TC3.1 | Security / XSS | Server API strictly rejects `javascript:`, `data:`, `file:`, `vbscript:`, `blob:` with HTTP 400 |
| **Tier 3** | TC3.2 | Security / XSS | Client-side video source parser flags dangerous schemes as invalid with descriptive error |
| **Tier 3** | TC3.3 | Security / SSRF | SSRF filter blocks `localhost`, `127.0.0.1`, and `127.0.0.0/8` loopback addresses |
| **Tier 3** | TC3.4 | Security / SSRF | SSRF filter blocks RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) |
| **Tier 3** | TC3.5 | Security / SSRF | SSRF filter blocks AWS/Cloud metadata IP `http://169.254.169.254/latest/meta-data/` |
| **Tier 3** | TC3.6 | Security / SSRF | SSRF filter blocks IPv6 loopback `http://[::1]:8080` |
| **Tier 3** | TC3.7 | Security / Magic Bytes | Upload rejects disguised Windows PE executable (`.exe` renamed to `.mp4`) with HTTP 400 |
| **Tier 3** | TC3.8 | Security / Magic Bytes | Upload rejects 0-byte empty payload with HTTP 400 |
| **Tier 4** | TC4.1 | Stress Workloads | Rapid multi-seeking scrub workload (15 successive range requests) completes under 2000ms SLA without hangs |
| **Tier 4** | TC4.2 | Real-World Workload | Sequential multi-quality transitions (`720p` -> `360p` -> `Auto` -> `480p`) retain state across all steps |
| **Tier 4** | TC4.3 | Concurrency | Concurrent multi-client streaming (10 parallel clients) processes range requests without chunk cross-talk |
| **Tier 4** | TC4.4 | Error Recovery | Immediate recovery to valid 206 streaming following a 416 out-of-bounds error |

---

## 4. Execution Commands

### Standard Execution (Colorized Summary)
```bash
node tests/e2e/run-all.mjs
```

### TAP v13 Output (CI/CD Pipeline Integration)
```bash
node tests/e2e/run-all.mjs --tap
```

### Target a Live Backend Server
```bash
node tests/e2e/run-all.mjs --url http://127.0.0.1:3000
# OR
API_BASE_URL=https://psits-web-system.onrender.com/api node tests/e2e/run-all.mjs
```

---

## 5. Quality Thresholds & SLAs

1. **Pass Rate**: 100% of tests must pass (33 of 33 tests).
2. **Byte Fidelity**: Byte chunks returned in HTTP 206 range responses must match the source data slice with 100% bitwise equality (`Buffer.equals()`).
3. **Scrub Latency SLA**: Rapid 15-seek burst scrubbing must complete in under 2000ms.
4. **Protocol Compliance**: RFC 7233 range syntax rules, `Content-Range`, `Content-Length`, `Accept-Ranges`, and 416 responses strictly enforced.
5. **Security Defenses**: Zero SSRF or XSS URL schemes permitted across all endpoints.
