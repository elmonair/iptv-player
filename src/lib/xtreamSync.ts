import type { PlaylistSource, XtreamSource } from '../stores/playlistStore'
import {
  getUserInfo,
  getLiveCategories,
  getLiveStreams,
  getVodCategories,
  getVodStreams,
  getSeriesCategories,
  getSeriesList,
} from './xtream'
import { db } from './db'
import { makeId, saveInBatches } from './xtreamSyncHelpers'
import { saveCategories } from './xtreamSyncCategories'

export type SyncPhase =
  | 'auth'
  | 'live-categories'
  | 'live-streams'
  | 'vod-categories'
  | 'vod-streams'
  | 'series-categories'
  | 'series-list'
  | 'complete'
  | 'error'

export type SyncProgress = {
  phase: SyncPhase
  message: string
  percent: number
}

export async function syncXtreamPlaylist(
  source: PlaylistSource,
  onProgress: (update: SyncProgress) => void,
): Promise<void> {
  if (source.type !== 'xtream') {
    throw new Error('Source is not an Xtream Codes source')
  }
  const xtreamSource = source as XtreamSource
  const serverUrl = xtreamSource.serverUrl
  const credentials = {
    username: xtreamSource.username,
    password: xtreamSource.password,
  }

  try {
    onProgress({ phase: 'auth', message: 'Authenticating...', percent: 2 })
    const userInfo = await getUserInfo(serverUrl, credentials)
    if (userInfo.user_info.auth !== 1) {
      throw new Error('Xtream authentication failed — check your credentials')
    }
    console.log('[Xtream Sync] Authenticated for user:', userInfo.user_info.username)

    await db.syncMetadata.put({
      sourceId: source.id,
      lastSyncAt: 0,
      channelsCount: 0,
      moviesCount: 0,
      seriesCount: 0,
      syncStatus: 'syncing',
    })

    onProgress({ phase: 'live-categories', message: 'Loading live TV categories...', percent: 5 })
    const liveCategories = await getLiveCategories(serverUrl, credentials)
    console.log(`[Xtream Sync] ${liveCategories.length} live categories`)
    await saveCategories(source.id, 'live', liveCategories)

    onProgress({ phase: 'live-streams', message: 'Loading live TV channels...', percent: 10 })
    const liveStreams = await getLiveStreams(serverUrl, credentials)
    console.log(`[Xtream Sync] ${liveStreams.length} live streams`)

    await db.channels.where('sourceId').equals(source.id).delete()

    const channelRecords = liveStreams.map((stream) => ({
      id: makeId(source.id, `live-${stream.stream_id}`),
      sourceId: source.id,
      externalId: String(stream.stream_id),
      name: stream.name,
      logoUrl: stream.stream_icon || undefined,
      streamId: String(stream.stream_id),
      categoryId: makeId(source.id, `live-${stream.category_id}`),
      tvgId: undefined,
      epgChannelId: stream.epg_channel_id || undefined,
      streamType: stream.stream_type,
    }))

    await saveInBatches(channelRecords, db.channels, (loaded, total) => {
      onProgress({
        phase: 'live-streams',
        message: `Saving live channels: ${loaded.toLocaleString()} / ${total.toLocaleString()}`,
        percent: 10 + (total === 0 ? 20 : (loaded / total) * 20),
      })
    })

    onProgress({ phase: 'vod-categories', message: 'Loading movie categories...', percent: 32 })
    const vodCategories = await getVodCategories(serverUrl, credentials)
    console.log(`[Xtream Sync] ${vodCategories.length} VOD categories`)
    await saveCategories(source.id, 'movie', vodCategories)

    onProgress({ phase: 'vod-streams', message: 'Loading movies...', percent: 35 })
    const vodStreams = await getVodStreams(serverUrl, credentials)
    console.log(`[Xtream Sync] ${vodStreams.length} VOD streams`)

    await db.movies.where('sourceId').equals(source.id).delete()

    const movieRecords = vodStreams.map((stream) => ({
      id: makeId(source.id, `movie-${stream.stream_id}`),
      sourceId: source.id,
      externalId: String(stream.stream_id),
      name: stream.name,
      logoUrl: stream.stream_icon || undefined,
      streamId: String(stream.stream_id),
      categoryId: makeId(source.id, `movie-${stream.category_id}`),
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

    await saveInBatches(movieRecords, db.movies, (loaded, total) => {
      onProgress({
        phase: 'vod-streams',
        message: `Saving movies: ${loaded.toLocaleString()} / ${total.toLocaleString()}`,
        percent: 35 + (total === 0 ? 30 : (loaded / total) * 30),
      })
    })

    onProgress({ phase: 'series-categories', message: 'Loading series categories...', percent: 68 })
    const seriesCategories = await getSeriesCategories(serverUrl, credentials)
    console.log(`[Xtream Sync] ${seriesCategories.length} series categories`)
    await saveCategories(source.id, 'series', seriesCategories)

    onProgress({ phase: 'series-list', message: 'Loading series...', percent: 72 })
    const seriesList = await getSeriesList(serverUrl, credentials)
    console.log(`[Xtream Sync] ${seriesList.length} series`)

    await db.series.where('sourceId').equals(source.id).delete()

    const seriesRecords = seriesList.map((series) => ({
      id: makeId(source.id, `series-${series.series_id}`),
      sourceId: source.id,
      externalId: String(series.series_id),
      name: series.name,
      logoUrl: series.cover || undefined,
      backdropUrl: series.backdrop_path || undefined,
      categoryId: makeId(source.id, `series-${series.category_id}`),
      year: series.releaseDate ? parseInt(series.releaseDate.split('-')[0]) || undefined : undefined,
      rating: series.rating_5based || undefined,
      plot: series.plot || undefined,
      genre: series.genre || undefined,
      cast: series.cast || undefined,
      director: series.director || undefined,
      releaseDate: series.releaseDate || undefined,
    }))

    await saveInBatches(seriesRecords, db.series, (loaded, total) => {
      onProgress({
        phase: 'series-list',
        message: `Saving series: ${loaded.toLocaleString()} / ${total.toLocaleString()}`,
        percent: 72 + (total === 0 ? 26 : (loaded / total) * 26),
      })
    })

    await db.syncMetadata.update(source.id, {
      channelsCount: channelRecords.length,
      moviesCount: movieRecords.length,
      seriesCount: seriesRecords.length,
      lastSyncAt: Date.now(),
      syncStatus: 'idle',
      errorMessage: undefined,
    })

    onProgress({ phase: 'complete', message: 'Ready', percent: 100 })
    console.log('[Xtream Sync] Complete:', {
      channels: channelRecords.length,
      movies: movieRecords.length,
      series: seriesRecords.length,
    })
  } catch (error) {
    console.error('[Xtream Sync] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'

    try {
      await db.syncMetadata.update(source.id, {
        syncStatus: 'error',
        errorMessage: message,
      })
    } catch {
      // ignore secondary failure
    }

    onProgress({ phase: 'error', message, percent: 0 })
    throw error
  }
}