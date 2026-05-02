Electron Prototype Test - Windows Instructions
=============================================

This prototype tests whether the IPTV Player web app can run as a Windows desktop
application and bypass CORS/proxy issues.

What to Test:
1. Can the app load and login work?
2. Do Live TV, Movies, Series play directly (no proxy)?
3. Does the IPTV provider see YOUR IP instead of VPS IP?
4. Is playback better than web browser?
5. Do MKV files with E-AC3 audio play correctly?

Setup Steps (Run on Windows):
=================================

1. Install Node.js (LTS version) from https://nodejs.org/
2. Download this entire folder to your Windows machine
3. Open Command Prompt in this folder
4. Run: npm install
5. Run: npm start
6. The app should open in an Electron window

Testing Checklist:
- [ ] App opens successfully
- [ ] Login with your IPTV credentials works
- [ ] Live TV channel plays
- [ ] Movie plays (try a problematic MKV)
- [ ] Series episode plays
- [ ] Check your IPTV provider panel - does it show YOUR IP?
- [ ] Compare video quality to web browser
- [ ] Is the experience better or worse?

Notes:
- DevTools will open automatically for debugging
- Web security is disabled (bypasses CORS)
- This is a prototype - no installer yet

If tests pass, we can build a proper Windows app.
If tests fail, we'll stay with web app.
