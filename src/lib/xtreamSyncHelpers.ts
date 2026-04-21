import {
  db,
  type CategoryRecord,
  type ChannelRecord,
  type MovieRecord,
  type SeriesRecord,
} from './db'

const BATCH_SIZE = 500

export function makeId(sourceId: string, externalId: string): string {
  return `${sourceId}:${externalId}`
}

export async function clearAndSaveCategories(sourceId: string, type: 'live' | 'movie' | 'series', categories: Array<{ category_id: string; category_name: string }>) {
  await db.categories.where('sourceId').equals(sourceId).and((c) => c.type === type).delete()

  const records: CategoryRecord[] = categories.map((cat) => ({
    id: makeId(sourceId, cat.category_id),
    sourceId,
    type,
    externalId: cat.category_id,
    name: cat.category_name,
  }))
  await db.categories.bulkPut(records)
}

export async function clearAndSaveChannels(sourceId: string, streams: Array<{ stream_id: number; name: string; stream_icon: string; epg_channel_id: string; category_id: string; stream_type: string }>) {
  await db.channels.where('sourceId').equals(sourceId).delete()

  const records: ChannelRecord[] = streams.map((stream) => ({
    id: makeId(sourceId, String(stream.stream_id)),
    sourceId,
    externalId: String(stream.stream_id),
    name: stream.name,
    logoUrl: stream.stream_icon || undefined,
    streamId: String(stream.stream_id),
    categoryId: makeId(sourceId, stream.category_id),
    tvgId: undefined,
    epgChannelId: stream.epg_channel_id || undefined,
    streamType: stream.stream_type,
  }))

  await db.channels.bulkPut(records)
}

export async function clearAndSaveMovies(sourceId: string, streams: Array<{ stream_id: number; name: string; stream_icon: string; category_id: string; container_extension: string; rating_5based: number }>) {
  await db.movies.where('sourceId').equals(sourceId).delete()

  const records: MovieRecord[] = streams.map((stream) => ({
    id: makeId(sourceId, String(stream.stream_id)),
    sourceId,
    externalId: String(stream.stream_id),
    name: stream.name,
    logoUrl: stream.stream_icon || undefined,
    streamId: String(stream.stream_id),
    categoryId: makeId(sourceId, stream.category_id),
    containerExtension: stream.container_extension || undefined,
    year: undefined,
    rating: stream.rating_5based || undefined,
    plot: undefined,
    genre: undefined,
    cast: undefined,
    director: undefined,
    releaseDate: undefined,
    durationSeconds: undefined,
  }))

  await db.movies.bulkPut(records)
}

export async function clearAndSaveSeries(sourceId: string, seriesList: Array<{ series_id: number; name: string; cover: string; backdrop_path: string; category_id: string; releaseDate: string; rating_5based: number; plot: string; cast: string; director: string; genre: string }>) {
  await db.series.where('sourceId').equals(sourceId).delete()

  const records: SeriesRecord[] = seriesList.map((series) => ({
    id: makeId(sourceId, String(series.series_id)),
    sourceId,
    externalId: String(series.series_id),
    name: series.name,
    logoUrl: series.cover || undefined,
    backdropUrl: series.backdrop_path || undefined,
    categoryId: makeId(sourceId, series.category_id),
    year: series.releaseDate ? parseInt(series.releaseDate.split('-')[0]) : undefined,
    rating: series.rating_5based || undefined,
    plot: series.plot || undefined,
    genre: series.genre || undefined,
    cast: series.cast || undefined,
    director: series.director || undefined,
    releaseDate: series.releaseDate || undefined,
  }))

  await db.series.bulkPut(records)
}

export async function saveInBatches<T>(records: T[], table: { bulkPut: (items: T[]) => Promise<void> }, onProgress: (loaded: number, total: number) => void) {
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    await table.bulkPut(batch)
    const loaded = Math.min(i + BATCH_SIZE, records.length)
    onProgress(loaded, records.length)
  }
}

export { BATCH_SIZE }
