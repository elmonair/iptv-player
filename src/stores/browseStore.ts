import { create } from 'zustand'
import { db } from '../lib/db'
import type { ChannelRecord, MovieRecord, SeriesRecord } from '../lib/db'

export type Section = 'live' | 'movies' | 'series'

const ALL_ITEMS_CACHE_KEY = '__all__'
const FAVORITES_CACHE_KEY = '__favorites__'
const FAVORITES_CATEGORY_ID = '__favorites__'

type SectionBrowseState<T> = {
  selectedCategoryId: string | null
  selectedCategoryName: string | null
  scrollTop: number
  focusedItemId: string | null
  itemsByCategory: Record<string, T[]>
  loadingCategoryIds: Set<string>
  hasLoaded: boolean
}

type SeriesBrowseState = SectionBrowseState<SeriesRecord> & {
  selectedSeriesId: string | null
  selectedSeasonNumber: number | null
  selectedEpisodeId: string | null
  episodeListScrollTop: number
  focusedEpisodeId: string | null
}

export type BrowseState = {
  section: Section
  live: SectionBrowseState<ChannelRecord>
  movies: SectionBrowseState<MovieRecord>
  series: SeriesBrowseState
  lastPlayerContext: {
    section: Section
    categoryId: string | null
    itemId: string | null
  } | null
}

type BrowseItems = ChannelRecord[] | MovieRecord[] | SeriesRecord[]

interface BrowseStore {
  state: BrowseState

  setSection: (section: Section) => void
  selectCategory: (categoryId: string | null, categoryName: string | null) => void
  saveScrollTop: (scrollTop: number) => void
  setFocusedItem: (itemId: string | null) => void
  saveItems: (items: BrowseItems, categoryId?: string | null) => void
  loadCategoryItems: (section: Section, sourceId: string, categoryId: string | null) => Promise<BrowseItems>
  getCurrentItems: (section: Section, categoryId: string | null) => BrowseItems
  setSelectedSeries: (seriesId: string | null) => void
  setSelectedEpisode: (seasonNumber: number | null, episodeId: string | null) => void
  saveEpisodeListScrollTop: (scrollTop: number) => void

  enterPlayer: (itemId: string) => void
  exitPlayer: () => { section: Section; categoryId: string | null; itemId: string | null } | null

  clearCategory: () => void
  markLoaded: (section: Section) => void
  isSectionLoaded: (section: Section) => boolean
  invalidateCache: () => void
}

function getCategoryCacheKey(categoryId: string | null): string {
  if (categoryId === null) return ALL_ITEMS_CACHE_KEY
  if (categoryId === FAVORITES_CATEGORY_ID) return FAVORITES_CACHE_KEY
  return categoryId
}

function emptySectionState<T>(): SectionBrowseState<T> {
  return {
    selectedCategoryId: null,
    selectedCategoryName: null,
    scrollTop: 0,
    focusedItemId: null,
    itemsByCategory: {},
    loadingCategoryIds: new Set<string>(),
    hasLoaded: false,
  }
}

function getSectionState(state: BrowseState, section: Section) {
  if (section === 'live') return state.live
  if (section === 'movies') return state.movies
  return state.series
}

