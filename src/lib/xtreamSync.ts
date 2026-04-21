import type { PlaylistSource, XtreamSource } from '../stores/playlistStore'
import {
  getUserInfo,
  getLiveCategories,
  getLiveStreams,
  getVodCategories,
  getVodStreams,
  getSeriesCategories,
  getSeriesList,
  type XtreamCredentials,
} from './xtream'
import { db } from './db'
import { makeId, clearAndSaveCategories, saveInBatches } from './xtreamSyncHelpers'

export type SyncProgress = {
  phase: 'auth' | 'live-categories' | 'live-streams' | 'vod-categories' | 'vod-streams' | 'series-categories' | 'series-list' | 'complete' | 'error'
  message: string
  percent: number
}

async function* syncXtreamPlaylist(source: PlaylistSource): AsyncGenerator<SyncProgress, void, unknown> {
  if (source.type !== 'xtream') {
    throw new Error('Source is not an Xtream Codes source')
  }

  const xtreamSource = source as XtreamSource

  try {
    yield { phase: 'auth', message: 'Authenticating...', percent: 5 }

    const credentials: XtreamCredentials = {
      username: xtreamSource.username,
      password: xtreamSource.password,
    }

    const userInfo = await getUserInfo(credentials)
    console.log('[Xtream Sync] Authenticated for user:', userInfo.user_info.username)

    await db.syncMetadata.put({
      sourceId: source.id,
      lastSyncAt: 0,
      channelsCount: 0,
      moviesCount: 0,
      seriesCount: 0,
      syncStatus: 'syncing',
    })

    yield { phase: 'live-categories', message: 'Loading live TV categories...', percent: 10 }
    const liveCategories = await getLiveCategories(credentials)
    console.log(`[Xtream Sync] Got ${liveCategories.length} live categories`)
    await clearAndSaveCategories(source.id, 'live', liveCategories)

    yield { phase: 'live-streams', message: `Loading 0 live TV channels...`, percent: 25 }
    const liveStreams = await getLiveStreams(credentials)
    console.log(`[Xtream Sync] Got ${liveStreams.length} live streams`)
    await db.channels.where('sourceId').equals(source.id).delete()

    const channelRecords = liveStreams.map((stream) => ({
      id: makeId(source.id, String(stream.stream_id)),
      sourceId: source.id,
      externalId: String(stream.stream_id),
      name: stream.name,
      logoUrl: stream.stream_icon || undefined,
      streamId: String(stream.stream_id),
      categoryId: makeId(source.id, stream.category_id),
      tvgId: undefined,
      epgChannelId: stream.epg_channel_id || undefined,
      streamType: stream.stream_type,
    }))

    await saveInBatches(channelRecords, db.channels, (loaded, total) => {
      return {
        phase: 'live-streams' as const,
        message: `Loading ${loaded} of ${total} live TV channels...`,
        percent: 25 + (loaded / total) * 15,
      }
    })

    await db.syncMetadata.update(source.id, { channelsCount: channelRecords.length })

    yield { phase: 'vod-categories', message: 'Loading movie categories...', percent: 40 }
    const vodCategories = await getVodCategories(credentials)
    console.log(`[Xtream Sync] Got ${vodCategories.length} VOD categories`)
    await clearAndSaveCategories(source.id, 'movie', vodCategories)

    yield { phase: 'vod-streams', message: `Loading 0 movies...`, percent: 55 }
    const vodStreams = await getVodStreams(credentials)
    console.log(`[Xtream Sync] Got ${vodStreams.length} VOD streams`)
    await db.movies.where('sourceId').equals(source.id).delete()

    const movieRecords = vodStreams.map((stream) => ({
      id: makeId(source.id, String(stream.stream_id)),
      sourceId: source.id,
      externalId: String(stream.stream_id),
      name: stream.name,
      logoUrl: stream.stream_icon || undefined,
      streamId: String(stream.stream_id),
      categoryId: makeId(source.id, stream.category_id),
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
      return {
        phase: 'vod-streams' as const,
        message: `Loading ${loaded} of ${total} movies...`,
        percent: 55 + (loaded / total) * 20,
      }
    })

    await db.syncMetadata.update(source.id, { moviesCount: movieRecords.length })

    yield { phase: 'series-categories', message: 'Loading series categories...', percent: 75 }
    const seriesCategories = await getSeriesCategories(credentials)
    console.log(`[Xtream Sync] Got ${seriesCategories.length} series categories`)
    await clearAndSaveCategories(source.id, 'series', seriesCategories)

    yield { phase: 'series-list', message: `Loading 0 series...`, percent: 85 }
    const seriesList = await getSeriesList(credentials)
    console.log(`[Xtream Sync] Got ${seriesList.length} series`)
    await db.series.where('sourceId').equals(source.id).delete()

    const seriesRecords = seriesList.map((series) => ({
      id: makeId(source.id, String(series.series_id)),
      sourceId: source.id,
      externalId: String(series.series_id),
      name: series.name,
      logoUrl: series.cover || undefined,
      backdropUrl: series.backdrop_path || undefined,
      categoryId: makeId(source.id, series.category_id),
      year: series.releaseDate ? parseInt(series.releaseDate.split('-')[0]) : undefined,
      rating: series.rating_5based || undefined,
      plot: series.plot || undefined,
      genre: series.genre || undefined,
      cast: series.cast || undefined,
      director: series.director || undefined,
      releaseDate: series.releaseDate || undefined,
    }))

    await saveInBatches(seriesRecords, db.series, (loaded, total) => {
      return {
        phase: 'series-list' as const,
        message: `Loading ${loaded} of ${total} series...`,
        percent: 85 + (loaded / total) * 15,
      }
    })

    await db.syncMetadata.update(source.id, {
      seriesCount: seriesRecords.length,
      lastSyncAt: Date.now(),
      syncStatus: 'idle',
    })

    yield { phase: 'complete', message: 'Ready', percent: 100 }
  } catch (error) {
    console.error('[Xtream Sync] Error:', error)

    await db.syncMetadata.update(source.id, {
      syncStatus: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    })

    yield {
      phase: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      percent: 0,
    }

    throw error
  }
}

export { syncXtreamPlaylist }
