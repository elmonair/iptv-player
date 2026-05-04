import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, Star, ChevronRight, ArrowLeft, Heart, Search, Calendar } from 'lucide-react'
import { usePlaylistStore } from '../stores/playlistStore'
import { ALL_ITEMS_CACHE_KEY, FAVORITES_CATEGORY_ID, getCategoryCacheKey, useBrowseStore } from '../stores/browseStore'
import { useFavoritesStore } from '../stores/favoritesStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { TopNavBar } from '../components/TopNavBar'
import { useTranslation } from '../lib/i18n'
import { useLicenseStore } from '../stores/licenseStore'
import MovieCard from '../components/movies/MovieCard'
import SeriesCard from '../components/series/SeriesCard'
import VirtualChannelGrid from '../components/live/VirtualChannelGrid'
import type { CategoryRecord, ChannelRecord, MovieRecord, SeriesRecord } from '../lib/db'

type Tab = 'channels' | 'movies' | 'series'

function safeString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function safeName(item: unknown): string {
  if (!item || typeof item !== 'object') return ''
  const obj = item as Record<string, unknown>
  return safeString(obj.name ?? obj.title ?? obj.series_name ?? '')
}

export default function ChannelCategories() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as Tab | null
  const categoryParam = searchParams.get('category')

  const [selectedTab, setSelectedTab] = useState<Tab>(tabParam || 'channels')
  const [showPlaylistDropdown, setShowPlaylistDropdown] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(tabParam === 'channels' || !tabParam ? FAVORITES_CATEGORY_ID : null)
  const [isDesktop, setIsDesktop] = useState(false)
  const [mobileView, setMobileView] = useState<'categories' | 'items'>('categories')
  const scrollRef = useRef<HTMLDivElement>(null)
  const categoryListRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)

  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const activeSource = getActiveSource()
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite)
  const browseState = useBrowseStore((s) => s.state)
  const { setSection, selectCategory, enterPlayer, saveItems, saveScrollTop, setFocusedItem, setSelectedSeries, loadCategoryItems } = useBrowseStore()
  const currentSection = selectedTab === 'channels' ? 'live' : selectedTab === 'movies' ? 'movies' : 'series'

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024)
    checkDesktop()
    window.addEventListener('resize', checkDesktop)
    return () => window.removeEventListener('resize', checkDesktop)
  }, [])

  useEffect(() => {
    if (tabParam && tabParam !== selectedTab) {
      console.log('[ChannelCategories] Tab param changed:', { from: selectedTab, to: tabParam })
      setSelectedTab(tabParam)
      setMobileView('categories')
      setSelectedCategoryId(tabParam === 'channels' ? FAVORITES_CATEGORY_ID : null)
    }
  }, [tabParam])

  useEffect(() => {
    setSection(selectedTab === 'channels' ? 'live' : selectedTab === 'movies' ? 'movies' : 'series')
  }, [selectedTab, setSection])

  useEffect(() => {
    if (categoryParam && categoryParam !== selectedCategoryId) {
      console.log('[ChannelCategories] Category param changed:', { categoryParam })
      setSelectedCategoryId(categoryParam)
      if (!isDesktop) {
        setMobileView('items')
      }
    }
  }, [categoryParam, isDesktop])

  useEffect(() => {
    const sectionState = browseState[currentSection]
    const restoredCategoryId = sectionState.selectedCategoryId
    const restoredCacheKey = getCategoryCacheKey(restoredCategoryId)
    const restoredItems = sectionState.itemsByCategory[restoredCacheKey] ?? []

    if (restoredCategoryId && restoredItems.length > 0) {
      if (!selectedCategoryId || selectedCategoryId !== sectionState.selectedCategoryId) {
        console.log('[ChannelCategories] Restoring from browse state:', { 
          section: currentSection, 
          categoryId: sectionState.selectedCategoryId,
          itemCount: restoredItems.length 
        })
        setSelectedCategoryId(sectionState.selectedCategoryId)
        if (!isDesktop) {
          setMobileView('items')
        }
      }
    }
  }, [browseState, currentSection, isDesktop, selectedCategoryId])

  useEffect(() => {
    const sectionState = browseState[currentSection]

    if (scrollRef.current && sectionState.scrollTop > 0) {
      scrollRef.current.scrollTop = sectionState.scrollTop
    }
  }, [browseState, currentSection, selectedCategoryId])

  // Request ID pattern for categories
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const categories = useLiveQuery(
    async () => {
      if (!activeSource) return []
      const requestId = ++requestIdRef.current
      console.log('[ChannelCategories] Loading categories:', { tab: selectedTab, requestId })
      setCategoriesLoading(true)

      try {
        const type = selectedTab === 'channels' ? 'live' : selectedTab === 'movies' ? 'movie' : 'series'
        const cats = await db.categories.where('sourceId').equals(activeSource.id).and(c => c.type === type).toArray()

        if (requestId !== requestIdRef.current) {
          console.log('[ChannelCategories] Ignoring stale categories response:', { requestId, current: requestIdRef.current })
          return []
        }

        const safeCats = Array.isArray(cats) ? cats : []
        console.log('[ChannelCategories] Categories loaded:', { count: safeCats.length, requestId })
        return safeCats.sort((a, b) => safeString(a?.name).localeCompare(safeString(b?.name)))
      } catch (err) {
        console.error('[ChannelCategories] Failed to load categories:', err)
        return []
      } finally {
        if (requestId === requestIdRef.current) {
          setCategoriesLoading(false)
        }
      }
    },
    [activeSource?.id, selectedTab],
  )

  const favoritesCount = useLiveQuery(
    async () => {
      if (!activeSource) return 0
      const itemType = selectedTab === 'channels' ? 'channel' : selectedTab === 'movies' ? 'movie' : 'series'
      const favorites = await db.favorites
        .where('sourceId')
        .equals(activeSource.id)
        .and(f => f.itemType === itemType)
        .toArray()
      return favorites.length
    },
    [activeSource?.id, selectedTab],
  )

  // Compute favorite IDs as a Set for O(1) lookup (avoids per-card store subscriptions)
  const favoriteIds = useLiveQuery(
    async () => {
      if (!activeSource) return new Set<string>()
      const favorites = await db.favorites
        .where('sourceId')
        .equals(activeSource.id)
        .and(f => f.itemType === 'channel')
        .toArray()
      return new Set(favorites.map(f => f.itemId))
    },
    [activeSource?.id],
  )

  const handleToggleFavorite = useCallback((channelId: string) => {
    const src = activeSource
    if (src) toggleFavorite('channel', channelId, src.id)
  }, [activeSource, toggleFavorite])

  const itemCounts = useLiveQuery(
    async () => {
      if (!activeSource) return new Map<string, number>()
      let items: { categoryId: string }[] = []
      if (selectedTab === 'channels') {
        items = await db.channels.where('sourceId').equals(activeSource.id).toArray()
      } else if (selectedTab === 'movies') {
        items = await db.movies.where('sourceId').equals(activeSource.id).toArray()
      } else {
        items = await db.series.where('sourceId').equals(activeSource.id).toArray()
      }
      const countMap = new Map<string, number>()
      const safeItems = Array.isArray(items) ? items : []
      safeItems.forEach(item => {
        if (item?.categoryId) {
          countMap.set(item.categoryId, (countMap.get(item.categoryId) ?? 0) + 1)
        }
      })
      return countMap
    },
    [activeSource?.id, selectedTab],
  )

  const selectedCacheKey = useMemo(() => {
    if (selectedTab === 'channels') {
      return getCategoryCacheKey(selectedCategoryId)
    }
    if (!selectedCategoryId) {
      return null
    }
    return getCategoryCacheKey(selectedCategoryId)
  }, [selectedCategoryId, selectedTab])

  const currentSectionState = browseState[currentSection]
  const safePreviewItems = useMemo(() => {
    if (!selectedCacheKey) {
      return []
    }
    return currentSectionState.itemsByCategory[selectedCacheKey] ?? []
  }, [currentSectionState.itemsByCategory, selectedCacheKey])

  const allMovies = useMemo(() => browseState.movies.itemsByCategory[ALL_ITEMS_CACHE_KEY] ?? [], [browseState.movies.itemsByCategory])
  const allSeries = useMemo(() => browseState.series.itemsByCategory[ALL_ITEMS_CACHE_KEY] ?? [], [browseState.series.itemsByCategory])
  const isCurrentCategoryLoading = selectedCacheKey ? currentSectionState.loadingCategoryIds.has(selectedCacheKey) : false

  useEffect(() => {
    if (!activeSource) return

    void loadCategoryItems(currentSection, activeSource.id, selectedCategoryId).catch((error) => {
      console.error('[ChannelCategories] Failed to load items for category:', error)
    })
  }, [activeSource, currentSection, loadCategoryItems, selectedCategoryId, selectedTab])

  const totalCount = itemCounts
    ? Array.from(itemCounts.values()).reduce((a, b) => a + b, 0)
    : 0

  const getCategoryName = () => {
    if (selectedCategoryId === null) {
      return selectedTab === 'channels' ? t('allChannels') : t('selectACategory')
    }
    if (selectedCategoryId === FAVORITES_CATEGORY_ID) {
      return 'Favorites'
    }
    const cat = categories?.find(c => c?.id === selectedCategoryId)
    return safeName(cat) || (selectedTab === 'channels' ? t('channelsTab') : t('selectACategory'))
  }

  const handleTabClick = (tab: Tab) => {
    if (tab === selectedTab) {
      console.log('[ChannelCategories] Tab already active, ignoring:', tab)
      return
    }

    console.log('[ChannelCategories] Switching tab:', { from: selectedTab, to: tab })

    if (scrollRef.current) {
      saveScrollTop(scrollRef.current.scrollTop)
    }

    // Increment request ID to cancel any pending loads
    requestIdRef.current++
    console.log('[ChannelCategories] Incremented request ID:', requestIdRef.current)

    setSelectedTab(tab)
    setSelectedCategoryId(tab === 'channels' ? FAVORITES_CATEGORY_ID : null)
    setMobileView('categories')
    const section = tab === 'channels' ? 'live' : tab === 'movies' ? 'movies' : 'series'
    setSection(section)
    navigate(`/live?tab=${tab}`, { replace: true })
  }

  const handleMobileBackToCategories = () => {
    console.log('[ChannelCategories] Back to categories')
    setMobileView('categories')
    const section = currentSection
    if (categoryListRef.current && browseState[section]?.scrollTop > 0) {
      categoryListRef.current.scrollTop = browseState[section].scrollTop
    }
  }

  const handleCategoryClick = (categoryId: string | null) => {
    if (categoryId === null && selectedTab !== 'channels') {
      return
    }

    console.log('[ChannelCategories] Clicked category:', { categoryId, tab: selectedTab, isDesktop })

    try {
      if (scrollRef.current) {
        saveScrollTop(scrollRef.current.scrollTop)
      }
    } catch {
      // ignore scroll save errors
    }

    if (isDesktop) {
      setSelectedCategoryId(categoryId)
      const cat = categories?.find(c => c?.id === categoryId)
      const catName = safeName(cat)
      selectCategory(categoryId, catName || null)
      if (activeSource) {
        void loadCategoryItems(currentSection, activeSource.id, categoryId).catch((error) => {
          console.error('[ChannelCategories] Failed to preload clicked category:', error)
        })
      }
    } else {
      if (selectedTab === 'channels') {
        navigate(`/live/${encodeURIComponent(categoryId ?? '__all__')}`)
      } else {
        if (categoryId === null) return
        setSelectedCategoryId(categoryId)
        const cat = categories?.find(c => c?.id === categoryId)
        const catName = safeName(cat)
        selectCategory(categoryId, catName || null)
        if (activeSource) {
          void loadCategoryItems(currentSection, activeSource.id, categoryId).catch((error) => {
            console.error('[ChannelCategories] Failed to preload mobile category:', error)
          })
        }
        setMobileView('items')
        console.log('[ChannelCategories] Switched to mobile items view:', { categoryId, catName })
      }
    }
  }

  const handleItemClick = (item: ChannelRecord | MovieRecord | SeriesRecord) => {
    console.log('[ChannelCategories] Item clicked:', {
      id: item?.id,
      name: safeName(item),
      tab: selectedTab
    })

    if (!item) {
      console.error('[ChannelCategories] Cannot click null item')
      return
    }

    if (selectedTab === 'series') {
      const series = item as SeriesRecord
      if (!series?.externalId) {
        console.error('[ChannelCategories] Series missing externalId:', series)
        return
      }
      setSection('series')
      setSelectedSeries(series.externalId)
      setFocusedItem(item.id)
      if (scrollRef.current) {
        saveScrollTop(scrollRef.current.scrollTop)
      }
      if (safePreviewItems.length > 0) {
        saveItems(safePreviewItems, selectedCategoryId)
      }
      navigate(`/series/${encodeURIComponent(series.externalId)}`)
      return
    }

    if (selectedTab === 'movies') {
      const movie = item as MovieRecord
      setSection('movies')
      setFocusedItem(item.id)
      if (scrollRef.current) {
        saveScrollTop(scrollRef.current.scrollTop)
      }
      if (safePreviewItems.length > 0) {
        saveItems(safePreviewItems, selectedCategoryId)
      }
      navigate(`/movie/${encodeURIComponent(movie.id)}`)
      return
    }

    // Channels - go directly to player
    enterPlayer(item.id)
    setFocusedItem(item.id)
    if (safePreviewItems.length > 0) {
      saveItems(safePreviewItems, selectedCategoryId)
    }
    const scrollY = scrollRef.current?.scrollTop || 0
    console.log('[ChannelCategories] Navigating to channel:', {
      channelId: item.id,
      channelName: safeName(item),
      from: '/live?tab=channels',
      tab: 'channels',
      categoryId: selectedCategoryId,
      scrollY
    })
    navigate(`/watch/live/${encodeURIComponent(item.id)}`, {
      state: {
        from: '/live?tab=channels',
        tab: 'channels',
        categoryId: selectedCategoryId,
        scrollY
      }
    })
  }

  if (!activeSource) {
    return (
      <div className="min-h-screen bg-slate-900">
        <TopNavBar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p className="text-slate-400">{t('noPlaylistActive')}</p>
        </div>
      </div>
    )
  }

  const licenseStatus = useLicenseStore((s) => s.status)
  const deviceId = useLicenseStore((s) => s.deviceId)

  if (licenseStatus === 'expired') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <TopNavBar />
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Your subscription has expired</h2>
            <p className="text-slate-400 text-sm mb-6">Contact your provider to renew</p>
            <div className="inline-flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg border border-slate-700 mb-6">
              <span className="text-slate-500 text-sm">Device ID:</span>
              <span className="text-white font-mono text-sm uppercase">{deviceId || '--------'}</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate('/home')}
                className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500/50 min-h-[48px]"
              >
                Home
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[48px]"
              >
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Mobile items view for Movies/Series
  const showMobileItemsView = !isDesktop && mobileView === 'items' && selectedCategoryId && (selectedTab === 'movies' || selectedTab === 'series')

  const safeCategories: CategoryRecord[] = Array.isArray(categories) ? categories : []

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      <TopNavBar />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Left Column: Categories - Hidden on mobile when showing items */}
        <div className={`bg-slate-900 flex flex-col ${isDesktop ? 'flex-shrink-0 w-[400px] border-r border-slate-700' : 'flex-1 min-h-0 overflow-hidden'} ${showMobileItemsView ? 'hidden' : 'flex'}`}>
          {/* Playlist Info */}
          <div className="relative flex-shrink-0 flex items-center">
            <button
              onClick={() => setShowPlaylistDropdown(!showPlaylistDropdown)}
              className="flex-1 bg-slate-800 px-4 py-3 border-b border-slate-700 flex items-center justify-between hover:bg-slate-750 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50"
            >
              <div className="flex-1 text-left min-w-0">
                <p className="text-base font-medium text-white truncate">{activeSource.name}</p>
                <p className="text-sm text-slate-400 truncate">
                  {activeSource.type === 'xtream' ? activeSource.serverUrl : (activeSource as {url?: string}).url}
                </p>
              </div>
              <div className="w-10 h-10 flex items-center justify-center text-slate-400 flex-shrink-0">
                {showPlaylistDropdown ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </button>
            <div className="flex items-center gap-1 px-3 border-b border-slate-700 bg-slate-800/50">
              <button
                onClick={() => navigate('/search')}
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                aria-label={t('search')}
              >
                <Search size={18} />
              </button>
              <button
                onClick={() => navigate('/epg')}
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                aria-label={t('tvGuide')}
              >
                <Calendar size={18} />
              </button>
            </div>
            {showPlaylistDropdown && (
              <SidebarPlaylistDropdown
                onClose={() => setShowPlaylistDropdown(false)}
              />
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-4 sm:gap-6 px-4 bg-slate-900 border-b border-slate-700 flex-shrink-0">
            <button
              onClick={() => handleTabClick('channels')}
              className={`h-12 text-base font-medium border-b-2 transition-colors focus:outline-none ${
                selectedTab === 'channels'
                  ? 'text-yellow-500 border-yellow-500'
                  : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              {t('channelsTab')}
            </button>
            <button
              onClick={() => handleTabClick('movies')}
              className={`h-12 text-base font-medium border-b-2 transition-colors focus:outline-none ${
                selectedTab === 'movies'
                  ? 'text-yellow-500 border-yellow-500'
                  : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              {t('moviesTab')}
            </button>
            <button
              onClick={() => handleTabClick('series')}
              className={`h-12 text-base font-medium border-b-2 transition-colors focus:outline-none ${
                selectedTab === 'series'
                  ? 'text-yellow-500 border-yellow-500'
                  : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              {t('seriesTab')}
            </button>
          </div>

          {/* Category List */}
          <div ref={categoryListRef} className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain" style={{ touchAction: 'pan-y' }}>
            {categoriesLoading && (
              <div className="flex items-center justify-center h-32">
                <p className="text-slate-400">{t('loadingCategories')}</p>
              </div>
            )}
            
            {!categoriesLoading && (
              <>
                <CategoryListItem
                  name="Favorites"
                  count={favoritesCount || 0}
                  starred
                  isActive={selectedCategoryId === FAVORITES_CATEGORY_ID}
                  onClick={() => handleCategoryClick(FAVORITES_CATEGORY_ID)}
                />
                {selectedTab === 'channels' && (
                  <CategoryListItem
                    name="All channels"
                    count={totalCount}
                    isActive={selectedCategoryId === null}
                    onClick={() => handleCategoryClick(null)}
                  />
                )}
              </>
            )}

            {!categoriesLoading && safeCategories.map(cat => (
              <CategoryListItem
                key={cat?.id || Math.random()}
                name={safeName(cat) || 'Untitled'}
                count={itemCounts?.get(cat?.id as string) ?? 0}
                isActive={selectedCategoryId === (cat?.id as string | null)}
                onClick={() => handleCategoryClick((cat?.id as string | null) || null)}
              />
            ))}

            {!categoriesLoading && safeCategories.length === 0 && (
              <div className="flex items-center justify-center h-32">
                <p className="text-slate-400 text-base">
                  {selectedTab === 'channels' ? 'No channel categories' : selectedTab === 'movies' ? 'No movies' : 'No series'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Content Grid - Desktop only OR Mobile items view */}
        <main
          ref={scrollRef}
          className={`flex-1 flex flex-col overflow-hidden min-h-0 ${isDesktop ? 'hidden lg:flex' : showMobileItemsView ? 'flex' : 'hidden'}`}
        >
          {/* Category Header with Back button for mobile */}
          <div className="h-14 flex-shrink-0 bg-slate-900 border-b border-slate-700 flex items-center px-4 sm:px-6">
            {!isDesktop && showMobileItemsView && (
              <button
                onClick={handleMobileBackToCategories}
                className="flex items-center gap-2 mr-3 px-2 py-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                aria-label="Back to categories"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Back</span>
              </button>
            )}
            <h2 className="text-lg sm:text-xl font-bold text-white truncate">{getCategoryName()}</h2>
            {safePreviewItems.length > 0 && (
              <span className="ml-3 text-sm text-slate-400 flex-shrink-0">
                {safePreviewItems.length} {selectedTab === 'channels' ? 'channels' : selectedTab === 'movies' ? 'movies' : 'series'}
              </span>
            )}
          </div>

          {/* Content Grid */}
          {selectedTab === 'channels' ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              {isCurrentCategoryLoading && safePreviewItems.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-400">Loading channels...</p>
                </div>
              )}

              {!isCurrentCategoryLoading && safePreviewItems.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  {selectedCategoryId === FAVORITES_CATEGORY_ID ? (
                    <div className="flex flex-col items-center justify-center gap-4 text-center px-4">
                      <Star className="w-12 h-12 text-slate-500" />
                      <p className="text-slate-300">No favorites yet</p>
                      <p className="text-sm text-slate-500">Star a channel to add it here</p>
                    </div>
                  ) : (
                    <p className="text-slate-400">No channels in this category</p>
                  )}
                </div>
              )}

              {safePreviewItems.length > 0 && (
                <VirtualChannelGrid
                  key={selectedCategoryId ?? '__all__'}
                  channels={safePreviewItems as ChannelRecord[]}
                  favoriteIds={favoriteIds ?? new Set<string>()}
                  onToggleFavorite={handleToggleFavorite}
                  onItemClick={handleItemClick}
                />
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
            {/* Movies Home View - when movies tab is active but no category selected */}
            {selectedTab === 'movies' && !selectedCategoryId && (
              <MoviesHome
                allMovies={allMovies}
                categories={safeCategories}
                itemCounts={itemCounts}
                onSelectCategory={handleCategoryClick}
                onSelectMovie={handleItemClick}
              />
            )}

            {/* Series Home View - when series tab is active but no category selected */}
            {selectedTab === 'series' && !selectedCategoryId && (
              <SeriesHome
                allSeries={allSeries}
                categories={safeCategories}
                itemCounts={itemCounts}
                onSelectCategory={handleCategoryClick}
                onSelectSeries={handleItemClick}
              />
            )}

            {/* Regular category view */}
            {selectedCategoryId && (
              <>
                {isCurrentCategoryLoading && safePreviewItems.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-slate-400">Loading {selectedTab}...</p>
                  </div>
                )}

                {!isCurrentCategoryLoading && safePreviewItems.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-slate-400">No {selectedTab} in this category</p>
                  </div>
                )}

                {safePreviewItems.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                    {selectedTab === 'movies' && safePreviewItems.map(item => (
                      <MovieCard
                        key={(item as MovieRecord)?.id || Math.random()}
                        movie={item as MovieRecord}
                        onClick={() => handleItemClick(item)}
                      />
                    ))}
                    {selectedTab === 'series' && safePreviewItems.map(item => (
                      <SeriesCard
                        key={(item as SeriesRecord)?.id || Math.random()}
                        series={item as SeriesRecord}
                        onClick={() => handleItemClick(item)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

type CategoryListItemProps = {
  name: string
  count: number
  starred?: boolean
  isActive?: boolean
  onClick: () => void
}

function CategoryListItem({ name, count, starred, isActive, onClick }: CategoryListItemProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <button
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      className={`w-full h-14 px-4 flex items-center justify-between border-b border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 ${
        isActive
          ? 'bg-indigo-600/20'
          : starred
            ? 'bg-slate-800 hover:bg-slate-750'
            : 'bg-slate-900 hover:bg-slate-800'
      }`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {starred && <Star size={16} className="text-yellow-500 flex-shrink-0 fill-yellow-500" />}
        <span className={`text-base truncate ${starred ? 'text-yellow-500' : isActive ? 'text-indigo-400' : 'text-white'}`}>
          {name || 'Untitled'}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {count > 0 && <span className="text-sm text-slate-400">{count.toLocaleString()}</span>}
        <ChevronRight size={20} className="text-slate-500" />
      </div>
    </button>
  )
}

type MoviesHomeProps = {
  allMovies: MovieRecord[] | undefined
  categories: CategoryRecord[]
  itemCounts: Map<string, number> | undefined
  onSelectCategory: (categoryId: string) => void
  onSelectMovie: (movie: MovieRecord) => void
}

function MoviesHome({ allMovies, categories, itemCounts, onSelectCategory, onSelectMovie }: MoviesHomeProps) {
  // Get recently added movies - limit to 24
  const recentMovies = allMovies?.slice(0, 24) ?? []

  // Get categories with counts
  const categoriesWithCounts = categories
    .map(cat => ({
      ...cat,
      count: itemCounts?.get(cat.id) ?? 0,
    }))
    .filter(cat => cat.count > 0)
    .slice(0, 12) // Limit to 12 categories for display

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold text-white mb-2">Movies</h1>
        <p className="text-slate-400">Explore your VOD library</p>
      </div>

      {/* Recently Added Section */}
      {recentMovies.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4 px-2">Recently Added</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
            {recentMovies.map(movie => (
              <MovieCard
                key={movie.id}
                movie={movie}
                onClick={() => onSelectMovie(movie)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Browse Categories Section */}
      {categoriesWithCounts.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4 px-2">Browse Categories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categoriesWithCounts.map(cat => (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className="flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <div className="min-w-0">
                  <h3 className="font-medium text-white truncate">{cat.name}</h3>
                  <p className="text-sm text-slate-400">{cat.count.toLocaleString()} movies</p>
                </div>
                <ChevronRight size={20} className="text-slate-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no movies at all */}
      {!allMovies?.length && (
        <div className="text-center py-12">
          <p className="text-slate-400">No movies found in your library</p>
        </div>
      )}
    </div>
  )
}

type SeriesHomeProps = {
  allSeries: SeriesRecord[] | undefined
  categories: CategoryRecord[]
  itemCounts: Map<string, number> | undefined
  onSelectCategory: (categoryId: string) => void
  onSelectSeries: (series: SeriesRecord) => void
}

function SeriesHome({ allSeries, categories, itemCounts, onSelectCategory, onSelectSeries }: SeriesHomeProps) {
  // Get recently added series - limit to 24
  const recentSeries = allSeries?.slice(0, 24) ?? []

  // Get categories with counts
  const categoriesWithCounts = categories
    .map(cat => ({
      ...cat,
      count: itemCounts?.get(cat.id) ?? 0,
    }))
    .filter(cat => cat.count > 0)
    .slice(0, 12) // Limit to 12 categories for display

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold text-white mb-2">Series</h1>
        <p className="text-slate-400">Explore your series library</p>
      </div>

      {/* Recently Added Section */}
      {recentSeries.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4 px-2">Recently Added</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
            {recentSeries.map(series => (
              <SeriesCard
                key={series.id}
                series={series}
                onClick={() => onSelectSeries(series)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Browse Categories Section */}
      {categoriesWithCounts.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4 px-2">Browse Categories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categoriesWithCounts.map(cat => (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className="flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <div className="min-w-0">
                  <h3 className="font-medium text-white truncate">{cat.name}</h3>
                  <p className="text-sm text-slate-400">{cat.count.toLocaleString()} series</p>
                </div>
                <ChevronRight size={20} className="text-slate-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no series at all */}
      {!allSeries?.length && (
        <div className="text-center py-12">
          <p className="text-slate-400">No series found in this playlist</p>
        </div>
      )}
    </div>
  )
}

type SidebarPlaylistDropdownProps = {
  onClose: () => void
}

function SidebarPlaylistDropdown({ onClose }: SidebarPlaylistDropdownProps) {
  const sources = usePlaylistStore((state) => state.sources)
  const activeSourceId = usePlaylistStore((state) => state.activeSourceId)
  const setActiveSource = usePlaylistStore((state) => state.setActiveSource)
  const [justSwitched, setJustSwitched] = useState<string | null>(null)

  const formatExpDate = (exp: number | null) => {
    if (!exp || exp === 0) return null
    return new Date(exp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const handleSwitch = (id: string) => {
    if (id === activeSourceId) { onClose(); return }
    setActiveSource(id)
    setJustSwitched(id)
    setTimeout(() => { setJustSwitched(null); onClose() }, 1500)
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 top-full mt-1 w-full min-w-[280px] max-h-72 overflow-y-auto bg-slate-800 border border-slate-700 rounded-b-lg shadow-xl z-50">
        <div className="px-3 py-2 border-b border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Switch Playlist</p>
        </div>
        {sources.length === 0 && (
          <div className="px-3 py-4 text-center">
            <p className="text-slate-400 text-sm">No playlists found</p>
          </div>
        )}
        {sources.map((s) => {
          const isActive = s.id === activeSourceId
          const isJustSwitched = s.id === justSwitched
          return (
            <button
              key={s.id}
              onClick={() => handleSwitch(s.id)}
              className={`w-full text-left px-3 py-2.5 flex flex-col gap-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 ${isActive ? 'bg-slate-700/50' : 'hover:bg-slate-700'}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm truncate ${isActive ? 'text-yellow-500 font-medium' : 'text-white'}`}>{s.name}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isJustSwitched && <span className="text-xs text-green-400 font-medium">Switched</span>}
                  {isActive && <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded">Active</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{s.type === 'xtream' ? 'Xtream' : 'M3U'}</span>
                {s.type === 'xtream' && s.expDate && <span>exp: {formatExpDate(s.expDate)}</span>}
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}
