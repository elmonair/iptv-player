import { create } from 'zustand'
import { db } from '../lib/db'
import type { ChannelRecord, MovieRecord, SeriesRecord } from '../lib/db'

export type Section = 'live' | 'movies' | 'series'

export type BrowseState = {
  section: Section
  live: {
    selectedCategoryId: string | null
    selectedCategoryName: string | null
    scrollTop: number
    focusedItemId: string | null
    items: ChannelRecord[]
  }
  movies: {
    selectedCategoryId: string | null
    selectedCategoryName: string | null
    scrollTop: number
    focusedItemId: string | null
    items: MovieRecord[]
  }
  series: {
    selectedCategoryId: string | null
    selectedCategoryName: string | null
    selectedSeriesId: string | null
    selectedSeasonNumber: number | null
    selectedEpisodeId: string | null
    scrollTop: number
    episodeListScrollTop: number
    focusedItemId: string | null
    focusedEpisodeId: string | null
    items: SeriesRecord[]
  }
  lastPlayerContext: {
    section: Section
    categoryId: string | null
    itemId: string | null
  } | null
}

interface BrowseStore {
  state: BrowseState

  setSection: (section: Section) => void
  selectCategory: (categoryId: string | null, categoryName: string | null) => void
  saveScrollTop: (scrollTop: number) => void
  setFocusedItem: (itemId: string | null) => void
  saveItems: (items: ChannelRecord[] | MovieRecord[] | SeriesRecord[]) => void
  setSelectedSeries: (seriesId: string | null) => void
  setSelectedEpisode: (seasonNumber: number | null, episodeId: string | null) => void
  saveEpisodeListScrollTop: (scrollTop: number) => void

  enterPlayer: (itemId: string) => void
  exitPlayer: () => { section: Section; categoryId: string | null; itemId: string | null } | null

  clearCategory: () => void
}

export const useBrowseStore = create<BrowseStore>((set, get) => ({
  state: {
    section: 'live',
    live: {
      selectedCategoryId: null,
      selectedCategoryName: null,
      scrollTop: 0,
      focusedItemId: null,
      items: [],
    },
    movies: {
      selectedCategoryId: null,
      selectedCategoryName: null,
      scrollTop: 0,
      focusedItemId: null,
      items: [],
    },
    series: {
      selectedCategoryId: null,
      selectedCategoryName: null,
      selectedSeriesId: null,
      selectedSeasonNumber: null,
      selectedEpisodeId: null,
      scrollTop: 0,
      episodeListScrollTop: 0,
      focusedItemId: null,
      focusedEpisodeId: null,
      items: [],
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
          live: { ...s.state.live, selectedCategoryId: categoryId, selectedCategoryName: categoryName, items: [], scrollTop: 0, focusedItemId: null },
        },
      }))
    } else if (section === 'movies') {
      set((s) => ({
        state: {
          ...s.state,
          movies: { ...s.state.movies, selectedCategoryId: categoryId, selectedCategoryName: categoryName, items: [], scrollTop: 0, focusedItemId: null },
        },
      }))
    } else {
      set((s) => ({
        state: {
          ...s.state,
          series: { ...s.state.series, selectedCategoryId: categoryId, selectedCategoryName: categoryName, items: [], scrollTop: 0, focusedItemId: null },
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

  saveItems: (items) => {
    const { state } = get()
    if (state.section === 'live') {
      set((s) => ({ state: { ...s.state, live: { ...s.state.live, items: items as ChannelRecord[] } } }))
    } else if (state.section === 'movies') {
      set((s) => ({ state: { ...s.state, movies: { ...s.state.movies, items: items as MovieRecord[] } } }))
    } else {
      set((s) => ({ state: { ...s.state, series: { ...s.state.series, items: items as SeriesRecord[] } } }))
    }
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
      set((s) => ({ state: { ...s.state, live: { ...s.state.live, selectedCategoryId: null, selectedCategoryName: null, items: [], scrollTop: 0, focusedItemId: null } } }))
    } else if (state.section === 'movies') {
      set((s) => ({ state: { ...s.state, movies: { ...s.state.movies, selectedCategoryId: null, selectedCategoryName: null, items: [], scrollTop: 0, focusedItemId: null } } }))
    } else {
      set((s) => ({ state: { ...s.state, series: { ...s.state.series, selectedCategoryId: null, selectedCategoryName: null, selectedSeriesId: null, selectedSeasonNumber: null, selectedEpisodeId: null, items: [], scrollTop: 0, episodeListScrollTop: 0, focusedItemId: null, focusedEpisodeId: null } } }))
    }
  },
}))

export async function loadItemsForCategory(
  section: Section,
  sourceId: string,
  categoryId: string | null,
): Promise<ChannelRecord[] | MovieRecord[] | SeriesRecord[]> {
  if (section === 'live') {
    if (categoryId) {
      return db.channels.where('categoryId').equals(categoryId).toArray()
    }
    return db.channels.where('sourceId').equals(sourceId).toArray()
  } else if (section === 'movies') {
    if (categoryId) {
      return db.movies.where('categoryId').equals(categoryId).toArray()
    }
    return []
  } else {
    if (categoryId) {
      return db.series.where('categoryId').equals(categoryId).toArray()
    }
    return []
  }
}
