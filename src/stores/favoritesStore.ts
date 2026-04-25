import { create } from 'zustand'
import { db } from '../lib/db'
import type { FavoriteRecord } from '../lib/db'
import { generateId } from '../lib/uuid'

type FavoriteState = {
  favorites: FavoriteRecord[]
  isLoading: boolean
  error: string | null
}

type FavoriteActions = {
  loadFavorites: (sourceId: string) => Promise<void>
  toggleFavorite: (itemType: FavoriteRecord['itemType'], itemId: string, sourceId: string) => Promise<void>
  isFavorite: (itemType: FavoriteRecord['itemType'], itemId: string) => boolean
  getFavoritesByType: (itemType: FavoriteRecord['itemType']) => FavoriteRecord[]
  clearFavorites: () => Promise<void>
}

export const useFavoritesStore = create<FavoriteState & FavoriteActions>((set, get) => ({
  favorites: [],
  isLoading: false,
  error: null,

  loadFavorites: async (sourceId: string) => {
    set({ isLoading: true, error: null })
    try {
      const favorites = await db.favorites.where('sourceId').equals(sourceId).toArray()
      set({ favorites, isLoading: false })
      console.log('[Favorites] Loaded:', favorites.length)
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to load favorites'
      console.error('[Favorites] Load error:', error)
      set({ error, isLoading: false })
    }
  },

  toggleFavorite: async (itemType: FavoriteRecord['itemType'], itemId: string, sourceId: string) => {
    try {
      const { favorites } = get()
      const existingIndex = favorites.findIndex(f => f.itemType === itemType && f.itemId === itemId)

      if (existingIndex >= 0) {
        const existing = favorites[existingIndex]
        await db.favorites.delete(existing.id)
        set({ favorites: favorites.filter(f => f.id !== existing.id) })
        console.log('[Favorites] Removed:', itemType, itemId)
      } else {
        const newFavorite: FavoriteRecord = {
          id: generateId(),
          itemType,
          itemId,
          sourceId,
          addedAt: Date.now(),
        }
        await db.favorites.add(newFavorite)
        set({ favorites: [...favorites, newFavorite] })
        console.log('[Favorites] Added:', itemType, itemId)
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to toggle favorite'
      console.error('[Favorites] Toggle error:', error)
      set({ error })
    }
  },

  isFavorite: (itemType: FavoriteRecord['itemType'], itemId: string) => {
    const { favorites } = get()
    return favorites.some(f => f.itemType === itemType && f.itemId === itemId)
  },

  getFavoritesByType: (itemType: FavoriteRecord['itemType']) => {
    const { favorites } = get()
    return favorites.filter(f => f.itemType === itemType)
  },

  clearFavorites: async () => {
    try {
      await db.favorites.clear()
      set({ favorites: [] })
      console.log('[Favorites] Cleared all')
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to clear favorites'
      console.error('[Favorites] Clear error:', error)
      set({ error })
    }
  },
}))
