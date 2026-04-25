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
**Commit**: `c0135ae` — "Fix series loading and channel favorites" (2026-04-25)
**Changes**: 31 files changed, 2985 insertions(+), 608 deletions(-)
**Key changes**:
- Fixed SeriesDetail loading/not-found flash (reset loading on seriesId change, treat series===undefined as loading, null-safe seriesInfo access)
- Added channel favorites heart button to inline ChannelCard in ChannelCategories.tsx
- Added favoritesStore (Zustand) with FavoriteRecord type in Dexie v4 schema
- Added heart buttons to MovieCard, SeriesCard, MovieDetail, SeriesDetail, Watch page, EpisodeList
- Added Favorites category to Channels/Movies/Series sidebar tabs
- Created shared metadata utilities in src/lib/metadata.ts (parseTitle, formatRating, formatYear, formatDuration, formatReleaseDate)
- Created MovieDetail page with full metadata loading via get_vod_info API
- Created SeriesDetail page with unified visual design matching MovieDetail

## Current project state

### Completed
- Project scaffolding (Vite + React + TypeScript + Tailwind)
- Onboarding screen (Xtream Codes only — M3U URL tab hidden, code kept for post-MVP)
- Zustand store for playlist sources with `expDate` field for Xtream playlists
- IndexedDB with Dexie v2 schema: sources, categories, channels, movies, series, episodes, syncMetadata
- Web Crypto AES-GCM encryption for credentials (with secure-context guard)
- UUID generation utility (src/lib/uuid.ts) with non-secure context fallback
- Vite dev proxy for Xtream API
- Xtream API client (src/lib/xtream.ts) — all 8 endpoints (including get_vod_info)
- Xtream sync orchestrator (callback-based, not async generator)
- Loading page with progress bar
- Home page with reactive catalog counts (dexie-react-hooks useLiveQuery)
- Re-sync button, Clear all data button
- Strict Mode disabled
- AppLayout shell with TopNavBar (MishaPlayer branding with yellow accent)
- TopNavBar: Status bar with Membership/Playlist/Device ID, PIN code with eye toggle, user dropdown, playlist expiry date, Search icon, playlist dropdown
- Live TV page: CategorySidebar with scroll, ChannelGrid with scroll, sticky sidebar on desktop
- ChannelCategories page: Tabs, category sidebar, channel grid preview, mobile view state
- Watch page: Video player (16:9 aspect ratio), channel list sidebar, fullscreen toggle, prev/next channels, keyboard navigation (↑/↓), mobile layout (40vh player / 60% list)
- Player page layout: side-by-side on desktop, stacked on mobile
- Scrollbars: Custom styling for category list and channel grid (10px width)
- Height constraints: `h-screen` + `overflow-hidden` + `min-h-0` for proper flex scrolling
- **Movies UI**: MovieCard (poster style, gradient overlay, rating badge), MovieCategories (violet selected state, filter input), MovieGrid (skeleton loading, empty state), Movies page (content header), Movies Home (Recently Added, Browse Categories)
- **Series UI**: SeriesCard (poster style), SeriesCategories, SeriesGrid, Series page
- **Movie Detail page** (`/movie/:movieId`): Hero with cinematic backdrop, poster, info, Play/Favorite buttons, Overview, Cast, Available Versions, "More Like This", right info panel (desktop), smart badges (quality, language, provider)
- **Movie metadata loading**: getVodInfo API call, parses VOD ID from route (movie-104817 → 104817), loads plot, description, genre, cast, director, duration, releasedate, backdrop_path, movie_image
- **Series Detail page** (`/series/:seriesId`): SeriesHero, SeasonSelector (horizontal tabs), EpisodeList (clickable rows), mobile refinements
- **Series episode playback**: Episode click opens Watch page with all episodes list
- **Search page** (`/search`): Real-time search with 300ms debounce, filter toggles, grouped results
- **ErrorBoundary**: Catches render errors with "Go Home" and "Reload" buttons
- **browseStore**: Navigation state persistence (section, selectedCategoryId, selectedCategoryName, scrollTop, focusedItemId, selectedSeriesId, selectedSeasonNumber, selectedEpisodeId, focusedEpisodeId, episodeListScrollTop)
- **Hierarchical back navigation**: Episode → Series Detail → Series category grid → Series categories list
- **Playlist switching**: `isActive` persistence in IndexedDB, auto-switch on delete
- **Favorites system**: `favoritesStore` (Zustand), `FavoriteRecord` type in Dexie (id, itemType, itemId, sourceId, addedAt), heart buttons on MovieCard, SeriesCard, ChannelCard, MovieDetail, SeriesDetail, Watch page, EpisodeList; Favorites category in all 3 tabs
- **Dexie schema v4**: favorites table added; series/movies/channels have `externalId` index
- **Series detail loading fix**: Loading state separate from not-found; uses `db.series.toArray().find()` instead of indexed externalId query to avoid schema errors
- **formatRating crash fix**: Handles string ratings (e.g. "8.5"), null, undefined, empty; returns fallback 'N/A' instead of crashing; no `.toFixed()` direct calls anywhere
- **Unified detail page design**: MovieDetail and SeriesDetail share same visual style (backdrop, poster, badges, buttons, info panel)
- **Channel favorites bug fix**: Heart button added to inline ChannelCard in ChannelCategories.tsx with stopPropagation
- **Series loading flash bug fix**: Reset loading on seriesId change, treat series===undefined as loading, null-safe seriesInfo access

