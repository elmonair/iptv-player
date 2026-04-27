import { db } from './db'

export async function parseAndStoreXmltv(
  sourceUrl: string,
  username: string,
  password: string,
  sourceId: string,
  onProgress?: (loaded: number) => void
): Promise<{ totalPrograms: number; channelsWithEpg: number }> {
  const url = `${sourceUrl}/xmltv.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
  console.log('[EPG] Starting sync for source:', sourceId, 'from:', url.replace(username, '[USER]').replace(password, '[PASS]'))

  console.log('[EPG] Clearing old EPG data for source:', sourceId)
  await db.epg.where('sourceId').equals(sourceId).delete()

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch XMLTV: ${response.status} ${response.statusText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Response body is not readable')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let loadedPrograms = 0
  let batch: Array<{ channelId: string; title: string; description: string; start: number; stop: number; sourceId: string }> = []
  const BATCH_SIZE = 500
  const uniqueChannels = new Set<string>()
  const samplePrograms: Array<{ channelId: string; title: string; start: number; stop: number }> = []

  async function flushBatch() {
    if (batch.length === 0) return

    await db.epg.bulkPut(batch)
    loadedPrograms += batch.length
    onProgress?.(loadedPrograms)

    if (samplePrograms.length < 3) {
      for (const prog of batch) {
        if (samplePrograms.length < 3) {
          samplePrograms.push({
            channelId: prog.channelId,
            title: prog.title,
            start: prog.start,
            stop: prog.stop,
          })
        }
      }
    }

    if (loadedPrograms % 5000 === 0) {
      console.log(`[EPG] Parsed ${loadedPrograms} programmes, ${uniqueChannels.size} unique channels`)
    }

    batch = []
  }

  const PROGRAMME_START = '<programme'
  const PROGRAMME_END = '</programme>'

  async function* streamText(reader: ReadableStreamDefaultReader<Uint8Array>, decoder: TextDecoder): AsyncGenerator<string, void, unknown> {
    const { done, value } = await reader.read()
    if (done) return
    yield decoder.decode(value, { stream: true })
    yield* streamText(reader, decoder)
  }

  let currentProgramme: string | null = null

  try {
    for await (const chunk of streamText(reader, decoder)) {
      buffer += chunk

      let startIndex = 0

      while (true) {
        if (currentProgramme === null) {
          const progStart = buffer.indexOf(PROGRAMME_START, startIndex)
          if (progStart === -1) break

          const progEnd = buffer.indexOf(PROGRAMME_END, progStart)
          if (progEnd === -1) {
            currentProgramme = buffer.slice(progStart)
            buffer = buffer.slice(0, progStart)
            break
          }

          const programme = buffer.slice(progStart, progEnd + PROGRAMME_END.length)
          buffer = buffer.slice(progEnd + PROGRAMME_END.length)
          startIndex = 0

          if (!parseAndAddProgramme(programme, sourceId, uniqueChannels, batch)) continue

          if (batch.length >= BATCH_SIZE) {
            await flushBatch()
          }
        } else {
          const progEnd = buffer.indexOf(PROGRAMME_END)
          if (progEnd === -1) {
            currentProgramme += buffer
            buffer = ''
            break
          }

          currentProgramme += buffer.slice(0, progEnd + PROGRAMME_END.length)
          buffer = buffer.slice(progEnd + PROGRAMME_END.length)

          if (!parseAndAddProgramme(currentProgramme, sourceId, uniqueChannels, batch)) {
            currentProgramme = null
            continue
          }

          currentProgramme = null
          startIndex = 0

          if (batch.length >= BATCH_SIZE) {
            await flushBatch()
          }
        }
      }
    }

    if (currentProgramme) {
      parseAndAddProgramme(currentProgramme, sourceId, uniqueChannels, batch)
    }

    await flushBatch()

    console.log('[EPG] Complete!')
    console.log('[EPG] Total programmes:', loadedPrograms)
    console.log('[EPG] Unique channels with EPG:', uniqueChannels.size)
    console.log('[EPG] Sample programmes:')
    samplePrograms.forEach((prog, i) => {
      console.log(`  [${i + 1}]`)
      console.log(`      channelId: ${prog.channelId}`)
      console.log(`      title: ${prog.title}`)
      console.log(`      startTimestamp: ${prog.start} (${new Date(prog.start * 1000).toISOString()})`)
      console.log(`      stopTimestamp: ${prog.stop} (${new Date(prog.stop * 1000).toISOString()})`)
    })

    const now = Date.now()
    let meta = await db.syncMetadata.where('sourceId').equals(sourceId).first()
    if (meta) {
      await db.syncMetadata.update(meta.sourceId, { lastEpgSyncAt: now })
    } else {
      await db.syncMetadata.add({
        sourceId,
        lastSyncAt: now,
        lastEpgSyncAt: now,
        channelsCount: 0,
        moviesCount: 0,
        seriesCount: 0,
        syncStatus: 'idle',
      })
    }

    return { totalPrograms: loadedPrograms, channelsWithEpg: uniqueChannels.size }
  } catch (err) {
    console.error('[EPG] Error:', err)
    if (batch.length > 0) {
      await flushBatch()
    }
    throw err
  }

  function parseAndAddProgramme(
    xml: string,
    sourceId: string,
    uniqueChannels: Set<string>,
    batch: Array<{ channelId: string; title: string; description: string; start: number; stop: number; sourceId: string }>
  ): boolean {
    const channelMatch = xml.match(/channel="([^"]+)"/)
    const startMatch = xml.match(/start="([^"]+)"/)
    const stopMatch = xml.match(/stop="([^"]+)"/)
    const titleMatch = xml.match(/<title[^>]*>([^<]+)<\/title>/i)
    const descMatch = xml.match(/<desc[^>]*>([^<]*)<\/desc>/i)

    if (!channelMatch || !startMatch || !stopMatch || !titleMatch) return false

    const start = parseXmltvDate(startMatch[1])
    const stop = parseXmltvDate(stopMatch[1])

    if (!start || !stop) return false

    uniqueChannels.add(channelMatch[1])

    batch.push({
      channelId: channelMatch[1],
      title: titleMatch[1].trim(),
      description: descMatch ? descMatch[1].trim() : '',
      start,
      stop,
      sourceId,
    })

    return true
  }

  function parseXmltvDate(dateStr: string): number | null {
    try {
      const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s+([+-])(\d{2})(\d{2})$/)
      if (!match) return null

      const [, year, month, day, hour, minute, second, sign, tzh, tzm] = match
      const tzHours = parseInt(tzh, 10)
      const tzMins = parseInt(tzm, 10)
      const tzOffsetMs = (tzHours * 60 + tzMins) * 60 * 1000 * (sign === '+' ? 1 : -1)

      const isoStr = `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${tzh}:${tzm}`
      const date = new Date(isoStr)

      return Math.floor((date.getTime() - tzOffsetMs) / 1000)
    } catch {
      return null
    }
  }
}

export async function getEpgForChannel(
  channelId: string,
  _sourceId: string,
  currentTime?: number
): Promise<{ current: EpgProgram | null; next: EpgProgram | null }> {
  const now = currentTime || Math.floor(Date.now() / 1000)

  const nowPlaying = await db.epg
    .where('[channelId+start]')
    .between([channelId, 0], [channelId, now])
    .reverse()
    .first()

  const nextProgram = nowPlaying && nowPlaying.stop > now && nowPlaying.start <= now
    ? await db.epg
        .where('[channelId+start]')
        .between([channelId, now + 1], [channelId, Infinity])
        .first()
    : null

  const current = nowPlaying && nowPlaying.stop > now && nowPlaying.start <= now
    ? { id: String(nowPlaying.id), title: nowPlaying.title, description: nowPlaying.description, startTimestamp: nowPlaying.start, endTimestamp: nowPlaying.stop }
    : null

  const next = nextProgram
    ? { id: String(nextProgram.id), title: nextProgram.title, description: nextProgram.description, startTimestamp: nextProgram.start, endTimestamp: nextProgram.stop }
    : null

  return { current, next }
}

export interface EpgProgram {
  id: string
  title: string
  description: string
  startTimestamp: number
  endTimestamp: number
}

export async function clearEpgForSource(sourceId: string): Promise<number> {
  return await db.epg.where('sourceId').equals(sourceId).delete()
}
