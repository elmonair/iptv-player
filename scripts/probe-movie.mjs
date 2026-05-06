import { spawn } from 'node:child_process'

function runFfprobe(url) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      url,
    ]

    const child = spawn('ffprobe', args, { stdio: ['ignore', 'pipe', 'pipe'] })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (err) => {
      reject(new Error(`Failed to start ffprobe: ${err.message}`))
    })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}. ${stderr.trim()}`))
        return
      }

      try {
        const parsed = JSON.parse(stdout)
        resolve(parsed)
      } catch (err) {
        reject(new Error(`Failed to parse ffprobe JSON: ${err.message}`))
      }
    })
  })
}

function summarize(data) {
  const streams = Array.isArray(data?.streams) ? data.streams : []
  const formatName = data?.format?.format_name ?? null
  const duration = data?.format?.duration ?? null

  const videoStreams = streams
    .filter((s) => s.codec_type === 'video')
    .map((s) => ({
      codec: s.codec_name ?? null,
      width: s.width ?? null,
      height: s.height ?? null,
      pix_fmt: s.pix_fmt ?? null,
    }))

  const audioStreams = streams
    .filter((s) => s.codec_type === 'audio')
    .map((s) => ({
      index: s.index ?? null,
      codec: s.codec_name ?? null,
      language: s?.tags?.language ?? null,
      channels: s.channels ?? null,
    }))

  const subtitleStreams = streams
    .filter((s) => s.codec_type === 'subtitle')
    .map((s) => ({
      index: s.index ?? null,
      codec: s.codec_name ?? null,
      language: s?.tags?.language ?? null,
    }))

  return {
    format: {
      name: formatName,
      duration,
    },
    videoStreams,
    audioStreams,
    subtitleStreams,
  }
}

async function main() {
  const url = process.argv[2]

  if (!url) {
    console.error('Usage: node scripts/probe-movie.mjs "FULL_MOVIE_STREAM_URL"')
    process.exit(1)
  }

  try {
    const data = await runFfprobe(url)
    const summary = summarize(data)
    console.log(JSON.stringify(summary, null, 2))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[probe:movie] Error:', message)
    process.exit(1)
  }
}

main()
