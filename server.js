import express from 'express';
import path from 'path';
import { existsSync, mkdirSync, createReadStream, readFileSync, appendFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { spawn } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, 'dist');

app.use(express.json());

app.use('/hls', (req, res, next) => {
  console.log('[HLS DEBUG] incoming', req.method, req.originalUrl);
  next();
});

let ffmpegAvailable = false;

async function checkFFmpeg() {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);
    ffmpeg.on('error', () => {
      console.error('[FFMPEG] Not found - install with: apt install ffmpeg');
      console.error('[FFMPEG] Transcoding disabled - MKV/AVI files may play without audio');
      ffmpegAvailable = false;
      resolve(false);
    });
    ffmpeg.on('close', (code) => {
      ffmpegAvailable = code === 0;
      if (ffmpegAvailable) {
        console.log('[FFMPEG] Available - MKV/AVI audio will be transcoded to AAC');
      } else {
        console.error('[FFMPEG] Not available');
      }
      resolve(ffmpegAvailable);
    });
  });
}

checkFFmpeg();

const hlsCacheRoot = path.join(process.cwd(), 'hls-cache');
if (!existsSync(hlsCacheRoot)) {
  mkdirSync(hlsCacheRoot, { recursive: true });
}

const hlsMovieJobs = new Map();

function getMovieHlsDir(movieId) {
  return path.join(hlsCacheRoot, `movie-${movieId}`);
}

function getMovieMasterPath(movieId) {
  return path.join(getMovieHlsDir(movieId), 'master.m3u8');
}

function parseHmsToSeconds(hms) {
  const parts = hms.split(':').map((v) => Number(v));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 0;
  return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
}

