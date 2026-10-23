# Project: Stream Event Optimization — Dual-Source & Multi-Quality Video Suite

## Architecture
The PSITS platform consists of an Express 5 backend (`server/`) and a React 19 / Vite 7 / TypeScript 5 / Tailwind CSS 3.4 frontend (`PSITS/`).
The Stream Event module provides authenticated members, officers, and administrators with a hybrid video experience supporting both direct video uploads (.mp4, .webm) and external video stream links (YouTube, Vimeo, direct HTTP/HTTPS URLs).

### Data Flow
1. **Source Configuration (Admin/Officer)**:
   - In `LiveSessionModal`, organizers select either "Upload Video File" or "External Stream Link".
   - Uploads stream raw binary buffer to `PUT /api/stream-events/:id/recording` with magic-byte verification and 30-day retention.
   - Stream links are submitted via `POST/PUT /api/stream-events` and validated on backend against XSS (`javascript:`, `data:`) and SSRF (private IPs, localhost, AWS metadata). YouTube and Vimeo links are normalized into privacy-enhanced embed URLs.
2. **Playback (All Authorized Members)**:
   - In `LiveEventsPage`, active sessions load `CustomVideoPlayer`.
   - Direct/uploaded video uses custom HTML5 player with RFC 7233 HTTP 206 range-based streaming, discrete quality selection (`144p`–`720p`), seek scrub bar, speed adjustment, volume/mute, theater mode, and fullscreen.
   - External YouTube/Vimeo streams render responsive 16:9 privacy-enhanced `<iframe>` embeds exposing native platform quality controls.
   - Seamless timestamp retention: switching quality preserves `currentTime` and playing/paused state without stream restarts.

---

