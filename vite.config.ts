import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { delimiter, join } from 'node:path'
import { Readable } from 'node:stream'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

type FfprobeStream = {
  index?: number
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
  channels?: number
  tags?: {
    language?: string
    title?: string
  }
}

type FfprobeResult = {
  streams?: FfprobeStream[]
  format?: {
    duration?: string
  }
}

function findBinary(name: 'ffprobe' | 'ffmpeg'): string | null {
  const executable = process.platform === 'win32' ? `${name}.exe` : name
  const pathEntries = (process.env.PATH || '').split(delimiter).filter(Boolean)
  const pathCandidates = pathEntries.map((entry) => join(entry, executable))
  const priorityCandidates = process.platform === 'win32'
    ? [
        `C:\\ffmpeg\\bin\\${executable}`,
        `C:\\Program Files\\ffmpeg\\bin\\${executable}`,
      ]
    : []

  for (const candidate of [...priorityCandidates, ...pathCandidates]) {
    if (existsSync(candidate)) {
      console.log(`[FFPROBE PATHS] Found ${name} at:`, candidate)
      return candidate
    }
  }

  console.log(`[FFPROBE PATHS] ${name} not found in priority paths or PATH`)
  return executable
}

function execFilePromise(file: string, args: string[], timeout = 30000): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(file, args, { timeout, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        rejectPromise({ error, stdout, stderr, exitCode: error?.code as number | null || null })
        return
      }
      resolvePromise({ stdout, stderr, exitCode: 0 })
    })
  })
}

function buildMediaSummary(parsed: FfprobeResult, ffprobePath: string, normalizedUrl: string) {
  const streams = Array.isArray(parsed.streams) ? parsed.streams : []
  const videoStreams = streams.filter((stream) => stream.codec_type === 'video')
  const audioStreams = streams.filter((stream) => stream.codec_type === 'audio')
  const subtitleStreams = streams.filter((stream) => stream.codec_type === 'subtitle')

  console.log('[DEBUG-MEDIA] Stream counts:', {
    video: videoStreams.length,
    audio: audioStreams.length,
    subtitles: subtitleStreams.length,
    total: streams.length,
  })

  return {
    normalizedUrl,
    ffprobePath,
    video: videoStreams.map((stream) => ({
      index: stream.index,
      codec: stream.codec_name,
      width: stream.width,
      height: stream.height,
      language: stream.tags?.language,
    })),
    audio: audioStreams.map((stream) => ({
      index: stream.index,
      codec: stream.codec_name,
      channels: stream.channels,
      language: stream.tags?.language,
    })),
    subtitles: subtitleStreams.map((stream) => ({
      index: stream.index,
      codec: stream.codec_name,
      language: stream.tags?.language,
      title: stream.tags?.title,
    })),
    streamCounts: {
      video: videoStreams.length,
      audio: audioStreams.length,
      subtitles: subtitleStreams.length,
      total: streams.length,
    },
    raw: parsed,
  }
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

async function proxyLiveStream(req: IncomingMessage, res: ServerResponse, targetUrl: string) {
  const upstreamUrl = new URL(targetUrl)
  const referer = `${upstreamUrl.protocol}//${upstreamUrl.host}`
  const requestHeaders = new Headers({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    'Referer': referer,
    'Connection': 'keep-alive',
  })
  const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : null

  if (rangeHeader) {
    requestHeaders.set('range', rangeHeader)
  }

  // Connection timeout ONLY - aborts if upstream doesn't respond in 10s.
  // Once headers arrive, we do NOT timeout the streaming body.
  const controller = new AbortController()
  const connectTimeoutId = setTimeout(
    () => controller.abort(new Error('Connection timeout after 10 seconds')),
    10000,
  )

  let upstream: Response
  try {
    console.log('[LIVE PROXY] Requesting upstream URL:', targetUrl)
    upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: requestHeaders,
      redirect: 'follow',
      signal: controller.signal,
    })
    // CRITICAL: Clear timeout the moment headers arrive.
    clearTimeout(connectTimeoutId)
  } catch (err) {
    clearTimeout(connectTimeoutId)
    console.error('[LIVE PROXY] Upstream request failed:', {
      url: targetUrl,
      reason: err instanceof Error ? err.message : String(err),
    })
    if (!res.headersSent) {
      sendJson(res, 503, {
        error: 'Live stream proxy connection failed',
        details: err instanceof Error ? err.message : String(err),
      })
    }
    return
  }

  if (!upstream.ok || !upstream.body) {
    const errorText = await upstream.text().catch(() => '')
    console.error('[LIVE PROXY] Upstream returned bad response:', {
      url: targetUrl,
      status: upstream.status,
      details: errorText.slice(0, 300),
    })
    sendJson(res, 503, {
      error: 'Live stream proxy request failed',
      status: upstream.status,
      details: errorText.slice(0, 300),
    })
    return
  }

  res.statusCode = upstream.status
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-cache')

  // Pass through upstream Content-Type as-is. Live streams are MPEG-TS.
  // Do NOT override this header.
  const upstreamContentType = upstream.headers.get('content-type') || 'video/mp2t'
  res.setHeader('Content-Type', upstreamContentType)

  const passthroughHeaders = [
    'accept-ranges',
    'content-length',
    'content-range',
    'etag',
    'last-modified',
  ]

  for (const headerName of passthroughHeaders) {
    const headerValue = upstream.headers.get(headerName)
    if (headerValue) {
      res.setHeader(headerName, headerValue)
    }
  }

  // Pipe stream directly. Handle client disconnect to clean up upstream connection.
  const stream = Readable.fromWeb(upstream.body as globalThis.ReadableStream<Uint8Array>)

  req.on('close', () => {
    stream.destroy()
  })

  stream.on('error', (err) => {
    console.error('[LIVE PROXY] Stream error:', err.message)
    if (!res.headersSent) {
      res.statusCode = 503
    }
    res.end()
  })

  stream.pipe(res)
}