export const useBrowseStore = create<BrowseStore>((set, get) => ({
  state: {
    section: 'live',
    live: {
      ...emptySectionState<ChannelRecord>(),
      selectedCategoryId: FAVORITES_CATEGORY_ID,
      selectedCategoryName: 'Favorites',
    },
    movies: emptySectionState<MovieRecord>(),
    series: {
      ...emptySectionState<SeriesRecord>(),
      selectedSeriesId: null,
      selectedSeasonNumber: null,
      selectedEpisodeId: null,
      episodeListScrollTop: 0,
      focusedEpisodeId: null,
    },
    lastPlayerContext: null,
  },

  setSection: (section) => {
    set((s) => ({ state: { ...s.state, section } }))
  },

  selectCategory: (categoryId, categoryName) => {
    const { state } = get()
    const section = state.section

    if (section === 'live') {
      set((s) => ({
        state: {
          ...s.state,
          live: { ...s.state.live, selectedCategoryId: categoryId, selectedCategoryName: categoryName, scrollTop: 0, focusedItemId: null },
        },
      }))
    } else if (section === 'movies') {
      set((s) => ({
        state: {
          ...s.state,
          movies: { ...s.state.movies, selectedCategoryId: categoryId, selectedCategoryName: categoryName, scrollTop: 0, focusedItemId: null },
        },
      }))
    } else {
      set((s) => ({
        state: {
          ...s.state,
          series: { ...s.state.series, selectedCategoryId: categoryId, selectedCategoryName: categoryName, scrollTop: 0, focusedItemId: null },
        },
      }))
    }
  },

  saveScrollTop: (scrollTop) => {
    const { state } = get()
    if (state.section === 'live') {
      set((s) => ({ state: { ...s.state, live: { ...s.state.live, scrollTop } } }))
    } else if (state.section === 'movies') {
      set((s) => ({ state: { ...s.state, movies: { ...s.state.movies, scrollTop } } }))
    } else {
      set((s) => ({ state: { ...s.state, series: { ...s.state.series, scrollTop } } }))
    }
  },

  setFocusedItem: (itemId) => {
    const { state } = get()
    if (state.section === 'live') {
      set((s) => ({ state: { ...s.state, live: { ...s.state.live, focusedItemId: itemId } } }))
    } else if (state.section === 'movies') {
      set((s) => ({ state: { ...s.state, movies: { ...s.state.movies, focusedItemId: itemId } } }))
    } else {
      set((s) => ({ state: { ...s.state, series: { ...s.state.series, focusedItemId: itemId } } }))
    }
  },

  saveItems: (items, categoryId) => {
    const { state } = get()
    const section = state.section
    const resolvedCategoryId = categoryId === undefined
      ? (section === 'live' ? state.live.selectedCategoryId : section === 'movies' ? state.movies.selectedCategoryId : state.series.selectedCategoryId)
      : categoryId
    const cacheKey = getCategoryCacheKey(resolvedCategoryId)

    if (section === 'live') {
      set((s) => ({
        state: {
          ...s.state,
          live: {
            ...s.state.live,
            itemsByCategory: { ...s.state.live.itemsByCategory, [cacheKey]: items as ChannelRecord[] },
            loadingCategoryIds: new Set([...s.state.live.loadingCategoryIds].filter((id) => id !== cacheKey)),
            hasLoaded: true,
          },
        },
      }))
    } else if (section === 'movies') {
      set((s) => ({
        state: {
          ...s.state,
          movies: {
            ...s.state.movies,
            itemsByCategory: { ...s.state.movies.itemsByCategory, [cacheKey]: items as MovieRecord[] },
            loadingCategoryIds: new Set([...s.state.movies.loadingCategoryIds].filter((id) => id !== cacheKey)),
            hasLoaded: true,
          },
        },
      }))
    } else {
      set((s) => ({
        state: {
          ...s.state,
          series: {
            ...s.state.series,
            itemsByCategory: { ...s.state.series.itemsByCategory, [cacheKey]: items as SeriesRecord[] },
            loadingCategoryIds: new Set([...s.state.series.loadingCategoryIds].filter((id) => id !== cacheKey)),
            hasLoaded: true,
          },
        },
      }))
    }
  },

  loadCategoryItems: async (section, sourceId, categoryId) => {
    const cacheKey = getCategoryCacheKey(categoryId)
    const sectionState = getSectionState(get().state, section)
    const cachedItems = sectionState.itemsByCategory[cacheKey]
    if (cachedItems) {
      return cachedItems
    }

    if (!sectionState.loadingCategoryIds.has(cacheKey)) {
      set((s) => {
        const currentSection = getSectionState(s.state, section)
        const loadingCategoryIds = new Set(currentSection.loadingCategoryIds)
        loadingCategoryIds.add(cacheKey)

        return {
          state: {
            ...s.state,
            [section]: {
              ...currentSection,
              loadingCategoryIds,
            },
          },
        }
      })
    }

    try {
      const items = await loadItemsForCategory(section, sourceId, categoryId)

      set((s) => {
        const currentSection = getSectionState(s.state, section)
        const loadingCategoryIds = new Set(currentSection.loadingCategoryIds)
        loadingCategoryIds.delete(cacheKey)

        return {
          state: {
            ...s.state,
            [section]: {
              ...currentSection,
              itemsByCategory: { ...currentSection.itemsByCategory, [cacheKey]: items },
              loadingCategoryIds,
              hasLoaded: true,
            },
          },
        }
      })

      return items
    } catch (error) {
      set((s) => {
        const currentSection = getSectionState(s.state, section)
        const loadingCategoryIds = new Set(currentSection.loadingCategoryIds)
        loadingCategoryIds.delete(cacheKey)

        return {
          state: {
            ...s.state,
            [section]: {
              ...currentSection,
              loadingCategoryIds,
            },
          },
        }
      })

      throw error
    }
  },

  getCurrentItems: (section, categoryId) => {
    const sectionState = getSectionState(get().state, section)
    const cacheKey = getCategoryCacheKey(categoryId)
    return sectionState.itemsByCategory[cacheKey] ?? []
  },

  setSelectedSeries: (seriesId) => {
    set((s) => ({ state: { ...s.state, series: { ...s.state.series, selectedSeriesId: seriesId } } }))
  },

  setSelectedEpisode: (seasonNumber, episodeId) => {
    set((s) => ({
      state: {
        ...s.state,
        series: {
          ...s.state.series,
          selectedSeasonNumber: seasonNumber,
          selectedEpisodeId: episodeId,
          focusedEpisodeId: episodeId,
        },
      },
    }))
  },

  saveEpisodeListScrollTop: (scrollTop) => {
    set((s) => ({ state: { ...s.state, series: { ...s.state.series, episodeListScrollTop: scrollTop } } }))
  },

  enterPlayer: (itemId) => {
    const { state } = get()
    set({
      state: {
        ...state,
        lastPlayerContext: {
          section: state.section,
          categoryId: state.section === 'live'
            ? state.live.selectedCategoryId
            : state.section === 'movies'
              ? state.movies.selectedCategoryId
              : state.series.selectedCategoryId,
          itemId,
        },
      },
    })
  },

  exitPlayer: () => {
    const { state } = get()
    const ctx = state.lastPlayerContext
    if (!ctx) return null

    set((s) => ({ state: { ...s.state, section: ctx.section } }))
    return ctx
  },

  clearCategory: () => {
    const { state } = get()
    if (state.section === 'live') {
      set((s) => ({ state: { ...s.state, live: { ...s.state.live, selectedCategoryId: null, selectedCategoryName: null, scrollTop: 0, focusedItemId: null } } }))
    } else if (state.section === 'movies') {
      set((s) => ({ state: { ...s.state, movies: { ...s.state.movies, selectedCategoryId: null, selectedCategoryName: null, scrollTop: 0, focusedItemId: null } } }))
    } else {
      set((s) => ({ state: { ...s.state, series: { ...s.state.series, selectedCategoryId: null, selectedCategoryName: null, selectedSeriesId: null, selectedSeasonNumber: null, selectedEpisodeId: null, scrollTop: 0, episodeListScrollTop: 0, focusedItemId: null, focusedEpisodeId: null } } }))
    }
  },

  markLoaded: (section) => {
    if (section === 'live') {
      set((s) => ({ state: { ...s.state, live: { ...s.state.live, hasLoaded: true } } }))
    } else if (section === 'movies') {
      set((s) => ({ state: { ...s.state, movies: { ...s.state.movies, hasLoaded: true } } }))
    } else {
      set((s) => ({ state: { ...s.state, series: { ...s.state.series, hasLoaded: true } } }))
    }
  },

  isSectionLoaded: (section) => {
    const { state } = get()
    if (section === 'live') return state.live.hasLoaded
    if (section === 'movies') return state.movies.hasLoaded
    return state.series.hasLoaded
  },

  invalidateCache: () => {
    set((s) => ({
      state: {
        ...s.state,
        live: { ...s.state.live, hasLoaded: false, itemsByCategory: {}, loadingCategoryIds: new Set<string>() },
        movies: { ...s.state.movies, hasLoaded: false, itemsByCategory: {}, loadingCategoryIds: new Set<string>() },
        series: { ...s.state.series, hasLoaded: false, itemsByCategory: {}, loadingCategoryIds: new Set<string>() },
      },
    }))
  },
}))

