# IPTV Player — Project Rules

## What this project is
A modern IPTV player web app built with React. Users connect with Xtream Codes credentials, and the app plays Live TV, Movies, and Series in the browser. The app is designed to also work on TV browsers (Fire TV Silk, Android TV Bro) using keyboard/remote navigation. In the future it will be ported to React Native for native Android TV / Fire TV apps.

## The user
The project owner has no prior coding experience. AI writes the code. Write clean, commented, production-quality code without experimental patterns.

## Tech stack (do not substitute without asking)
- Build tool: Vite
- Framework: React 18 with TypeScript
- Styling: Tailwind CSS v3
- Routing: React Router v6
- State: Zustand
- Data fetching/caching: TanStack Query v5
- Local storage: Dexie.js with dexie-react-hooks
- Video player: mpegts.js (for MPEG-TS live streams)
- Virtualization: @tanstack/react-virtual
- M3U parsing: iptv-playlist-parser (not yet installed; post-MVP)
- Icons: lucide-react

## Architecture rules
- Folder structure: src/components, src/pages, src/stores, src/lib, src/types, src/hooks
- One component per file. PascalCase filenames for components, camelCase for utilities.
- TypeScript strict, avoid `any`
- Zustand for global state, never Context/Redux
- TanStack Query for async data (no raw useEffect + fetch)
- All styling in Tailwind classes, no CSS files
- Components under 200 lines; split if larger

## UI rules
- Dark theme only
- TV-friendly: Tab + Arrow keys work everywhere, visible focus rings
- Minimum font size 16px, buttons minimum 44px tall
- Mobile responsive by default
- No hover-only interactions — every hover has a focus equivalent

## Critical technical constraints (learned the hard way)

### React Strict Mode is DISABLED in this project
Located in src/main.tsx. Do NOT re-enable. It conflicts with media libraries (mpegts.js) that manage their own lifecycle.

### Credentials lifecycle
- Stored encrypted in IndexedDB (AES-GCM 256-bit)
- Decrypted ONCE by playlistStore.loadSourcesFromDb() on app start
- Exposed DECRYPTED via getActiveSource() — callers must NOT call decryptString() again
- Never log credentials, even in error messages

### UUID generation
Use generateId() from src/lib/uuid — crypto.randomUUID() fails in non-secure contexts (LAN IPs). generateId() falls back to crypto.getRandomValues() which works everywhere.

### Vite environment variables
In vite.config.ts, use `loadEnv(mode, process.cwd(), '')` — never `process.env.X` directly. The latter doesn't read .env.local.

### HTTP response bodies
A response body can only be read ONCE. Always read into a variable first, then parse. Never call both .json() and .text() on the same response.

### Video playback
- Chrome blocks autoplay without user interaction
- Always provide a user-click-to-play button on first load
- Pattern: setup player on mount, but call player.play() or video.play() only from an onClick handler
- For live streams, use mpegts.createPlayer with { type: 'mpegts', isLive: true }
- Stream URL format: `{serverUrl}/live/{username}/{password}/{streamId}.ts`

### App.tsx routing
Initial-load routing runs ONCE via useRef guard. Never add useEffect that force-redirects on every render — it breaks navigation to specific routes.

### Proxy setup
- Dev only: Vite proxy at /api/xtream/* routes to VITE_XTREAM_PROXY_TARGET (from .env.local)
- Production: will need a server-side proxy on the VPS (not yet built)
- Stream URLs go directly to the Xtream server (Chrome bypasses CORS for media elements)

### Secure context requirement
AES-GCM encryption (Web Crypto API) requires a secure context (HTTPS or localhost). The app shows a clear error in XtreamCodesForm when accessed via LAN IP without HTTPS.

## What NOT to do
- Do NOT add features not asked for
- Do NOT install packages without approval
- Do NOT refactor working code unless asked
- Do NOT proxy streams through a backend
- Do NOT store credentials in plain text anywhere
- Do NOT bundle default playlists or provider suggestions
- Do NOT re-enable React Strict Mode

## Debugging rules (learned from painful debugging)
- Every async operation logs to console with prefix [FeatureName]
- Every catch block logs the actual error before setting user-facing message
- Never use generic error messages — always include the real err.message
- When a component mounts or starts work, log that it started
- When it succeeds, log that it succeeded
- Trust console logs and Network tab over UI state during debugging

## Post-mortem lessons (do not repeat)
1. Vite configs use loadEnv(), not process.env
2. HTTP response bodies read exactly once
3. Don't mix async generators with callbacks — pick one pattern
4. Media libraries fight React Strict Mode — disabled here
5. Credentials decrypted ONCE by store; don't re-decrypt elsewhere
6. Every catch block logs err before setting user message
7. Route redirects must respect current pathname, never force on every render
8. Chrome needs user-click for first video play
9. crypto.randomUUID fails in non-secure contexts; use generateId() from uuid.ts
10. crypto.subtle also requires secure context; guard with crypto.subtle check

## Working style
- Build one feature at a time, finish + commit before starting next
- Commit after every working milestone with descriptive message
- If unclear, ask the user rather than guess
- Comment the "why" for non-obvious code, not the "what"

## Current project state

### Completed
- Project scaffolding (Vite + React + TypeScript + Tailwind)
- Onboarding screen (Xtream Codes only — M3U URL tab hidden, code kept for post-MVP)
- Zustand store for playlist sources
- IndexedDB with Dexie v2 schema: sources, categories, channels, movies, series, episodes, syncMetadata
- Web Crypto AES-GCM encryption for credentials (with secure-context guard)
- UUID generation utility (src/lib/uuid.ts) with non-secure context fallback
- Vite dev proxy for Xtream API
- Xtream API client (src/lib/xtream.ts) — all 7 endpoints
- Xtream sync orchestrator (callback-based, not async generator)
- Loading page with progress bar
- Home page with reactive catalog counts (dexie-react-hooks useLiveQuery)
- Re-sync button, Clear all data button
- Strict Mode disabled
- AppLayout shell with header (IPTV Player branding + Search/Settings buttons) and sidebar navigation (Live TV / Movies / Series)
- Live TV page (Step 10A): CategorySidebar + ChannelGrid placeholder
- Live TV browser (Step 10B): CategorySidebar with counts, virtualized ChannelGrid (53k+ channels), ChannelCard with logo fallback to initials
- Watch page (Step 10C): Full-screen video player, mpegts.js, auto-play with click-to-play fallback overlay, back-to-live navigation
- TestPlayer diagnostic page at /test-player (accessible via URL, not linked in UI)

### Deferred (post-MVP)
- M3U URL parsing (code stub exists for M3uUrlForm, tab hidden)
- Sync performance optimization (~100 items/sec, can be 3-5x faster)
- Autocomplete attributes on form inputs
- Production proxy on VPS

### Not yet built
- Channel quick-zap (remote-style up/down to change channels)
- Fullscreen toggle on Watch page
- Audio track / subtitle selection
- Movies browsing UI (Step 12)
- Series browsing UI (Step 12)
- Search, Favorites, Recent channels, Continue watching, EPG
- Settings page, Multi-language, VPS deployment

## Next feature to build
Step 11 — Channel quick-zap (up/down remote-style navigation) and fullscreen toggle on Watch page.
Do NOT start until explicitly asked.