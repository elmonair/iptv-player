import { create } from 'zustand'
import { db, type PlaylistSourceRecord } from '../lib/db'
import { encryptString, decryptString, clearEncryptionKey } from '../lib/crypto'
import { generateId } from '../lib/uuid'

export type M3UUrlSource = {
  id: string
  type: 'm3u-url'
  name: string
  url: string
  createdAt: number
}

export type XtreamSource = {
  id: string
  type: 'xtream'
  name: string
  serverUrl: string
  username: string
  password: string
  createdAt: number
}

export type PlaylistSource = M3UUrlSource | XtreamSource

export type M3UUrlSourceInput = Omit<M3UUrlSource, 'id' | 'createdAt'>
export type XtreamSourceInput = Omit<XtreamSource, 'id' | 'createdAt'>

interface PlaylistStore {
  sources: PlaylistSource[]
  activeSourceId: string | null
  loaded: boolean

  loadSourcesFromDb: () => Promise<void>
  addSource: (source: M3UUrlSourceInput | XtreamSourceInput) => Promise<string>
  removeSource: (id: string) => Promise<void>
  setActiveSource: (id: string) => void
  getActiveSource: () => PlaylistSource | undefined
  clearAllData: () => Promise<void>
}

export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
  sources: [],
  activeSourceId: null,
  loaded: false,

  loadSourcesFromDb: async () => {
    const records = await db.sources.toArray()
    const sources: PlaylistSource[] = []

    for (const record of records) {
      if (record.type === 'm3u-url' && record.url) {
        sources.push({
          id: record.id,
          type: 'm3u-url',
          name: record.name,
          url: record.url,
          createdAt: record.createdAt,
        })
      } else if (record.type === 'xtream') {
        if (!record.serverUrlEncrypted || !record.usernameEncrypted || !record.passwordEncrypted) {
          continue
        }
        sources.push({
          id: record.id,
          type: 'xtream',
          name: record.name,
          serverUrl: await decryptString(record.serverUrlEncrypted),
          username: await decryptString(record.usernameEncrypted),
          password: await decryptString(record.passwordEncrypted),
          createdAt: record.createdAt,
        })
      }
    }

    const sortedSources = sources.sort((a, b) => b.createdAt - a.createdAt)
    const activeSourceId = sortedSources.length > 0 ? sortedSources[0].id : null

    set({
      sources: sortedSources,
      activeSourceId,
      loaded: true,
    })
  },

  addSource: async (source) => {
    const id = generateId()
    const createdAt = Date.now()

    const record: PlaylistSourceRecord = {
      id,
      type: source.type,
      name: source.name,
      createdAt,
    }

    if (source.type === 'm3u-url') {
      record.url = source.url
    } else if (source.type === 'xtream') {
      record.serverUrlEncrypted = await encryptString(source.serverUrl)
      record.usernameEncrypted = await encryptString(source.username)
      record.passwordEncrypted = await encryptString(source.password)
    }

    await db.sources.add(record)

    const newSource: PlaylistSource = {
      ...source,
      id,
      createdAt,
    }

    set((state) => ({
      sources: [...state.sources, newSource].sort((a, b) => b.createdAt - a.createdAt),
      activeSourceId: id,
    }))

    return id
  },

  removeSource: async (id) => {
    await db.sources.delete(id)
    set((state) => ({
      sources: state.sources.filter((s) => s.id !== id),
      activeSourceId: state.activeSourceId === id ? null : state.activeSourceId,
    }))
  },

  setActiveSource: (id) => {
    set({ activeSourceId: id })
  },

  getActiveSource: () => {
    const { sources, activeSourceId } = get()
    return sources.find((s) => s.id === activeSourceId)
  },

  clearAllData: async () => {
    await db.sources.clear()
    clearEncryptionKey()
    set({
      sources: [],
      activeSourceId: null,
      loaded: true,
    })
  },
}))