### Deferred (post-MVP)
- M3U URL parsing (code stub exists for M3uUrlForm, tab hidden)
- Sync performance optimization (~100 items/sec, can be 3-5x faster)
- Autocomplete attributes on form inputs
- Production proxy on VPS

### Not yet built
- Audio track / subtitle selection
- Recently Watched / Continue Watching sections
- EPG (TV Guide) for live channels
- Settings page (language selection, playback preferences)
- Multi-language support
- VPS deployment

## Next feature to build
Choose one of the following:
1. **Recently Watched / Continue Watching** — Track last played items, resume from where you left off
2. **Settings Page** — Language selection, playback preferences, clear cache, logout
3. **EPG (TV Guide)** — Current/next program for live channels
4. **Audio/Subtitle Selection** — For movies/episodes with multiple tracks

## Recent Layout & Scrollbar Fixes (2026-04-23)
### TopNavBar Updates
- Added PIN code display with eye toggle in user dropdown (Xtream password)
- Added playlist expiry date display beside playlist name (from exp_date field)

### Watch Page Fixes
- Player layout: side-by-side on desktop (flex-1 + lg:flex-row), stacked on mobile
- Player container: `aspect-video` with `key={channelName}` for proper remount
- Video: `w-full h-full object-contain` + `autoPlay`
- Mobile: player `h-[40vh]` (40% viewport), channel list `flex-1` (60%)
- Channel list: `overflow-y-scroll` with custom scrollbar (10px width)

### LiveTV Page Fixes
- Root container: `h-screen flex flex-col overflow-hidden`
- Content wrapper: `flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0`
- Desktop sidebar: `sticky top-0 h-screen` + `overflow-y-auto` on nav inside CategorySidebar
- Channel grid: `overflow-y-auto lg:max-h-[calc(vertHeight-200px)]`
- Independent scroll for sidebar and grid

### CategorySidebar Component
- Root: `w-full h-full flex flex-col overflow-hidden`
- Scrollable nav: `flex-1 overflow-y-auto min-h-0`
- This ensures scrollbar appears when content overflows available height

### CategoryCategories Page Fixes
- Root: `h-screen bg-slate-900 flex flex-col overflow-hidden`
- Content: `flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0`
- This prevents sidebar from growing beyond viewport height (was 715,314px tall bug)

### Scrollbar Styling (src/index.css)
- `.overflow-y-scroll::-webkit-scrollbar` = 10px width, slate track, slate thumb
- Firefox support with `scrollbar-width: thin`
- Prominent, always-visible scrollbar for better UX