function getPlaylistDurationSeconds(masterPath) {
  if (!existsSync(masterPath)) return 0;
  const playlist = readFileSync(masterPath, 'utf8');
  const matches = playlist.match(/#EXTINF:([0-9.]+),/g) || [];
  let total = 0;
  for (const entry of matches) {
    const value = Number(entry.replace('#EXTINF:', '').replace(',', '').trim());
    if (!Number.isNaN(value)) total += value;
  }
  return total;
}

function startMovieHlsGeneration(movieId, upstreamUrl, options = {}) {
  const existing = hlsMovieJobs.get(movieId);
  if (existing) return existing;

  const movieDir = getMovieHlsDir(movieId);
  try {
    if (!existsSync(movieDir)) {
      mkdirSync(movieDir, { recursive: true });
    }
  } catch (err) {
    console.error('[HLS] Failed to create cache directory:', {
      movieId,
      movieDir,
      error: err instanceof Error ? err.message : String(err),
      hint: 'Ensure hls-cache is owned by m2player:m2player',
    });
    return null;
  }

  const masterPath = getMovieMasterPath(movieId);
  const segmentPattern = path.join(movieDir, 'seg_%05d.ts');

  const ffmpegArgs = [
    '-y',
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_at_eof', '1',
    '-reconnect_delay_max', '10',
    '-rw_timeout', '15000000',
    '-i', upstreamUrl,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-vf', "scale='min(1920,iw)':-2",
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-crf', '28',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-ac', '2',
    '-f', 'hls',
    '-hls_time', '6',
    '-hls_list_size', '0',
    '-hls_flags', 'independent_segments+append_list',
    '-hls_segment_type', 'mpegts',
    '-hls_segment_filename', segmentPattern,
    masterPath,
  ];

  console.log('[HLS] Starting movie generation:', {
    movieId,
    upstreamUrl: upstreamUrl.replace(/password=[^&]+/, 'password=[HIDDEN]'),
    masterPath,
    segmentPattern,
  });

  const ffmpeg = spawn('ffmpeg', ffmpegArgs);
  let stderrBuffer = '';
  let expectedDurationSeconds = 0;
  let lastProgressLogAt = 0;

  ffmpeg.stderr.on('data', (d) => {
    const line = d.toString().trim();
    if (!line) return;
    stderrBuffer += `${line}\n`;
    const durationMatch = line.match(/DURATION\s*:\s*(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/i);
    if (durationMatch) {
      expectedDurationSeconds = parseHmsToSeconds(durationMatch[1]);
    }
    const speedMatch = line.match(/speed=\s*([0-9.]+)x/i);
    const now = Date.now();
    if (speedMatch && now - lastProgressLogAt > 5000) {
      lastProgressLogAt = now;
      console.log('[HLS progress]', {
        movieId,
        speedX: Number(speedMatch[1]),
      });
    }
    console.log(`[HLS ffmpeg][${movieId}]`, line);
  });

  ffmpeg.on('error', (err) => {
    console.error('[HLS] ffmpeg error:', err.message);
  });

  ffmpeg.on('close', (code, signal) => {
    const prematureError = /Stream ends prematurely|Input\/output error/i.test(stderrBuffer);
    let playlistDurationSeconds = 0;
    try {
      playlistDurationSeconds = getPlaylistDurationSeconds(masterPath);
    } catch {
      playlistDurationSeconds = 0;
    }
    const shortPlaylist = expectedDurationSeconds > 0 && playlistDurationSeconds > 0
      ? playlistDurationSeconds < (expectedDurationSeconds * 0.9)
      : false;
    const incompleteGeneration = prematureError && shortPlaylist;

    console.log('[HLS] ffmpeg exited:', {
      movieId,
      code,
      signal,
      expectedDurationSeconds,
      playlistDurationSeconds,
      prematureError,
      shortPlaylist,
      incompleteGeneration,
    });

    if (code === 0 && !incompleteGeneration && existsSync(masterPath)) {
      try {
        const playlist = readFileSync(masterPath, 'utf8');
        if (!playlist.includes('#EXT-X-ENDLIST')) {
          appendFileSync(masterPath, '\n#EXT-X-ENDLIST\n');
        }
      } catch (err) {
        console.error('[HLS] Failed to finalize playlist:', err instanceof Error ? err.message : String(err));
      }
    } else if (incompleteGeneration) {
      console.error('[HLS] Incomplete generation detected, ENDLIST not appended:', {
        movieId,
        expectedDurationSeconds,
        playlistDurationSeconds,
      });
    }
    hlsMovieJobs.delete(movieId);
  });

  const job = { ffmpeg, startedAt: Date.now(), masterPath };
  hlsMovieJobs.set(movieId, job);
  return job;
}

async function proxyRequest(req, res, targetUrl, options = {}) {
  const timeout = options.timeout || 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  console.log('[PROXY]', req.method, req.url, '->', targetUrl.replace(/password=[^&]+/, 'password=[HIDDEN]'));

  try {
    const headers = new Headers();
    if (req.headers.range) {
      headers.set('Range', req.headers.range);
    }
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    headers.set('Referer', new URL(targetUrl).origin);
    headers.set('Connection', 'keep-alive');

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => '');
      console.error('[PROXY] Upstream error:', response.status, response.statusText, errorText.slice(0, 200));
      res.status(response.status).json({
        error: 'Proxy request failed',
        status: response.status,
        details: errorText.slice(0, 300)
      });
      return;
    }

    res.status(response.status);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');

    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    const streamHeaders = ['accept-ranges', 'content-length', 'content-range', 'etag', 'last-modified'];
    for (const header of streamHeaders) {
      const value = response.headers.get(header);
      if (value) res.setHeader(header, value);
    }

    const stream = Readable.fromWeb(response.body);

    req.on('close', () => stream.destroy());
    stream.on('error', (err) => {
      console.error('[PROXY] Stream error:', err.message);
      if (!res.headersSent) res.status(503).end();
    });

    stream.pipe(res);

  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[PROXY] Request failed:', err instanceof Error ? err.message : String(err));
    if (!res.headersSent) {
      res.status(503).json({
        error: 'Proxy connection failed',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  }
}

app.use('/api/xtream', async (req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost:' + PORT);
  const serverUrl = requestUrl.searchParams.get('serverUrl');

  if (!serverUrl) {
    return res.status(400).json({ error: 'Missing serverUrl parameter' });
  }

  requestUrl.searchParams.delete('serverUrl');
  const targetUrl = serverUrl.replace(/\/$/, '') + '/player_api.php' + (requestUrl.search || '');

  await proxyRequest(req, res, targetUrl);
});

app.use('/proxy/live/:sourceId/:streamId', async (req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost:' + PORT);
  const { sourceId, streamId } = req.params;
  const serverUrl = requestUrl.searchParams.get('serverUrl');
  const username = requestUrl.searchParams.get('username');
  const password = requestUrl.searchParams.get('password');

  if (!serverUrl || !username || !password) {
    return res.status(400).json({ error: 'Missing live proxy parameters' });
  }

  const targetUrl = serverUrl.replace(/\/$/, '') + '/live/' + encodeURIComponent(username) + '/' + encodeURIComponent(password) + '/' + encodeURIComponent(streamId) + '.ts';
  await proxyRequest(req, res, targetUrl, { timeout: 10000 });
});

app.use('/proxy/movie/:sourceId/:filename', async (req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost:' + PORT);
  const { sourceId, filename } = req.params;
  const serverUrl = requestUrl.searchParams.get('serverUrl');
  const username = requestUrl.searchParams.get('username');
  const password = requestUrl.searchParams.get('password');

  if (!serverUrl || !username || !password) {
    return res.status(400).json({ error: 'Missing movie proxy parameters' });
  }

  const targetUrl = serverUrl.replace(/\/$/, '') + '/movie/' + encodeURIComponent(username) + '/' + encodeURIComponent(password) + '/' + filename;
  await proxyRequest(req, res, targetUrl, { timeout: 30000 });
});

app.use('/proxy/series/:sourceId/:filename', async (req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost:' + PORT);
  const { sourceId, filename } = req.params;
  const serverUrl = requestUrl.searchParams.get('serverUrl');
  const username = requestUrl.searchParams.get('username');
  const password = requestUrl.searchParams.get('password');

  if (!serverUrl || !username || !password) {
    return res.status(400).json({ error: 'Missing series proxy parameters' });
  }

  const targetUrl = serverUrl.replace(/\/$/, '') + '/series/' + encodeURIComponent(username) + '/' + encodeURIComponent(password) + '/' + filename;
  await proxyRequest(req, res, targetUrl, { timeout: 30000 });
});

app.use('/transcode/:type/:streamId', async (req, res) => {
  const { type, streamId } = req.params;
  const requestUrl = new URL(req.url, 'http://localhost:' + PORT);
  const serverUrl = requestUrl.searchParams.get('serverUrl');
  const username = requestUrl.searchParams.get('username');
  const password = requestUrl.searchParams.get('password');
  const ext = requestUrl.searchParams.get('ext') || 'mkv';
  const seek = requestUrl.searchParams.get('seek');
  const audioTrack = requestUrl.searchParams.get('audioTrack');
  const subtitleTrack = requestUrl.searchParams.get('subtitleTrack');

  if (!serverUrl || !username || !password) {
    return res.status(400).json({ error: 'Missing transcode parameters' });
  }

  if (!ffmpegAvailable) {
    console.error('[TRANSCODE] FFmpeg not available');
    return res.status(503).json({
      error: 'FFmpeg not available on server',
      hint: 'Transcoding requires FFmpeg to be installed on the VPS'
    });
  }

  if (type !== 'movie' && type !== 'series') {
    return res.status(400).json({ error: 'Type must be movie or series' });
  }

  const upstreamUrl = `${serverUrl.replace(/\/$/, '')}/${type}/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${encodeURIComponent(streamId)}.${encodeURIComponent(ext)}`;
  console.log('[TRANSCODE] Starting:', upstreamUrl.replace(/password=[^&]+/, 'password=[HIDDEN]'), seek ? `seek=${seek}s` : 'no seek', audioTrack !== null ? `audio=${audioTrack}` : 'default audio', subtitleTrack !== null && subtitleTrack !== 'none' ? `subtitles=${subtitleTrack}` : '');

  const ffmpegArgs = [
    '-hide_banner',
    '-loglevel', 'warning',
  ];

  if (seek && Number(seek) > 0) {
    ffmpegArgs.push('-ss', String(Math.floor(Number(seek))));
  }

  ffmpegArgs.push('-i', upstreamUrl);

  let hasVideoCopy = false
  if (audioTrack !== null && audioTrack !== undefined) {
    ffmpegArgs.push('-map', `0:${audioTrack}`, '-map', '0:v:0');
    if (subtitleTrack && subtitleTrack !== 'none') {
      ffmpegArgs.push('-map', `0:${subtitleTrack}`);
    }
  } else {
    ffmpegArgs.push('-c:v', 'copy');
    hasVideoCopy = true;
  }

  ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k', '-ac', '2');

  if (subtitleTrack && subtitleTrack !== 'none') {
    if (hasVideoCopy) {
      ffmpegArgs.splice(ffmpegArgs.indexOf('-c:v'), 1);
    }
    ffmpegArgs.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23');
    const safeUrl = upstreamUrl.replace(/'/g, "'\\''")
    ffmpegArgs.push('-vf', `subtitles='${safeUrl}:si=${subtitleTrack}'`);
  }

  ffmpegArgs.push(
    '-movflags', '+frag_keyframe+empty_moov+default_base_moof+faststart',
    '-f', 'mp4',
    'pipe:1'
  );

  const ffmpeg = spawn('ffmpeg', ffmpegArgs);

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');

  req.on('close', () => {
    console.log('[TRANSCODE] Client disconnected, killing ffmpeg');
    ffmpeg.kill('SIGKILL');
  });

  ffmpeg.stderr.on('data', (d) => {
    const line = d.toString().trim();
    if (line) console.log('[ffmpeg]', line);
  });

  ffmpeg.on('error', (err) => {
    console.error('[TRANSCODE] ffmpeg error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Transcoding failed', details: err.message });
    }
  });

  ffmpeg.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log('[TRANSCODE] ffmpeg exited with code:', code);
    }
  });

  ffmpeg.stdout.pipe(res);
});

