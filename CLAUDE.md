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

## Responsive Design (MUST follow for every component)

### Target devices
- Desktop browsers (1920x1080+)
- Tablets (768px - 1024px)
- Mobile phones (320px - 768px)
- TV browsers (Fire TV Silk, Android TV Bro) — 1920x1080, remote/keyboard navigation

### Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: 1024px - 1920px
- TV: 1920px+

### Layout rules
- Use Tailwind responsive prefixes: `sm:` `md:` `lg:` `xl:` `2xl:` — default is mobile-first
- Channel grids: 1 column mobile, 2 tablet, 3-4 desktop
- Video player: full-width mobile, max-width desktop
- Navigation: hamburger on mobile, horizontal on desktop

### Typography rules
- Minimum font: 16px (text-base) everywhere
- Channel names: text-lg mobile, text-xl desktop
- Headings: text-2xl mobile, text-4xl desktop
- Never below 14px (text-sm) for readable text

### Touch targets & spacing
- Minimum button/card height: 48px (h-12) on all devices
- Minimum button width: 120px on mobile
- Container padding: px-4 mobile, px-8 desktop
- Grid gaps: gap-2 mobile, gap-4 desktop
- Minimum 8px spacing between clickable elements

### Video player responsive rules
- Mobile: full-width, 16:9, controls always visible
- Tablet: max-width 90vw, centered
- Desktop: max-width 1280px, centered
- TV: full-screen, large control buttons (min 64px)
- Player controls: stack vertical mobile, horizontal desktop/TV

### Images & logos
- Channel logos: 80x80 mobile, 120x120 desktop
- Use object-contain to prevent distortion
- Lazy load: loading="lazy" on all images

### Keyboard/Remote navigation (TV)
- All interactive elements must have tabIndex
- Focus rings: ring-4 on TV (larger), ring-2 on desktop/mobile
- Arrow key navigation for channel grids
- Escape key to close modals / go back

### Responsive utility
Use `src/lib/responsive.ts` for device detection:
```typescript
import { isMobile, isTV, getDeviceType } from '../lib/responsive'
```

### Performance on mobile
- Limit initial channel list to 50 items on mobile (virtualize if more)
- Use smaller video buffer on mobile
- Lazy load images

### Testing requirement
Every component MUST be tested on:
- Mobile viewport (375px)
- Tablet viewport (768px)
- Desktop viewport (1280px)
- TV viewport (1920px)

No component should be marked as complete until it works correctly on all four viewports.

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
- API calls go DIRECTLY to the Xtream server (serverUrl from login form)
- The Xtream server MUST have CORS headers enabled for the app's origin
- Stream URLs go directly to the Xtream server (Chrome bypasses CORS for media elements)
- Enable CORS in your Xtream admin panel: Settings → API/CORS → add your origin
- Production: a server-side proxy avoids CORS configuration entirely (not yet built)

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
11. Movie metadata requires get_vod_info API call; use regex to parse VOD ID from movie ID (movie-104817 → 104817)
12. Always check activeSource.type before making Xtream API calls (may be 'm3u-url' instead of 'xtream')
13. SeriesDetail: useLiveQuery returns `undefined` before query finishes — distinguish from `null` (not found) by checking `series === undefined` explicitly
14. SeriesDetail: Reset `loading=true` when route parameter changes (useEffect with [seriesId]), otherwise stale `loading=false` causes wrong render
15. SeriesDetail: API data (seriesInfo) may not be loaded when component renders — use optional chaining `seriesInfo?.info` not `seriesInfo.info` to avoid crashes
16. ChannelCard heart button must use `e.stopPropagation()` to prevent card click (channel play) from firing when clicking heart

## Working style
- Build one feature at a time, finish + commit before starting next
- Commit after every working milestone with descriptive message
- If unclear, ask the user rather than guess
- Comment the "why" for non-obvious code, not the "what"

## Latest Commit
**Commit**: `da5f9f2` — "Fix watch progress tracking for channels and clean up debug logs" (2026-04-26)
**Changes**: 3 files changed, 9 insertions(+), 34 deletions(-)
**Key changes**:
- Added `onloadedmetadata` handler to channel playback (mpegts path) that calls `handleLoadedMetadata` to restore saved position
- Added `startProgressTracking('channel', item.data.id)` to channel `onplaying` handler
- Removed debug console.logs from `getContinueWatching` filter logic
- Removed debug `debugWatchHistory` window function from ContinueWatchingSection
- Removed console.log from ContinueWatchingCard handleClick
- Build: 3 pre-existing TS errors remain (currentCategoryId, type comparison, selectedCategoryId — all unrelated)

## Current project state (updated 2026-04-27)

### Working features
- Xtream Codes API integration (multi-provider support)
- Live TV with category sidebar, channel grid, logos
- Movies section with grid and playback
- Series section with seasons/episodes and playback
- Video player: mpegts.js for live TV, native video for movies/series
- HLS.js support for .m3u8 streams
- Channel switching via sidebar, arrow keys
- Auto-advance to next channel on error (5s countdown)
- Clean error overlay for unavailable channels
- Watch history with resume for movies/episodes (not live)
- Favorites (star icon)
- Playlist sync and management
- Top navigation with membership/playlist/device info
- User dropdown menu with PIN code
- Home page with welcome, stats, quick actions
- Dark theme throughout
- Mobile responsive design
- Proxy server for live TV streams (CORS bypass)

### Known limitations
- Series .mkv files play only if browser supports the codec
- Some IPTV providers may buffer due to slow servers (not code issue)
- No EPG (TV guide) yet
- No search yet
- No multi-language yet

### Video player stack
- Live TV: mpegts.js with these config settings:
  enableWorker: false, enableStashBuffer: true,
  stashInitialSize: 1MB, liveBufferLatencyChasing: false,
  liveSync: false, lazyLoad: false, fixAudioTimestampGap: true
- Movies/Series: native <video> element (direct URL to provider)
- HLS streams: Hls.js
- DO NOT add response timeouts to the live proxy (kills streams)
- DO NOT save watch history for live channels (causes buffering)
- DO NOT use enableWorker:true with relative URLs (Workers cant use them)
- DO NOT override Content-Type header for live streams in proxy

### Proxy architecture
- /api/xtream/* — Vite proxy for Xtream Codes API calls
- /proxy/live/* — Custom middleware for live TV streams
  - Pipes upstream response directly (no buffering)
  - Connection timeout only (10s), NO response timeout
  - Passes through upstream Content-Type as-is
- Movies and series use direct provider URLs (no proxy)

## Bugs fixed (2026-04-27 session)
- Live TV sidebar channel switching race condition (empty src)
- Series episode sidebar switching race condition (same fix)
- Series episode URL building (matches movie pattern now)
- Proxy 30-second response timeout killing live streams
- Proxy Content-Type override corrupting MPEG-TS data
- mpegts.js zero config causing buffering (added proper buffer settings)
- Watch history for live channels causing buffering (disabled)
- Channel error overlay flashing during normal transitions (3s delay)
- Channel unavailable overlay redesigned (minimal + auto-advance)

## Next features to build
- Search across channels, movies, series
- EPG (TV guide) - show now/next
- Multi-language support
- VPS deployment with production proxy