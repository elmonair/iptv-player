import { create } from 'zustand'

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

type M3UUrlSourceInput = Omit<M3UUrlSource, 'id' | 'createdAt'>
type XtreamSourceInput = Omit<XtreamSource, 'id' | 'createdAt'>

interface PlaylistStore {
  sources: PlaylistSource[]
  activeSourceId: string | null

  addSource: (source: M3UUrlSourceInput | XtreamSourceInput) => string
  removeSource: (id: string) => void
  setActiveSource: (id: string) => void
  getActiveSource: () => PlaylistSource | undefined
}

export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
  sources: [],
  activeSourceId: null,

  addSource: (source) => {
    const id = crypto.randomUUID()
    const newSource: PlaylistSource = {
      ...source,
      id,
      createdAt: Date.now(),
    }
    set((state) => ({
      sources: [...state.sources, newSource],
    }))
    return id
  },

  removeSource: (id) => {
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
}))