app.get('/probe/:type/:streamId', (req, res) => {
  const { type, streamId } = req.params;
  const requestUrl = new URL(req.url, 'http://localhost:' + PORT);
  const serverUrl = requestUrl.searchParams.get('serverUrl');
  const username = requestUrl.searchParams.get('username');
  const password = requestUrl.searchParams.get('password');
  const ext = requestUrl.searchParams.get('ext') || 'mkv';

  if (!serverUrl || !username || !password) {
    return res.status(400).json({ error: 'Missing params' });
  }

  if (!ffmpegAvailable) {
    return res.status(503).json({ error: 'FFmpeg not available' });
  }

  const upstreamUrl = `${serverUrl.replace(/\/$/, '')}/${type}/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${encodeURIComponent(streamId)}.${encodeURIComponent(ext)}`;

  const ffprobe = spawn('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    '-analyzeduration', '5000000',
    '-probesize', '5000000',
    upstreamUrl
  ]);

  let output = '';
  let errorOutput = '';

  ffprobe.stdout.on('data', d => output += d.toString());
  ffprobe.stderr.on('data', d => errorOutput += d.toString());

  ffprobe.on('error', (err) => {
    console.error('[PROBE] spawn error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'FFprobe unavailable', skip: true });
    }
  });

  const timeout = setTimeout(() => {
    ffprobe.kill('SIGKILL');
    if (!res.headersSent) res.status(504).json({ error: 'Probe timeout', skip: true });
  }, 15000);

  ffprobe.on('close', code => {
    clearTimeout(timeout);
    if (code !== 0) {
      console.error('[PROBE] ffprobe failed:', errorOutput);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Probe failed', stderr: errorOutput, skip: true });
      }
      return;
    }

    try {
      const data = JSON.parse(output);

      const audioTracks = data.streams
        .filter(s => s.codec_type === 'audio')
        .map((s, i) => ({
          index: s.index,
          codec: s.codec_name,
          language: s.tags?.language || 'unknown',
          title: s.tags?.title || `Audio ${i + 1}`,
          channels: s.channels,
          default: s.disposition?.default === 1
        }));

      const subtitleTracks = data.streams
        .filter(s => s.codec_type === 'subtitle')
        .map((s, i) => ({
          index: s.index,
          codec: s.codec_name,
          language: s.tags?.language || 'unknown',
          title: s.tags?.title || `Subtitle ${i + 1}`,
          default: s.disposition?.default === 1
        }));

      res.json({
        duration: Number(data.format?.duration) || 0,
        audioTracks,
        subtitleTracks
      });
    } catch (err) {
      console.error('[PROBE] Parse failed:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Parse failed', skip: true });
      }
    }
  });
});

