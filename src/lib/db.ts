import Dexie from 'dexie'
import type { Table } from 'dexie'

export type PlaylistSourceRecord = {
  id: string
  type: 'm3u-url' | 'xtream'
  name: string
  createdAt: number
  url?: string
  serverUrlEncrypted?: string
  usernameEncrypted?: string
  passwordEncrypted?: string
  expDate?: number
  isActive?: boolean
}

export type CategoryRecord = {
  id: string
  sourceId: string
  type: 'live' | 'movie' | 'series'
  externalId: string
  name: string
}

export type ChannelRecord = {
  id: string
  sourceId: string
  externalId: string
  name: string
  logoUrl?: string
  streamId: string
  categoryId: string
  tvgId?: string
  epgChannelId?: string
  streamType?: string
}

export type MovieRecord = {
  id: string
  sourceId: string
  externalId: string
  name: string
  logoUrl?: string
  backdropUrl?: string
  streamId: string
  categoryId: string
  containerExtension?: string
  year?: number
  rating?: number
  plot?: string
  description?: string
  genre?: string
  cast?: string
  director?: string
  releaseDate?: string
  durationSeconds?: number
}

export type SeriesRecord = {
  id: string
  sourceId: string
  externalId: string
  name: string
  logoUrl?: string
  backdropUrl?: string
  categoryId: string
  year?: number
  rating?: number
  plot?: string
  genre?: string
  cast?: string
  director?: string
  releaseDate?: string
}

export type EpisodeRecord = {
  id: string
  sourceId: string
  seriesId: string
  externalId: string
  seasonNumber: number
  episodeNumber: number
  title?: string
  streamId: string
  containerExtension?: string
  durationSeconds?: number
  plot?: string
  releaseDate?: string
}

export type SyncMetadataRecord = {
  sourceId: string
  lastSyncAt: number
  channelsCount: number
  moviesCount: number
  seriesCount: number
  syncStatus: 'idle' | 'syncing' | 'error'
  errorMessage?: string
}

export type FavoriteRecord = {
  id: string
  itemType: 'channel' | 'movie' | 'series' | 'episode'
  itemId: string
  sourceId: string
  addedAt: number
}

export type WatchHistoryRecord = {
  id: string
  itemType: 'channel' | 'movie' | 'episode'
  itemId: string
  sourceId: string
  position: number
  duration: number | null
  lastWatched: number
}

class IptvDatabase extends Dexie {
  sources!: Table<PlaylistSourceRecord>
  categories!: Table<CategoryRecord>
  channels!: Table<ChannelRecord>
  movies!: Table<MovieRecord>
  series!: Table<SeriesRecord>
  episodes!: Table<EpisodeRecord>
  syncMetadata!: Table<SyncMetadataRecord>
  favorites!: Table<FavoriteRecord>
  watchHistory!: Table<WatchHistoryRecord>

  constructor() {
    super('IptvDatabase')

    this.version(1).stores({
      sources: 'id, type, createdAt',
    })

    this.version(2).stores({
      sources: 'id, type, createdAt',
      categories: 'id, sourceId, type, externalId',
      channels: 'id, sourceId, categoryId, name',
      movies: 'id, sourceId, categoryId, name, year',
      series: 'id, sourceId, categoryId, name',
      episodes: 'id, seriesId, seasonNumber, episodeNumber',
      syncMetadata: 'sourceId',
    })

    this.version(3).stores({
      sources: 'id, type, createdAt',
      categories: 'id, sourceId, type, externalId',
      channels: 'id, sourceId, categoryId, name, externalId',
      movies: 'id, sourceId, categoryId, name, year, externalId',
      series: 'id, sourceId, categoryId, name, externalId',
      episodes: 'id, seriesId, seasonNumber, episodeNumber, externalId',
      syncMetadata: 'sourceId',
    })

    this.version(4).stores({
      sources: 'id, type, createdAt',
      categories: 'id, sourceId, type, externalId',
      channels: 'id, sourceId, categoryId, name, externalId',
      movies: 'id, sourceId, categoryId, name, year, externalId',
      series: 'id, sourceId, categoryId, name, externalId',
      episodes: 'id, seriesId, seasonNumber, episodeNumber, externalId',
      syncMetadata: 'sourceId',
      favorites: 'id, itemType, itemId, sourceId, addedAt',
    })

    this.version(5).stores({
      sources: 'id, type, createdAt',
      categories: 'id, sourceId, type, externalId',
      channels: 'id, sourceId, categoryId, name, externalId',
      movies: 'id, sourceId, categoryId, name, year, externalId',
      series: 'id, sourceId, categoryId, name, externalId',
      episodes: 'id, seriesId, seasonNumber, episodeNumber, externalId',
      syncMetadata: 'sourceId',
      favorites: 'id, itemType, itemId, sourceId, addedAt',
      watchHistory: 'id, itemType, itemId, sourceId, lastWatched',
    })
  }
}

export const db = new IptvDatabase()