### Critical Height Constraint Pattern
For proper flex scrolling in nested containers:
- Root: `h-screen flex flex-col overflow-hidden`
- Content wrapper: `flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0`
- Scrollable area: `flex-1 overflow-y-auto min-h-0`
- Fixed elements: `flex-shrink-0`
Without `min-h-0` on flex children, they won't shrink below their content size, breaking scroll.

## Movie Metadata Implementation (2026-04-25)
### Xtream API Updates
- Added `XtreamVodInfo` type in `src/lib/xtreamTypes.ts` with `info` and optional `movie_data` fields
- Added `getVodInfo()` API function in `src/lib/xtream.ts` to call `action=get_vod_info&vod_id=<id>`

### MovieDetail Page Updates
- Parses VOD ID from route parameter (e.g., `movie-104817` → extracts `104817`)
- Fetches full VOD metadata on component mount using `getVodInfo()`
- Added debug console logs for troubleshooting:
  - Selected movie object
  - Route/movie ID
  - Extracted VOD ID
  - API URL (password masked for security)
  - Raw API response
  - Extracted metadata fields
- Uses metadata with comprehensive fallbacks:
  - Overview: `info.plot` → `info.description` → `movie_data.plot` → `movie_data.description` → `movie.plot` → `movie.description`
  - Year, rating, genre, cast, director, duration, release date from API or local data
  - Backdrop and poster images from API or local data
- Only fetches metadata for Xtream sources (checks `activeSource.type === 'xtream'`)
- Updated `MovieRecord` type to include optional `description` field

### Debugging Console Output
All MovieDetail logs use `[MovieDetail]` prefix:
- `[MovieDetail] Selected movie object:` — full movie record from IndexedDB
- `[MovieDetail] Route/movie ID:` — route parameter value
- `[MovieDetail] Extracted VOD ID:` — parsed numeric VOD ID
- `[MovieDetail] Calling get_vod_info API:` — API URL with password masked
- `[MovieDetail] Raw get_vod_info response:` — full API response object
- `[MovieDetail] Extracted fields:` — all metadata fields with values
- `[MovieDetail] Provider did not return movie metadata for vod_id:` — if API returns no data
- `[MovieDetail] Error fetching VOD info:` — if API call fails

## Shared Metadata Utilities (2026-04-25)
Created `src/lib/metadata.ts` with reusable utilities:
- `parseTitle(name: string)` — extracts cleanTitle, year, quality, language, provider from movie/series names
- `getCleanTitleForComparison(name: string)` — returns clean title for matching "More Like This" content
- `formatRating(rating: unknown, fallback = 'N/A'): string` — safe formatter handles string, number, null, undefined, empty strings; always returns string, never crashes
- `formatYear(year: unknown, parsedYear?: number): string | null`
- `formatDuration(duration: unknown): string | null`
- `formatReleaseDate(date: unknown): string | null`

All components now use these utilities instead of inline formatting, ensuring consistent safe handling across the app.

## Series Detail Page Implementation (2026-04-25)
- Matches MovieDetail visual design: cinematic backdrop, poster, badges (rating, year, genre, cast, director, release date), Play/Favorite buttons, Overview, Cast, Director, right info panel (desktop)
- SeasonSelector: horizontal tabs for seasons, persists selected season in browseStore
- EpisodeList: clickable rows with play button and heart favorite button, episode number, title, duration
- Loading state: separate from "not found" — shows spinner until useLiveQuery returns (not undefined)
- API: calls `getSeriesInfo()` on mount, fetches all seasons/episodes for the series
- Favorites: heart button on series header toggles series favorite; heart on each episode toggles episode favorite
- Navigation: back button returns to previous category or Series tab; Escape/Backspace keyboard shortcuts
- Mobile refinements: poster size, layout, spacing