## Feature Inventory
Every feature identified during the Survey phase is mapped to an assigned milestone:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Suffix & Forward Range Streaming | RFC 7233 compliant HTTP 206 partial content streaming handling `bytes=X-Y`, `bytes=X-`, and suffix `bytes=-N` with 416 bounds checking and stream error listeners | M1 | Survey (Backend) |
| 2 | URL Sanitization & SSRF Defense | Strict protocol whitelisting (`http:`, `https:` only; reject `javascript:`, `data:`, `file:`) and SSRF blocking (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`, `[::1]`) | M1 | Survey (Backend) |
| 3 | Stream Event API Route Aliasing | Bind missing `POST /api/stream-events`, `PUT /api/stream-events/:id`, and `DELETE /api/stream-events/:id` to match existing `/api/live-events` endpoints | M1 | Survey (Backend) |
| 4 | Backend Quality DTO & Range Handler | Support `?quality=` query parameter on recording stream endpoint and expose `availableQualities: ['144p','240p','360p','480p','720p','Auto']` in DTO | M1 | Survey (Backend) |
| 5 | Video Source Parser & Sanitizer | Utility `videoSource.ts` to detect type (`youtube`, `vimeo`, `direct`, `uploaded`), extract video IDs, and build privacy-enhanced embed URLs | M2 | Survey (Frontend) |
| 6 | Custom Video Player Component | Modular `CustomVideoPlayer.tsx` replacing raw `<video controls>` with custom accessible controls and embed switching | M2 | Survey (Frontend) |
| 7 | Multi-Quality Resolution Selector | Discrete quality menu (`144p`, `240p`, `360p`, `480p`, `720p`, `Auto`) with seamless timestamp and play-state preservation | M2 | Survey (Frontend) |
| 8 | Playback Speed & Custom Scrub Controls | Playback speed selection (`0.5x`, `1x`, `1.25x`, `1.5x`, `2x`), custom scrub bar with buffer bar & hover tooltips, volume slider, theater mode, and fullscreen toggle | M2 | Survey (Frontend) |
| 9 | Responsive 16:9 Embed Player | Embed renderer for YouTube (`youtube-nocookie.com/embed/`) and Vimeo with accessible `allow` permissions and fallback UI | M2 | Survey (Frontend) |
| 10 | Dual-Source Session Modal | Updated `LiveSessionModal.tsx` providing segmented selection between "Upload Video File" and "External Stream Link" with live format validation | M3 | Survey (Frontend) |
| 11 | UI/UX Design System & Theme Alignment | Obsidian theme tokens (`#0B1326`, `#171F33`, `#222A3D`), cyber cyan accents, WCAG AA contrast, and mobile/tablet/desktop responsive layouts | M3 | Survey (Frontend) |
| 12 | Visual Status Indicators | Dynamic status badges (`Live`, `Recording Replay`, `Clip Ready`, `External Stream`) on event cards and viewer | M3 | Survey (Frontend) |
| 13 | E2E Testing Suite (Tiers 1–4) | Comprehensive test suite testing all functional paths, boundary/range conditions, XSS/SSRF rejection, and user scenarios | E2E Track | Survey (Spec Miner) |
| 14 | Adversarial Coverage Hardening | Tier 5 white-box stress testing, edge-case probing, and verification | Final Milestone (Phase 2) | Dual Track |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Range Streaming & Security | RFC 7233 HTTP 206 range streaming (suffix ranges, inverted ranges, error guards), URL sanitization & SSRF protection, route aliases (`/api/stream-events`), and quality parameter support | none | PLANNED |
| M2 | Custom Multi-Quality Video Player & Embed Player | `videoSource.ts` parser/sanitizer, `CustomVideoPlayer.tsx`, discrete resolution menu (144p–720p), timestamp preservation, playback speed, theater mode, fullscreen, responsive 16:9 embeds, and unit tests | M1 contracts | PLANNED |
| M3 | Stream Event Integration & UI/UX Polish | `LiveSessionModal.tsx` dual-source toggle, `LiveEventsPage.tsx` viewer integration, dynamic status badges, obsidian dark theme alignment, WCAG AA compliance, and frontend unit tests | M2 | PLANNED |
| E2E | E2E Testing Suite (Tiers 1–4) | Opaque-box requirement-driven test harness and test cases covering all 4 tiers, publishing `TEST_READY.md` | none (parallel) | PLANNED |
| M-Final | Final Acceptance & Adversarial Hardening | Phase 1: 100% pass on E2E test suite (Tiers 1–4). Phase 2: Adversarial coverage hardening (Tier 5) with Challenger stress tests | M1, M2, M3, E2E | PLANNED |

---

## Interface Contracts

### Backend ↔ Frontend: Stream URL Validation & Session DTO
- **Request (POST/PUT `/api/stream-events` or `/api/live-events`)**:
  ```ts
  {
    title: string;
    description?: string;
    streamSource: 'external' | 'built_in';
    streamUrl?: string | null; // e.g. "https://www.youtube.com/watch?v=dQw4w9WgXcQ" or direct URL
    startAt?: string;
    endAt?: string;
    // ...
  }
  ```
- **Response (200/201)**:
  ```ts
  {
    success: true,
    data: {
      id: number;
      title: string;
      streamSource: 'external' | 'built_in';
      streamUrl: string | null;
      recordingUrl: string | null;
      availableQualities: ['144p', '240p', '360p', '480p', '720p', 'Auto'];
      // ...
    }
  }
  ```
- **Error (400 Bad Request)**:
  ```ts
  {
    success: false,
    message: string; // e.g. "Unsupported URL protocol. Only HTTP and HTTPS links are allowed." or "Private and loopback addresses are not permitted."
  }
  ```

### Backend ↔ Frontend: HTTP 206 Range Streaming
- **Request (`GET /api/stream-events/:id/recording/stream?quality=720p`)**:
  - Headers: `Range: bytes=START-END` or `Range: bytes=-SUFFIX`
- **Response (206 Partial Content)**:
  - Headers:
    - `Content-Range: bytes START-END/TOTAL_SIZE`
    - `Accept-Ranges: bytes`
    - `Content-Length: CHUNK_SIZE`
    - `Content-Type: video/mp4` (or `video/webm`)
- **Response (416 Range Not Satisfiable)**:
  - Headers: `Content-Range: bytes */TOTAL_SIZE`

### Frontend Component Contracts
- **`CustomVideoPlayerProps`**:
  ```ts
  export type VideoQuality = '144p' | '240p' | '360p' | '480p' | '720p' | 'Auto';

  export interface CustomVideoPlayerProps {
    recordingUrl?: string | null;
    streamUrl?: string | null;
    streamSource?: 'external' | 'built_in';
    title?: string;
    autoPlay?: boolean;
    sessionId?: string | number;
    onQualityChange?: (quality: VideoQuality) => void;
  }
  ```
- **`ParsedVideoSource`**:
  ```ts
  export type VideoSourceType = 'youtube' | 'vimeo' | 'direct' | 'uploaded' | 'unknown';

  export interface ParsedVideoSource {
    type: VideoSourceType;
    embedUrl: string | null;
    videoId: string | null;
    isValid: boolean;
    errorMessage?: string;
  }
  ```

---

## Code Layout
```
server/
├── liveEvents.js                   # M1: validateAndSanitizeStreamUrl, streamLiveEventRecording RFC 7233 range parser, DTO update
└── index.js                        # M1: /api/stream-events CRUD route aliases

PSITS/src/features/live-events/
├── utils/
│   ├── videoSource.ts              # M2: URL parser, regex patterns, sanitization, embed generator
│   └── formatTime.ts               # M2: Duration and timestamp formatter (mm:ss / hh:mm:ss)
├── components/
│   ├── CustomVideoPlayer.tsx       # M2: Multi-quality custom video player & embed renderer
│   ├── VideoPlayerControls.tsx     # M2: Accessible controls: scrub bar, speed, volume, quality menu, theater, fullscreen
│   ├── VideoStatusBadge.tsx        # M3: Dynamic status indicators (Live, Recording Replay, Clip Ready, Stream Link)
│   └── LiveSessionModal.tsx        # M3: Dual-source modal (Upload Video Clip vs External Stream Link)
├── pages/
│   └── LiveEventsPage.tsx          # M3: Viewer integration, theater mode layout, activeSession state
└── types/
    └── liveSessions.ts             # M2/M3: VideoQuality, ParsedVideoSource, and updated form state types

tests/e2e/                          # E2E Testing Track: 4-tier test runner and test cases
```