export async function loadItemsForCategory(
  section: Section,
  sourceId: string,
  categoryId: string | null,
): Promise<ChannelRecord[] | MovieRecord[] | SeriesRecord[]> {
  if (categoryId === FAVORITES_CATEGORY_ID) {
    const itemType = section === 'live' ? 'channel' : section === 'movies' ? 'movie' : 'series'
    const favoriteIds = await db.favorites
      .where('sourceId')
      .equals(sourceId)
      .and((favorite) => favorite.itemType === itemType)
      .toArray()

    const ids = favoriteIds.map((favorite) => favorite.itemId)
    if (ids.length === 0) {
      return []
    }

    if (section === 'live') {
      return db.channels.where('id').anyOf(ids).toArray()
    }
    if (section === 'movies') {
      return db.movies.where('id').anyOf(ids).toArray()
    }
    return db.series.where('id').anyOf(ids).toArray()
  }

  if (section === 'live') {
    if (categoryId) {
      return db.channels.where('categoryId').equals(categoryId).toArray()
    }
    return db.channels.where('sourceId').equals(sourceId).toArray()
  }

  if (section === 'movies') {
    if (categoryId) {
      return db.movies.where('categoryId').equals(categoryId).toArray()
    }
    return db.movies.where('sourceId').equals(sourceId).toArray()
  }

  if (categoryId) {
    return db.series.where('categoryId').equals(categoryId).toArray()
  }
  return db.series.where('sourceId').equals(sourceId).toArray()
}

export { ALL_ITEMS_CACHE_KEY, FAVORITES_CACHE_KEY, FAVORITES_CATEGORY_ID, getCategoryCacheKey }