function normalizeMediaUrl(url: string): { normalizedUrl: string; valid: boolean; error?: string } {
  const trimmed = url.trim()

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return { normalizedUrl: trimmed, valid: true }
  }

  if (trimmed.startsWith('//')) {
    return { normalizedUrl: `https:${trimmed}`, valid: true }
  }

  const domainRegex = /^([a-z0-9-]+(\.[a-z0-9-]+)+)(\/.*)?$/i
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/
  if (domainRegex.test(trimmed) || ipRegex.test(trimmed)) {
    return { normalizedUrl: `http://${trimmed}`, valid: true }
  }

  return {
    normalizedUrl: trimmed,
    valid: false,
    error: 'URL must start with http://, https://, //, a domain, or an IP address',
  }
}

function detectProviderBlockedError(stderr: string, exitCode: number | null): boolean {
  if (!stderr) return false

  const lowerStderr = stderr.toLowerCase()
  return (
    lowerStderr.includes('509') ||
    lowerStderr.includes('513') ||
    lowerStderr.includes('http error 5') ||
    lowerStderr.includes('403') ||
    lowerStderr.includes('forbidden') ||
    lowerStderr.includes('unauthorized') ||
    (exitCode !== null && exitCode >= 400)
  )
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'media-debug-and-hls-endpoints',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url || ''

          if (url.startsWith('/api/debug-media-tracks')) {
            const requestUrl = new URL(url, 'http://localhost')
            const rawMediaUrl = requestUrl.searchParams.get('url')

            console.log('[DEBUG-MEDIA] Raw URL query param:', rawMediaUrl)

            if (!rawMediaUrl) {
              sendJson(res, 400, { error: 'Missing url parameter' })
              return
            }

            const { normalizedUrl, valid, error: normError } = normalizeMediaUrl(rawMediaUrl)
            console.log('[DEBUG-MEDIA] Normalized URL:', normalizedUrl)

            if (!valid) {
              sendJson(res, 400, {
                error: normError,
                rawUrl: rawMediaUrl,
                hint: 'URL must include protocol (http://, https://) or start with //, domain, or IP address',
              })
              return
            }

            const ffprobePath = findBinary('ffprobe')
            console.log('[DEBUG-MEDIA] Detected ffprobe path:', ffprobePath)

            if (!ffprobePath) {
              sendJson(res, 500, {
                error: 'ffprobe not found',
                setup: [
                  'Install FFmpeg and ensure ffprobe is available.',
                  'Windows PATH: add the FFmpeg bin folder containing ffprobe.exe.',
                  'Supported fallback paths checked:',
                  'C:\\ffmpeg\\bin\\ffprobe.exe',
                  'C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe',
                ],
                rawUrl: rawMediaUrl,
                normalizedUrl,
              })
              return
            }

            const ffprobeArgs = ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', normalizedUrl]
            console.log('[DEBUG-MEDIA] Executing ffprobe command:', { path: ffprobePath, args: ffprobeArgs })

            try {
              const { stdout, stderr, exitCode } = await execFilePromise(ffprobePath, ffprobeArgs, 60000)
              console.log('[DEBUG-MEDIA] ffprobe exit code:', exitCode)

              if (stderr) {
                console.log('[DEBUG-MEDIA] ffprobe stderr:', stderr)
              }

              const parsed = JSON.parse(stdout) as FfprobeResult
              sendJson(res, 200, buildMediaSummary(parsed, ffprobePath, normalizedUrl))
            } catch (err) {
              const details = err as { error?: Error; stderr?: string; stdout?: string; exitCode?: number | null }
              console.error('[DEBUG-MEDIA] ffprobe failed:', {
                exitCode: details.exitCode,
                stderr: details.stderr,
                error: details.error?.message,
              })

              const isProviderBlocked = detectProviderBlockedError(details.stderr || '', details.exitCode || null)

              sendJson(res, 500, {
                error: isProviderBlocked
                  ? 'Provider blocks FFmpeg processing (HTTP 509/513 or similar). Use Direct Play or Open External.'
                  : (details.error?.message || 'ffprobe failed'),
                stderr: details.stderr,
                stdout: details.stdout,
                exitCode: details.exitCode,
                ffprobePath,
                rawUrl: rawMediaUrl,
                normalizedUrl,
                isProviderBlocked,
                hint: isProviderBlocked
                  ? 'This provider blocks server-side processing. Try Direct Play mode or open in an external player.'
                  : 'Ensure ffprobe is installed and accessible on Windows, and the URL is accessible.',
              })
            }
            return
          }

          if (url.startsWith('/api/hls')) {
            sendJson(res, 410, { error: 'HLS mode disabled' })
            return
          }

          if (url.startsWith('/proxy/live/')) {
            const requestUrl = new URL(url, 'http://localhost')
            const pathMatch = requestUrl.pathname.match(/^\/proxy\/live\/([^/]+)\/(\d+)$/)
            const serverUrl = requestUrl.searchParams.get('serverUrl')
            const username = requestUrl.searchParams.get('username')
            const password = requestUrl.searchParams.get('password')

            if (!pathMatch || !serverUrl || !username || !password) {
              sendJson(res, 400, { error: 'Missing live proxy parameters' })
              return
            }

            const [, _playlistId, streamId] = pathMatch
            const targetUrl = `${serverUrl.replace(/\/$/, '')}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${encodeURIComponent(streamId)}.ts`
            console.log('[LIVE PROXY] Built upstream URL:', {
              sourceId: _playlistId,
              streamId,
              targetUrl,
            })

            try {
              await proxyLiveStream(req, res, targetUrl)
            } catch (err) {
              console.error('[LIVE PROXY] Failed:', {
                targetUrl,
                reason: err instanceof Error ? err.message : String(err),
              })
              sendJson(res, 503, {
                error: 'Live stream proxy failed',
                upstreamUrl: targetUrl,
                details: err instanceof Error ? err.message : String(err),
              })
            }
            return
          }

          next()
        })
      },
    },
  ],
})