## Favorites System Implementation (2026-04-25)
### FavoritesStore (Zustand)
- `loadFavorites(sourceId)` — loads all favorites for a playlist from IndexedDB
- `toggleFavorite(itemType, itemId, sourceId)` — adds or removes a favorite
- `isFavorite(itemType, itemId)` — checks if item is favorited
- `getFavoritesByType(itemType)` — returns all favorites of a given type
- `clearFavorites()` — clears all favorites

### IndexedDB Schema (Dexie v4)
- `favorites` table: `id` (string, primary key), `itemType` ('channel' | 'movie' | 'series' | 'episode'), `itemId` (string), `sourceId` (string), `addedAt` (number)
- Composite type-prefixed IDs prevent collisions: `channel:`, `movie:`, `series:`, `episode:`
- Favorites loaded in App.tsx on mount and when activeSourceId changes

### Heart Buttons Everywhere
- **ChannelCard** (inline in ChannelCategories.tsx and src/components/live/ChannelCard.tsx): heart with stopPropagation
- **MovieCard** (src/components/movies/MovieCard.tsx): heart on top-right
- **SeriesCard** (src/components/series/SeriesCard.tsx): heart on top-right
- **MovieDetail** (src/pages/MovieDetail.tsx): heart next to Play button
- **SeriesDetail** (src/pages/SeriesDetail.tsx): heart next to Play button
- **Watch** (src/pages/Watch.tsx): heart in player control bar
- **EpisodeList** (src/components/series/EpisodeList.tsx): heart on each episode row

### Favorites Category in Sidebar
- Appears in Channels/Movies/Series tabs when items are favorited
- Shows count of favorited items for that tab
- Clicking filters grid to show only favorited items
- Uses Dexie `.where('id').anyOf(favoriteIds).toArray()` for efficient queries

## Recent Bug Fixes (2026-04-25)
### Bug 1 — Channel Favorites Missing
**Problem**: Channel cards in Channels tab had no heart button (unlike Movies/Series).

**Solution**: Added heart button to inline `ChannelCard` component in `src/pages/ChannelCategories.tsx`:
- Imported `Heart` from lucide-react and `useFavoritesStore`
- Added heart button in top-right with `bg-black/50 hover:bg-black/70` background
- Used `e.stopPropagation()` to prevent channel play on favorite click
- Filled red (`text-red-500 fill-red-500`) when favorited, outlined white when not
- Favorites category already existed in sidebar and shows favorited channels

**Files changed**: `src/pages/ChannelCategories.tsx` (added imports, updated ChannelCard component)

**Console logs added**: `[ChannelFavorite] toggle {channelId} {channelName}`

### Bug 2 — Series "Not Found" Flash
**Problem**: Clicking a series showed "Series not found" briefly, then the series appeared. `loading` wasn't reset on navigation, and `series === undefined` was treated as "not found".

**Solution** (three changes in `src/pages/SeriesDetail.tsx`):

1. **Reset loading on seriesId change** (lines 65-69): Added `useEffect` that sets `loading=true` and clears `error`/`seriesInfo` when `seriesId` changes. Replaced old `useEffect` that only set `loading=false` when series resolved.

2. **Treat `undefined` as loading** (line 244): Changed guard from `if (loading)` to `if (series === undefined || loading)`. Now `useLiveQuery`'s initial `undefined` state shows spinner, not "not found" error.

3. **Null-safe seriesInfo access** (lines 284-296): Changed `seriesInfo.info` → `seriesInfo?.info` and all `info.*` → `info?.*`. Prevents crash if `seriesInfo` hasn't loaded yet when component renders early.

4. **Added debug console logs**:
   - `[SeriesDetail] params {seriesId}` — logs route parameter
   - `[SeriesDetail] loading {bool} seriesIsUndefined {bool} series {...}` — logs loading state, undefined check, and series object

**Result**: Correct render order: loading → spinner; loaded and no series → "not found"; loaded and series exists → detail page. No more flash.

**Files changed**: `src/pages/SeriesDetail.tsx`