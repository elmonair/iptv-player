# IPTV Player Project Brief for AI Planning

## Project Overview
A modern IPTV player web app built with React 18 + TypeScript that plays Live TV, Movies, and Series in the browser. Designed for desktop, mobile, and TV browsers (Fire TV Silk, Android TV Bro) with keyboard/remote navigation support. Users connect via Xtream Codes credentials or M3U URL.

## Current Status (Production: Online)
**Live Site**: https://m2player.ru 
**VPS**: 212.237.218.180 (Ubuntu 24.04) 
**Status**: ✅ Fully functional, deployed with PM2 auto-restart

## What's Complete (MVP + Production Ready)
- ✅ Xtream Codes API + M3U URL integration (multi-provider)
- ✅ Live TV with category sidebar, channel grid, logos
- ✅ Movies section with grid and playback
- ✅ Series section with seasons/episodes and playback
- ✅ Video player (mpegts.js for live, native for movies/series, HLS.js for .m3u8)
- ✅ Channel switching via sidebar and arrow keys
- ✅ Auto-advance to next channel on error (5s countdown)
- ✅ Watch history with resume (movies/episodes only, not live)
- ✅ Favorites system
- ✅ Search across channels, movies, series
- ✅ EPG (TV Guide) with 128K+ programs, XMLTV streaming parser
- ✅ Responsive design (mobile/tablet/desktop/TV)
- ✅ PM2 process management with systemd auto-restart
- ✅ Production proxy server (all requests via https://m2player.ru)
- ✅ FFmpeg 6.1.1 installed (for audio transcoding)
- ✅ Express.js production server
- ✅ State management (Zustand) + Local storage (Dexie.js)
- ✅ Dark theme throughout

## Known Issues & Limitations
- ❌ **MKV/AVI files with E-AC3/DTS audio play video but NO SOUND** (browsers don't support these codecs)
- ❌ FFmpeg transcode endpoint exists on server but **client-side not implemented**
- ❌ EPG schedule view (12h program list) not implemented
- ❌ EPG on Watch page sidebar (Now/Next) not implemented
- ❌ No multi-language support
- ❌ Search lacks advanced filters (year, genre, quality)

## Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS v3
- **Routing**: React Router v6
- **State**: Zustand
- **Data Fetching**: TanStack Query v5
- **Local Storage**: Dexie.js with dexie-react-hooks
- **Video**: mpegts.js, HLS.js, native HTML5 video
- **Virtualization**: @tanstack/react-virtual
- **Icons**: lucide-react
- **Backend**: Express.js (production proxy)
- **Process Manager**: PM2 with systemd
- **Transcoding**: FFmpeg 6.1.1 (installed but not yet used by client)

## Key Files & Architecture
- **Frontend**: React SPA, all code in /src/
- **Components**: /src/components/ (one per file, PascalCase)
- **Pages**: /src/pages/ (ChannelCategories, MovieDetail, SeriesDetail, Watch, SearchPage, EpgPage)
- **Stores**: /src/stores/ (Zustand: playlistStore, browseStore, favoritesStore, watchHistoryStore)
- **Libs**: /src/lib/ (xtream.ts, db.ts, epgParser.ts, crypto.ts, uuid.ts)
- **Production Server**: /server.js (Express with proxy routes)
- **PM2 Config**: /home/m2player/ecosystem.config.cjs

## Proxy Routes (Production)
- /api/xtream/* — Xtream API proxy
- /proxy/live/* — Live TV streams
- /proxy/movie/* — Movie streams
- /proxy/series/* — Series episode streams
- /proxy/image/* — Image proxy (cached 1 hour)
- /transcode/:type/:streamId — FFmpeg transcode (ready but unused)
- /api/xmltv/* — EPG XMLTV proxy

## Critical Technical Constraints
1. **React Strict Mode is DISABLED** (conflicts with mpegts.js)
2. **Credentials stored encrypted in IndexedDB** (AES-GCM 256-bit)
3. **Use generateId() from src/lib/uuid** (crypto.randomUUID fails on LAN IPs)
4. **Object.keys/values/entries MUST have null guards**: Object.keys(data?.episodes ?? {})
5. **Video needs user click to play** (Chrome blocks autoplay)
6. **FFmpeg transcode endpoint ready** but Watch.tsx doesn't use it yet

## Recent Changes (2026-04-28 to 2026-04-30)
- Fixed PM2 systemd service (Type=oneshot, auto-restart enabled)
- Fixed SeriesDetail Object.keys crashes (safe property access)
- Fixed channel grid 0-height bug (two-div pattern)
- Fixed global items array bug in browseStore (per-category caching)
- Added FFmpeg transcode endpoint to server.js

## Next Priorities (Order of Importance)
### 1. **Fix MKV Audio Issue** (HIGH PRIORITY)
 - Implement client-side transcode URL building in Watch.tsx
 - Add 
eedsTranscode() function to detect MKV/AVI/WMA/FLV files
 - Add uildTranscodeUrl() function
 - Modify uildStreamUrl() to use transcode for non-AAC containers
 - **Impact**: Enables FFmpeg transcode endpoint → MKV files will have sound

### 2. **EPG Enhancements**
 - EPG schedule view (12h program list per channel)
 - EPG on Watch page sidebar (Now/Next below channel name)
 - **Impact**: Better TV guide experience

### 3. **Search Improvements**
 - Add filters (year, genre, quality)
 - Search within EPG program titles
 - **Impact**: Better content discovery

### 4. **Multi-language Support**
 - Set up i18n with react-i18next
 - Add language picker
 - Translate UI elements
 - **Impact**: Broader user base

### 5. **Performance Optimizations**
 - Server-side caching for frequently accessed data
 - Optimize large channel lists
 - Consider Redis for session management
 - **Impact**: Faster load times, better scalability

## Deployment Process
1. Make changes locally
2. Build: 
pm run build
3. Upload dist/ to VPS
4. Upload server.js if changed
5. Restart PM2: pm2 restart m2player
6. Verify: pm2 status and test live site

## Access Information
- **Live Site**: https://m2player.ru
- **VPS SSH**: root@212.237.218.180:22
- **PM2 Status**: su - m2player -c 'pm2 status'
- **Server Logs**: /home/m2player/logs/pm2-out.log, pm2-error.log
- **Project Root**: /home/m2player/htdocs/m2player.ru/

## Important Notes for AI Planning
- User has no coding experience — write clean, commented production code
- Do NOT change tech stack without approval
- Do NOT add experimental patterns
- Test on 4 viewports: mobile (375px), tablet (768px), desktop (1280px), TV (1920px)
- Every feature must work on all 4 viewports before marked complete
- TV-friendly: Tab + Arrow keys, visible focus rings, min 16px fonts
- Do NOT touch live TV proxy or video player config (tuned for stability)