app.use('/proxy/image', async (req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost:' + PORT);
  const imageUrl = requestUrl.searchParams.get('url');

  if (!imageUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    console.log('[IMAGE PROXY]', imageUrl);

    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok || !response.body) {
      console.error('[IMAGE PROXY] Failed:', response.status, response.statusText);
      return res.status(response.status).end();
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const cacheControl = response.headers.get('cache-control') || 'public, max-age=3600';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('Access-Control-Allow-Origin', '*');

    const stream = Readable.fromWeb(response.body);
    stream.pipe(res);

  } catch (err) {
    console.error('[IMAGE PROXY] Error:', err instanceof Error ? err.message : String(err));
    res.status(503).end();
  }
});

app.use('/api/xmltv', async (req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost:' + PORT);
  const serverUrl = requestUrl.searchParams.get('serverUrl');

  if (!serverUrl) {
    return res.status(400).json({ error: 'Missing serverUrl parameter' });
  }

  requestUrl.searchParams.delete('serverUrl');
  const targetUrl = serverUrl.replace(/\/$/, '') + '/xmltv.php' + (requestUrl.search || '');
  await proxyRequest(req, res, targetUrl, { timeout: 60000 });
});

app.get('/hls/movie/:movieId/master.m3u8', (req, res) => {
  const { movieId } = req.params;
  console.log('[HLS DEBUG] master route hit', req.params, req.query);
  const movieCacheDir = path.join(hlsCacheRoot, `movie-${movieId}`);
  const masterPath = path.join(movieCacheDir, 'master.m3u8');

  if (existsSync(masterPath)) {
    try {
      const playlist = readFileSync(masterPath, 'utf8');
      if (playlist.includes('#EXTM3U')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('ETag', `"hls-${movieId}-${Date.now()}-${playlist.length}"`);
        res.setHeader('Last-Modified', new Date().toUTCString());
        return res.status(200).send(playlist);
      }
    } catch (err) {
      console.error('[HLS] Failed to read playlist:', err instanceof Error ? err.message : String(err));
    }
  }

  if (hlsMovieJobs.has(movieId)) {
    return res.status(202).json({
      processing: true,
      movieId,
      message: 'HLS generation in progress',
    });
  }

  const requestUrl = new URL(req.url, 'http://localhost:' + PORT);
  const serverUrl = requestUrl.searchParams.get('serverUrl');
  const username = requestUrl.searchParams.get('username');
  const password = requestUrl.searchParams.get('password');
  const ext = requestUrl.searchParams.get('ext') || 'mkv';

  if (!serverUrl || !username || !password) {
    return res.status(400).json({ error: 'Missing HLS parameters' });
  }

  if (!ffmpegAvailable) {
    return res.status(503).json({ error: 'FFmpeg not available on server' });
  }

  const upstreamUrl = `${serverUrl.replace(/\/$/, '')}/movie/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${encodeURIComponent(movieId)}.${encodeURIComponent(ext)}`;
  const job = startMovieHlsGeneration(movieId, upstreamUrl);
  if (!job) {
    return res.status(500).json({
      error: 'Failed to start HLS generation',
      hint: 'Ensure hls-cache is owned by m2player:m2player',
    });
  }
  return res.status(202).json({
    processing: true,
    movieId,
    message: 'HLS generation started or already running',
  });
});

app.get('/hls/movie/:movieId/:file', (req, res) => {
  const { movieId, file } = req.params;
  console.log('[HLS DEBUG] file route hit', req.params);

  if (file.includes('..') || file.includes('/') || file.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(getMovieHlsDir(movieId), file);
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'HLS file not found' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  if (file.endsWith('.m3u8')) {
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  } else if (file.endsWith('.ts')) {
    res.setHeader('Content-Type', 'video/mp2t');
  }

  return createReadStream(filePath).pipe(res);
});

app.use(express.static(distPath));

app.use((req, res, next) => {
  if (req.path.startsWith('/hls/')) {
    console.warn('[HLS DEBUG] hls reached fallback guard', req.method, req.originalUrl);
    return res.status(404).json({
      error: 'HLS route not matched',
      path: req.path,
    });
  }
  next();
});

app.get(/.*/, (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/proxy/') || req.path.startsWith('/transcode') || req.path.startsWith('/probe')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log('m2player running on port ' + PORT);
  console.log('[PROXY] Enabled routes: /api/xtream, /proxy/live, /proxy/movie, /proxy/series, /proxy/image, /api/xmltv, /transcode, /hls/movie/:movieId/master.m3u8');
});
