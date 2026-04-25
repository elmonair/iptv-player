export function srtToVtt(srtText: string): string {
  const lines = srtText.split(/\r?\n/)
  const vttLines: string[] = ['WEBVTT', '']

  let i = 0
  while (i < lines.length) {
    // Skip empty lines
    while (i < lines.length && lines[i].trim() === '') i++
    if (i >= lines.length) break

    // Skip sequence number
    if (/^\d+$/.test(lines[i].trim())) i++
    if (i >= lines.length) break

    // Parse timestamp line
    const timeLine = lines[i]?.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    if (timeLine && timeLine.includes('-->')) {
      vttLines.push(timeLine)
      i++
      // Collect text lines
      while (i < lines.length && lines[i].trim() !== '') {
        vttLines.push(lines[i])
        i++
      }
      vttLines.push('')
    } else {
      i++
    }
  }

  return vttLines.join('\n')
}

export function isSrtUrl(url: string): boolean {
  return url.toLowerCase().endsWith('.srt')
}

export function isVttUrl(url: string): boolean {
  return url.toLowerCase().endsWith('.vtt')
}

export function isSubtitlesUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return lower.endsWith('.srt') || lower.endsWith('.vtt') || lower.includes('subtitle') || lower.includes('subtitles')
}

export async function loadSubtitleAsTrack(videoEl: HTMLVideoElement, url: string, label: string, language: string): Promise<HTMLTrackElement | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error('[Subtitles] Failed to fetch:', url, response.status)
      return null
    }

    const text = await response.text()

    let vttContent: string
    if (isSrtUrl(url)) {
      vttContent = srtToVtt(text)
    } else {
      vttContent = text
    }

    const blob = new Blob([vttContent], { type: 'text/vtt' })
    const blobUrl = URL.createObjectURL(blob)

    const track = document.createElement('track')
    track.kind = 'subtitles'
    track.label = label || 'Subtitles'
    track.srclang = language || 'en'
    track.src = blobUrl

    videoEl.appendChild(track)

    console.log('[Subtitles] Added track:', { label, language, url })
    return track
  } catch (err) {
    console.error('[Subtitles] Error loading subtitle:', url, err)
    return null
  }
}