# IPTV Player — Project Rules

## What this project is
A modern IPTV player web app built with React. Users paste an M3U playlist URL or Xtream Codes credentials, and the app plays Live TV, Movies, and Series in the browser. The app is designed to also work on TV browsers (Fire TV Silk, Android TV Bro) using keyboard/remote navigation. In the future it will be ported to React Native for native Android TV / Fire TV apps.

## The user
The project owner has NO coding experience. You are doing all the code. They are testing and reporting back. Write code they can trust without reading it line by line — meaning: clean, commented, no experimental patterns, no hidden magic.

## Tech stack (do not substitute without asking)
- Build tool: Vite
- Framework: React 18 with TypeScript
- Styling: Tailwind CSS v3
- UI components: shadcn/ui (when we add components)
- Routing: React Router v6
- State: Zustand
- Data fetching/caching: TanStack Query v5
- Local storage: Dexie.js (IndexedDB wrapper)
- Video player: Video.js + hls.js + mpegts.js (will be added when needed)
- M3U parsing: iptv-playlist-parser (will be added when needed)
- Icons: lucide-react

## Architecture rules
- Folder structure: src/components, src/pages, src/stores, src/lib, src/types, src/hooks
- One component per file. PascalCase filenames for components. camelCase for utilities.
- Use TypeScript strictly. No "any" types unless absolutely necessary. If you must use any, add a comment explaining why.
- Use Zustand for global state. Do NOT use Redux, MobX, Context API for global state, or any other state library.
- Use TanStack Query for all async data. Do NOT use useEffect + fetch for data.
- Use Tailwind classes for all styling. Do NOT write CSS files, styled-components, or CSS-in-JS.
- Keep components under 200 lines. If bigger, split into smaller components.
- All text visible to users must come from a translation file (even if only English exists now), so multi-language is easy later.

## UI rules
- Dark theme only for now.
- TV browser friendly: all interactive elements must be focusable with Tab key and navigable with arrow keys.
- Minimum font size 16px. Buttons minimum 44px tall.
- Focus states must be clearly visible (thick ring or scale effect).
- Mobile responsive by default. Desktop and TV (1080p/4K) must both look good.
- No hover-only interactions. Every hover has a focus equivalent.

## What NOT to do
- Do NOT add features I did not ask for.
- Do NOT install packages I did not approve.
- Do NOT refactor working code unless I ask.
- Do NOT delete files without telling me.
- Do NOT proxy streams through a backend. The app is purely client-side for now.
- Do NOT store IPTV credentials or playlist URLs in plain text. Encrypt at rest in IndexedDB.
- Do NOT include any default playlists, scraped content, or provider suggestions in the app. The user provides their own source.
- Do NOT commit .env files, node_modules, or secrets to Git.

## Legal posture
This app is a neutral player. It hosts no content, proxies no streams, suggests no sources. The first-run screen will show a disclaimer reminding users they are responsible for the content they play. Do NOT add anything that undermines this posture.

## Working style
- Build one feature at a time. Finish it (working + committed to Git) before starting the next.
- After every significant change, commit to Git with a clear message.
- If something is unclear, ask the user before guessing. The user prefers one clarifying question over a wrong assumption.
- Write code with comments explaining the "why" for anything non-obvious.
- Show test results after building each feature — e.g. "I added favorites, please verify by clicking the star icon on a channel."

## Current project state
- Vite + React + TypeScript project initialized in C:\iptv-player
- Tailwind CSS v3, React Router v6, Zustand, TanStack Query v5, Dexie installed
- Folder structure created: components, pages, stores, lib, types, hooks
- Git initialized, connected to github.com/elmonair/iptv-player (private)
- App.tsx currently shows "IPTV Player - Setup Complete" placeholder
- NO features built yet

## Next feature to build
Will be specified by the user. Do NOT start features without an explicit instruction.
