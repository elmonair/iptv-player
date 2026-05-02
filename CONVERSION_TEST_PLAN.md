# Conversion Test Plan: Web App to Windows and Android

## Goal
Test whether converting the current IPTV web app to desktop/mobile apps is worth the investment before spending time on a full conversion.

The main thing we want to prove is whether native app environments can use direct IPTV provider URLs without the VPS proxy, avoiding browser CORS issues and preventing all traffic from appearing as the VPS IP in the IPTV provider panel.

## Phase 1: Electron Desktop Prototype

### Purpose
Test if the current React/Vite web app can run as a Windows desktop app and bypass browser CORS/proxy issues.

### Time Estimate
0.5-1 day.

### What We Will Test
- Load the existing React/Vite build inside Electron.
- Use direct IPTV provider URLs instead of `/proxy/*` routes.
- Test Live TV playback.
- Test Movie playback.
- Test Series episode playback.
- Confirm whether the IPTV provider panel sees the user IP instead of the VPS IP.
- Check performance, memory usage, startup speed, and general UX.
- Check whether problematic MKV files still need FFmpeg/audio transcoding.

### Minimal Prototype Scope
- No installer yet.
- No auto-update.
- No redesign.
- No full refactor.
- Just a working desktop window using the existing app.

### Success Criteria
- App opens on Windows.
- Login/source loading works.
- Live TV direct stream works.
- Movie direct stream works.
- Series direct stream works.
- Provider panel shows the user/device IP, not VPS IP.
- No major playback regression compared with the web app.

### Decision After Phase 1
- If good: continue toward a real Windows app.
- If bad: keep improving the web app and avoid wasting time on desktop conversion.

## Phase 2: Android Prototype

### Purpose
Test if an Android phone/TV app can play provider streams directly without the VPS proxy.

### Time Estimate
1 day.

### Best Test Approach
Build a minimal React Native video test app first, not a full conversion.

### What We Will Test
- Create a small React Native test app.
- Add `react-native-video`.
- Paste/test direct Live/Movie/Series stream URLs.
- Test playback on Android phone or Android TV/Fire TV if available.
- Check remote/keyboard behavior if tested on a TV device.
- Check whether E-AC3/DTS audio works on the Android device.

### Important Note
Android devices may support more codecs than browsers, but not all devices support every Dolby/DTS format. Some MKV files may still need server-side FFmpeg transcoding depending on the device.

### Success Criteria
- Direct stream playback works.
- Provider sees user/device IP.
- Video performance is stable.
- Remote control/keyboard input is possible.
- Audio works for problematic MKV files, or we clearly know transcoding is still needed.

### Decision After Phase 2
- If good: plan a React Native Android app.
- If bad: keep the web app or consider a lighter hybrid/webview approach.

## Phase 3: Product Direction Decision

After both prototypes, choose one path.

### Path A: Keep Web App Only
Choose this if Electron/Android tests are poor, direct provider access still has problems, or app distribution is not worth the effort.

Focus on:
- Finish FFmpeg transcoding in the web app.
- Improve EPG.
- Improve search.
- Optimize proxy/load handling.

### Path B: Web + Windows Electron
Choose this if Electron works well and Windows users are important.

Build:
- Real Electron app.
- Windows installer.
- Direct/proxy mode setting.
- Auto-update later.

### Path C: Web + Android App
Choose this if Android playback works well and Android TV / Fire TV is a priority.

Build:
- React Native Android app.
- Direct provider playback.
- TV remote navigation.
- APK first, Play Store later.

### Path D: Web + Windows + Android
Choose this if both prototypes work well.

This is the best long-term product path, but only after the direct-play and playback tests succeed.

## Phase 4: Full Windows App If Electron Test Passes

### Time Estimate
2-4 days after the prototype.

### Work Items
- Add Electron properly to the project.
- Create desktop-specific config.
- Add direct/proxy connection mode.
- Package Windows installer.
- Add app icon/name/version.
- Test install/uninstall.
- Test playback with multiple providers.
- Keep the web app unchanged.

### Important
Do not delete or replace the web app. The Windows app should be an additional build target.

## Phase 5: Full Android App If Android Test Passes

### Time Estimate
1-2 weeks for a serious version.

### Work Items
- Create React Native app.
- Reuse business logic where possible:
  - Zustand stores.
  - Xtream API helpers.
  - Parsing utilities.
  - Metadata utilities.
- Rebuild UI using React Native components.
- Replace Dexie with native storage/database.
- Replace browser video with native video player.
- Add Android TV remote navigation.
- Build APK.
- Test on phone and TV device.

### Important
React Native is not a simple wrapper. It can reuse logic, but UI must be adapted.

## First Practical Step

Start with the Electron prototype first because it is faster and uses the current web app most directly.

### Electron Test Steps
1. Create a separate test branch/folder.
2. Add minimal Electron wrapper.
3. Build current web app.
4. Load `dist/index.html` inside Electron.
5. Add a temporary direct-play mode.
6. Test the same IPTV source and same problematic movie/series.
7. Check provider panel IP.
8. Decide if Windows app is worth continuing.

## Open Questions Before Starting

1. Test Windows first, then Android?
2. Is an Android TV / Fire TV device available for testing?
3. For the Electron test, use the real current app login flow or a quick hardcoded test stream first?

## Recommendation

Start with the Windows Electron prototype, then test Android if Windows proves the direct-access benefit.
