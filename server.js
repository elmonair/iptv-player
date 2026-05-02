import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { spawn } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, 'dist');

app.use(express.json());

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
  const seek = requestUrl.searchParams.get('seek');
  console.log('[TRANSCODE] Starting:', upstreamUrl.replace(/password=[^&]+/, 'password=[HIDDEN]'), seek ? `seek=${seek}s` : 'no seek');

  const ffmpegArgs = [
    '-hide_banner',
    '-loglevel', 'warning',
  ];

  if (seek && Number(seek) > 0) {
    ffmpegArgs.push('-ss', String(Math.floor(Number(seek))));
  }

  ffmpegArgs.push(
    '-i', upstreamUrl,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ac', '2',
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

app.use(express.static(distPath));

app.get(/.*/, (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/proxy/') || req.path.startsWith('/transcode')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log('m2player running on port ' + PORT);
  console.log('[PROXY] Enabled routes: /api/xtream, /proxy/live, /proxy/movie, /proxy/series, /proxy/image, /api/xmltv, /transcode');
});