import { create } from 'zustand'
import { db } from '../lib/db'
import type { WatchHistoryRecord } from '../lib/db'

type WatchHistoryState = {
  history: WatchHistoryRecord[]
  isLoading: boolean
  error: string | null
}

type WatchHistoryActions = {
  loadWatchHistory: (sourceId: string) => Promise<void>
  updateWatchProgress: (itemType: WatchHistoryRecord['itemType'], itemId: string, sourceId: string, position: number, duration: number | null) => Promise<void>
  getWatchHistory: () => WatchHistoryRecord[]
  getContinueWatching: () => WatchHistoryRecord[]
  clearWatchHistory: () => Promise<void>
}

export const useWatchHistoryStore = create<WatchHistoryState & WatchHistoryActions>((set, get) => ({
  history: [],
  isLoading: false,
  error: null,

  loadWatchHistory: async (sourceId: string) => {
    set({ isLoading: true, error: null })
    try {
      const history = await db.watchHistory.where('sourceId').equals(sourceId).toArray()
      set({ history, isLoading: false })
      console.log('[WatchHistory] Loaded:', history.length)
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to load watch history'
      console.error('[WatchHistory] Load error:', error)
      set({ error, isLoading: false })
    }
  },

  updateWatchProgress: async (itemType: WatchHistoryRecord['itemType'], itemId: string, sourceId: string, position: number, duration: number | null) => {
    try {
      console.log('[WatchHistory] updateWatchProgress called:', { itemType, itemId, sourceId, position, duration })
      const { history } = get()
      const existingIndex = history.findIndex(h => h.itemType === itemType && h.itemId === itemId)

      const id = `${itemType}:${itemId}`

      if (existingIndex >= 0) {
        const existing = history[existingIndex]
        await db.watchHistory.update(existing.id, {
          position,
          duration,
          lastWatched: Date.now(),
        })
        set({
          history: history.map(h => h.id === existing.id ? { ...h, position, duration, lastWatched: Date.now() } : h),
        })
        console.log('[WatchHistory] Updated:', itemType, itemId, 'position:', position, 'duration:', duration)
      } else {
        const newHistory: WatchHistoryRecord = {
          id,
          itemType,
          itemId,
          sourceId,
          position,
          duration,
          lastWatched: Date.now(),
        }
        await db.watchHistory.add(newHistory)
        set({ history: [...history, newHistory] })
        console.log('[WatchHistory] Added:', itemType, itemId, 'position:', position, 'duration:', duration)
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to update watch progress'
      console.error('[WatchHistory] Update error:', error)
      set({ error })
    }
  },

  getWatchHistory: () => {
    const { history } = get()
    return history.sort((a, b) => b.lastWatched - a.lastWatched)
  },

  getContinueWatching: () => {
    const { history } = get()
    const filtered = history.filter(h => {
      const duration = typeof h.duration === 'number' ? h.duration : 0
      const hasDuration = duration > 0
      const hasProgress = h.position > 0
      const notFinished = hasDuration ? h.position < duration * 0.9 : false
      const result = hasDuration && hasProgress && notFinished
      console.log('[WatchHistory] getContinueWatching filter:', {
        itemType: h.itemType,
        itemId: h.itemId,
        position: h.position,
        duration: h.duration,
        hasDuration,
        hasProgress,
        notFinished,
        result
      })
      return result
    })
    const sorted = filtered.sort((a, b) => b.lastWatched - a.lastWatched)
    console.log('[WatchHistory] getContinueWatching result:', sorted.length, 'items')
    return sorted
  },

  clearWatchHistory: async () => {
    try {
      await db.watchHistory.clear()
      set({ history: [] })
      console.log('[WatchHistory] Cleared all')
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to clear watch history'
      console.error('[WatchHistory] Clear error:', error)
      set({ error })
    }
  },
}))
