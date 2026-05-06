# M2Player Project State / Agent Instructions

## Project
M2Player IPTV web player hosted at:

/home/m2player/htdocs/m2player.ru

Domain:
https://m2player.ru

Stack:
- React + Vite + TypeScript frontend
- Vidstack player
- Express backend server.js
- PM2 process name: m2player
- Node via m2player user nvm:
  /home/m2player/.nvm/versions/node/v22.22.2/bin/node
  /home/m2player/.nvm/versions/node/v22.22.2/bin/pm2

## Current branch
Working branch:
no-heavy-mkv-transcode-strategy

Saved experiment branch:
vidstack-experiment

Saved tag:
vidstack-hls-mkv-experiment-2026-05-06

Saved commit:
8995a6e Save Vidstack HLS MKV experiment before new playback strategy

## Important context

We tested MKV -> HLS generation with Vidstack.

It worked technically:
- server generated /hls/movie/:movieId/master.m3u8
- browser loaded master.m3u8 and seg_XXXXX.ts
- Vidstack could play generated HLS
- cache playlist route was fixed
- no-cache headers were added
- progressive HLS generation was added
- reconnect options were added
- 1080p fast profile was tested

But this strategy caused high VPS CPU usage.

HOSTKEY warned/throttled the VPS because ffmpeg used sustained CPU >70%.

Conclusion:
Do NOT allow public users to automatically trigger heavy MKV -> HLS video transcoding.

## Current strategic decision

Keep Vidstack as the main player.

Stop automatic heavy MKV video transcoding on public playback.

New playback priority:
1. Direct/proxied playback first.
2. Use existing cached HLS only if already available.
3. For MKV without cache, do NOT auto-start heavy video transcoding.
4. Use ffprobe only for inspection where needed.
5. Add external subtitle support with .vtt files.
6. Internal subtitles may be extracted only as subtitle files, not full video conversion.
7. Audio track support should be planned via lightweight remux/package only when possible.
8. Heavy video transcoding should become optional/admin/manual fallback, disabled by default.
9. Do not break normal live/movie/series playback.

## What was learned

### HLS route fixes that worked
The backend route:
GET /hls/movie/:movieId/master.m3u8

was patched so it:
- checks existing cache playlist first
- returns valid playlist without requiring query params
- returns 202 if generation is active but playlist is not ready
- only requires query params when starting generation
- returns .m3u8 with no-cache headers
- avoids 304 stale playlist responses
- sends playlist content directly instead of sendFile

### ffmpeg reconnect fixes that helped
Input options tested:
-reconnect 1
-reconnect_streamed 1
-reconnect_at_eof 1
-reconnect_delay_max 10
-rw_timeout 15000000

These helped when upstream MKV streams ended early.

### CPU-heavy profile problem
Original/testing HLS generation used libx264 and was too heavy for VPS.

4K MKV -> HLS 1080p even with:
-preset ultrafast
-crf 28
-vf scale='min(1920,iw)':-2

still caused sustained high CPU.

Therefore heavy video transcode must not be public default.

## Current safe operating rules

Before making changes:
- Check current branch with:
  git branch --show-current
- Do not work directly on vidstack-experiment unless intentionally restoring old experiment.
- Do not commit hls-cache, .ts, .m3u8, or generated media.
- Do not expose provider credentials in logs or UI.
- Do not start ffmpeg heavy transcoding automatically.
- Keep Vidstack.

Before restarting:
Use PM2 as m2player user:

su - m2player -c 'cd /home/m2player/htdocs/m2player.ru && /home/m2player/.nvm/versions/node/v22.22.2/bin/pm2 restart m2player --update-env'

Build:

npm run build

Check ffmpeg:

ps aux | grep ffmpeg

Stop ffmpeg if needed:

pkill -f ffmpeg

## Needed cleanup

Add/verify .gitignore includes:

hls-cache/
*.ts
*.m3u8
server.js.bak*
src/pages/*.bak*
*.log

Note:
A previous push was large (~725 MB), likely because backup/cache/generated files were included. Avoid this going forward.

## Next recommended task

First task for any coding agent:

Inspect:
- server.js
- src/pages/Watch.tsx

Then propose a safe implementation plan for:
- no-heavy-mkv-transcode strategy
- Vidstack direct/proxy playback
- external subtitles .vtt support
- optional internal subtitle extraction
- future audio track support
- disabled-by-default admin/manual heavy transcode fallback

Do not implement large changes before the plan is approved.

