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
  isActive?: boolean
}

export type XtreamSource = {
  id: string
  type: 'xtream'
  name: string
  serverUrl: string
  username: string
  password: string
  createdAt: number
  expDate: number | null
  isActive?: boolean
}

export type PlaylistSource = M3UUrlSource | XtreamSource

export type M3UUrlSourceInput = Omit<M3UUrlSource, 'id' | 'createdAt'>
export type XtreamSourceInput = Omit<XtreamSource, 'id' | 'createdAt' | 'expDate'>

interface PlaylistStore {
  sources: PlaylistSource[]
  activeSourceId: string | null
  loaded: boolean
  lastChannelId: string | null
  selectedCategoryId: string | null
  selectedMovieCategoryId: string | null
  selectedSeriesCategoryId: string | null
  membershipExpDate: number | null

  loadSourcesFromDb: () => Promise<void>
  addSource: (source: M3UUrlSourceInput | XtreamSourceInput) => Promise<string>
  updateSource: (id: string, updates: Partial<XtreamSourceInput>) => Promise<void>
  removeSource: (id: string) => Promise<void>
  setActiveSource: (id: string) => void
  setLastChannelId: (id: string | null) => void
  setSelectedCategoryId: (id: string | null) => void
  setSelectedMovieCategoryId: (id: string | null) => void
  setSelectedSeriesCategoryId: (id: string | null) => void
  getActiveSource: () => PlaylistSource | undefined
  clearAllData: () => Promise<void>
  setMembershipExpDate: (expDate: number | null) => void
}

export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
  sources: [],
  activeSourceId: null,
  loaded: false,
  lastChannelId: null,
  selectedCategoryId: null,
  selectedMovieCategoryId: null,
  selectedSeriesCategoryId: null,
  membershipExpDate: null,

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
          expDate: record.expDate ?? null,
        })
      }
    }

    const sortedSources = sources.sort((a, b) => b.createdAt - a.createdAt)
    const storedActive = sortedSources.find((s) => s.isActive)
    const activeSourceId = storedActive?.id ?? sortedSources[0]?.id ?? null

    const activeSource = sortedSources.find((s) => s.id === activeSourceId)
    const membershipExpDate = activeSource?.type === 'xtream' ? (activeSource as XtreamSource).expDate : null

    set({
      sources: sortedSources,
      activeSourceId,
      loaded: true,
      membershipExpDate,
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

    const newSource: PlaylistSource =
      source.type === 'xtream'
        ? { ...source, id, createdAt, expDate: null }
        : { ...source, id, createdAt }

    set((state) => ({
      sources: [...state.sources, newSource].sort((a, b) => b.createdAt - a.createdAt),
      activeSourceId: id,
    }))

    return id
  },

  updateSource: async (id, updates) => {
    const source = get().sources.find((s) => s.id === id)
    if (!source || source.type !== 'xtream') return

    const record: Partial<PlaylistSourceRecord> = {}

    if (updates.name !== undefined) record.name = updates.name
    if (updates.serverUrl !== undefined) record.serverUrlEncrypted = await encryptString(updates.serverUrl)
    if (updates.username !== undefined) record.usernameEncrypted = await encryptString(updates.username)
    if (updates.password !== undefined) record.passwordEncrypted = await encryptString(updates.password)

    await db.sources.update(id, record)

    set((state) => ({
      sources: state.sources.map((s) => {
        if (s.id !== id) return s
        return {
          ...s,
          name: updates.name ?? s.name,
          serverUrl: updates.serverUrl ?? (s as XtreamSource).serverUrl,
          username: updates.username ?? (s as XtreamSource).username,
          password: updates.password ?? (s as XtreamSource).password,
        }
      }),
    }))
  },

  removeSource: async (id) => {
    await db.sources.delete(id)
    set((state) => {
      const remaining = state.sources.filter((s) => s.id !== id)
      let nextActiveId = state.activeSourceId
      if (state.activeSourceId === id || !remaining.find((s) => s.id === state.activeSourceId)) {
        nextActiveId = remaining[0]?.id ?? null
        if (nextActiveId) {
          db.sources.toArray().then((all) => {
            const updates = all.map((s) => ({ ...s, isActive: s.id === nextActiveId ? true : false }))
            return Promise.all(updates.map((s) => db.sources.update(s.id, { isActive: s.isActive })))
          })
        }
      }
      const activeSrc = remaining.find((s) => s.id === nextActiveId)
      const membershipExpDate = activeSrc?.type === 'xtream' ? (activeSrc as XtreamSource).expDate : null
      return { sources: remaining, activeSourceId: nextActiveId, membershipExpDate }
    })
  },

  setActiveSource: (id) => {
    db.sources.toArray().then((all) => {
      const updates = all.map((s) => ({ ...s, isActive: s.id === id ? true : false }))
      return Promise.all(updates.map((s) => db.sources.update(s.id, { isActive: s.isActive })))
    })
    const { sources } = get()
    const activeSrc = sources.find((s) => s.id === id)
    const membershipExpDate = activeSrc?.type === 'xtream' ? (activeSrc as XtreamSource).expDate : null
    set({ activeSourceId: id, membershipExpDate })
  },

  setLastChannelId: (id) => {
    set({ lastChannelId: id })
  },

  setSelectedCategoryId: (id) => {
    set({ selectedCategoryId: id })
  },

  setSelectedMovieCategoryId: (id) => {
    set({ selectedMovieCategoryId: id })
  },

  setSelectedSeriesCategoryId: (id) => {
    set({ selectedSeriesCategoryId: id })
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
      membershipExpDate: null,
    })
  },

  setMembershipExpDate: (expDate) => {
    set({ membershipExpDate: expDate })
  },
}))
