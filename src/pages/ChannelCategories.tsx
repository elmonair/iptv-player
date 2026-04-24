import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, Star, ChevronRight, ArrowLeft } from 'lucide-react'
import { usePlaylistStore } from '../stores/playlistStore'
import { useBrowseStore } from '../stores/browseStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { ChannelRecord, MovieRecord, SeriesRecord } from '../lib/db'
import { TopNavBar } from '../components/TopNavBar'
import MovieCard from '../components/movies/MovieCard'
import SeriesCard from '../components/series/SeriesCard'

type Tab = 'channels' | 'movies' | 'series'

export default function ChannelCategories() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as Tab | null
  const categoryParam = searchParams.get('category')

  const [selectedTab, setSelectedTab] = useState<Tab>(tabParam || 'channels')
  const [playlistExpanded, setPlaylistExpanded] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)
  const [mobileView, setMobileView] = useState<'categories' | 'items'>('categories')
  const scrollRef = useRef<HTMLDivElement>(null)
  const categoryListRef = useRef<HTMLDivElement>(null)

  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const activeSource = getActiveSource()
  const browseState = useBrowseStore((s) => s.state)
  const { setSection, selectCategory, enterPlayer, saveItems, saveScrollTop, setFocusedItem, setSelectedSeries } = useBrowseStore()

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024)
    checkDesktop()
    window.addEventListener('resize', checkDesktop)
    return () => window.removeEventListener('resize', checkDesktop)
  }, [])

  useEffect(() => {
    if (tabParam && tabParam !== selectedTab) {
      setSelectedTab(tabParam)
      setMobileView('categories')
    }
  }, [tabParam, selectedTab])

  useEffect(() => {
    setSection(selectedTab === 'channels' ? 'live' : selectedTab === 'movies' ? 'movies' : 'series')
  }, [selectedTab, setSection])

  useEffect(() => {
    if (categoryParam && categoryParam !== selectedCategoryId) {
      setSelectedCategoryId(categoryParam)
      if (!isDesktop) {
        setMobileView('items')
      }
    }
  }, [categoryParam, selectedCategoryId, isDesktop])

  useEffect(() => {
    const section = selectedTab === 'channels' ? 'live' : selectedTab === 'movies' ? 'movies' : 'series'
    const sectionState = browseState[section]

    if (sectionState.selectedCategoryId && sectionState.items.length > 0) {
      if (!selectedCategoryId || selectedCategoryId !== sectionState.selectedCategoryId) {
        setSelectedCategoryId(sectionState.selectedCategoryId)
        if (!isDesktop) {
          setMobileView('items')
        }
      }
    }
  }, [isDesktop, selectedCategoryId, selectedTab])

  useEffect(() => {
    const section = selectedTab === 'channels' ? 'live' : selectedTab === 'movies' ? 'movies' : 'series'
    const sectionState = browseState[section]

    if (scrollRef.current && sectionState.scrollTop > 0) {
      scrollRef.current.scrollTop = sectionState.scrollTop
    }
  }, [selectedCategoryId])

  const categories = useLiveQuery(
    async () => {
      if (!activeSource) return []
      const type = selectedTab === 'channels' ? 'live' : selectedTab === 'movies' ? 'movie' : 'series'
      const cats = await db.categories.where('sourceId').equals(activeSource.id).and(c => c.type === type).toArray()
      return cats.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
    },
    [activeSource, selectedTab],
  )

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
      items.forEach(item => {
        countMap.set(item.categoryId, (countMap.get(item.categoryId) ?? 0) + 1)
      })
      return countMap
    },
    [activeSource, selectedTab],
  )

  const previewItems = useLiveQuery(
    async () => {
      if (!activeSource) return []

      if (selectedCategoryId) {
        if (selectedTab === 'channels') {
          return db.channels.where('categoryId').equals(selectedCategoryId).toArray()
        } else if (selectedTab === 'movies') {
          return db.movies.where('categoryId').equals(selectedCategoryId).toArray()
        } else {
          return db.series.where('categoryId').equals(selectedCategoryId).toArray()
        }
      }
      if (selectedTab === 'channels') {
        return db.channels.where('sourceId').equals(activeSource.id).toArray()
      }
      return []
    },
    [activeSource, selectedCategoryId, selectedTab],
  )

  useEffect(() => {
    if (previewItems && previewItems.length > 0 && selectedCategoryId) {
      selectCategory(selectedCategoryId, categories?.find(c => c.id === selectedCategoryId)?.name ?? null)
      saveItems(previewItems)
    }
  }, [previewItems, selectedCategoryId])

  const totalCount = itemCounts
    ? Array.from(itemCounts.values()).reduce((a, b) => a + b, 0)
    : 0

  const getCategoryName = () => {
    if (selectedCategoryId === null) {
      return selectedTab === 'channels' ? 'All Channels' : 'Select a category'
    }
    return categories?.find(c => c.id === selectedCategoryId)?.name ?? (selectedTab === 'channels' ? 'Channels' : 'Select a category')
  }

  const handleTabClick = (tab: Tab) => {
    if (scrollRef.current) {
      saveScrollTop(scrollRef.current.scrollTop)
    }
    setSelectedTab(tab)
    setSelectedCategoryId(null)
    setMobileView('categories')
    const section = tab === 'channels' ? 'live' : tab === 'movies' ? 'movies' : 'series'
    setSection(section)
    navigate(`/live?tab=${tab}`, { replace: true })
  }

  const handleMobileBackToCategories = () => {
    setMobileView('categories')
    if (categoryListRef.current && browseState[selectedTab === 'channels' ? 'live' : selectedTab].scrollTop > 0) {
      categoryListRef.current.scrollTop = browseState[selectedTab === 'channels' ? 'live' : selectedTab].scrollTop
    }
  }

  const handleCategoryClick = (categoryId: string | null) => {
    if (categoryId === null && selectedTab !== 'channels') {
      return
    }

    console.log(`[ChannelCategories] Clicked category:`, { categoryId, tab: selectedTab, isDesktop })

    try {
      if (scrollRef.current) {
        saveScrollTop(scrollRef.current.scrollTop)
      }
    } catch {
      // ignore scroll save errors
    }

    if (isDesktop) {
      setSelectedCategoryId(categoryId)
      if (categoryId) {
        const catName = categories?.find(c => c.id === categoryId)?.name ?? null
        selectCategory(categoryId, catName)
      }
    } else {
      if (selectedTab === 'channels') {
        navigate(`/live/${encodeURIComponent(categoryId ?? '__all__')}`)
      } else {
        if (categoryId === null) return
        setSelectedCategoryId(categoryId)
        const catName = categories?.find(c => c.id === categoryId)?.name ?? null
        selectCategory(categoryId, catName)
        setMobileView('items')
        console.log(`[ChannelCategories] Switched to mobile items view:`, { categoryId, catName })
      }
    }
  }

  const handleItemClick = (item: ChannelRecord | MovieRecord | SeriesRecord) => {
    if (selectedTab === 'series') {
      const series = item as SeriesRecord
      setSection('series')
      setSelectedSeries(series.externalId)
      setFocusedItem(item.id)
      if (scrollRef.current) {
        saveScrollTop(scrollRef.current.scrollTop)
      }
      if (previewItems) {
        saveItems(previewItems)
      }
      navigate(`/series/${encodeURIComponent(series.externalId)}`)
      return
    }
    enterPlayer(item.id)
    setFocusedItem(item.id)
    if (previewItems) {
      saveItems(previewItems)
    }
    navigate(`/watch/${encodeURIComponent(item.id)}`)
  }

  if (!activeSource) {
    return (
      <div className="min-h-screen bg-slate-900">
        <TopNavBar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p className="text-slate-400">No playlist active</p>
        </div>
      </div>
    )
  }

  // Mobile items view for Movies/Series
  const showMobileItemsView = !isDesktop && mobileView === 'items' && selectedCategoryId && (selectedTab === 'movies' || selectedTab === 'series')

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      <TopNavBar />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Left Column: Categories - Hidden on mobile when showing items */}
        <div className={`flex-shrink-0 bg-slate-900 flex flex-col ${isDesktop ? 'w-[400px] border-r border-slate-700' : 'w-full'} ${showMobileItemsView ? 'hidden' : 'flex'}`}>
          {/* Playlist Info */}
          <button
            onClick={() => setPlaylistExpanded(!playlistExpanded)}
            className="w-full bg-slate-800 px-4 py-3 border-b border-slate-700 flex items-center justify-between hover:bg-slate-750 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50"
          >
            <div className="flex-1 text-left">
              <p className="text-base font-medium text-white truncate">{activeSource.name}</p>
              {playlistExpanded && (
                <p className="text-sm text-slate-400 truncate">
                  {activeSource.type === 'xtream' ? activeSource.serverUrl : activeSource.url}
                </p>
              )}
            </div>
            <div className="w-10 h-10 flex items-center justify-center text-slate-400">
              {playlistExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </button>

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
              Channels
            </button>
            <button
              onClick={() => handleTabClick('movies')}
              className={`h-12 text-base font-medium border-b-2 transition-colors focus:outline-none ${
                selectedTab === 'movies'
                  ? 'text-yellow-500 border-yellow-500'
                  : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              Movies
            </button>
            <button
              onClick={() => handleTabClick('series')}
              className={`h-12 text-base font-medium border-b-2 transition-colors focus:outline-none ${
                selectedTab === 'series'
                  ? 'text-yellow-500 border-yellow-500'
                  : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              Series
            </button>
          </div>

          {/* Category List */}
          <div ref={categoryListRef} className="flex-1 overflow-y-auto">
            {selectedTab === 'channels' && (
              <>
                <CategoryListItem
                  name="All channels"
                  count={totalCount}
                  isActive={selectedCategoryId === null}
                  onClick={() => handleCategoryClick(null)}
                />
                <CategoryListItem
                  name="Favorites"
                  count={0}
                  starred
                  isActive={false}
                  onClick={() => {}}
                />
              </>
            )}

            {categories?.map(cat => (
              <CategoryListItem
                key={cat.id}
                name={cat.name ?? ''}
                count={itemCounts?.get(cat.id) ?? 0}
                isActive={selectedCategoryId === cat.id}
                onClick={() => handleCategoryClick(cat.id)}
              />
            ))}

            {categories?.length === 0 && (
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
          className={`flex-1 flex-col overflow-hidden ${isDesktop ? 'hidden lg:flex' : showMobileItemsView ? 'flex' : 'hidden'}`}
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
            {previewItems && (
              <span className="ml-3 text-sm text-slate-400 flex-shrink-0">
                {previewItems.length} {selectedTab === 'channels' ? 'channels' : selectedTab === 'movies' ? 'movies' : 'series'}
              </span>
            )}
          </div>

          {/* Content Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {previewItems === undefined && (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-400">Select a category</p>
              </div>
            )}

            {previewItems && previewItems.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-400">
                  {selectedTab === 'channels' ? 'No channels in this category' :
                   selectedCategoryId === null ? 'Select a category to browse' :
                   `No ${selectedTab} in this category`}
                </p>
              </div>
            )}

            {previewItems && previewItems.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                {selectedTab === 'channels' && previewItems.map(item => (
                  <ChannelCard
                    key={item.id}
                    channel={item as ChannelRecord}
                    onClick={() => handleItemClick(item)}
                  />
                ))}
                {selectedTab === 'movies' && previewItems.map(item => (
                  <MovieCard
                    key={item.id}
                    movie={item as MovieRecord}
                    onClick={() => handleItemClick(item)}
                  />
                ))}
                {selectedTab === 'series' && previewItems.map(item => (
                  <SeriesCard
                    key={item.id}
                    series={item as SeriesRecord}
                    onClick={() => handleItemClick(item)}
                  />
                ))}
              </div>
            )}
          </div>
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
          {name}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {count > 0 && <span className="text-sm text-slate-400">{count.toLocaleString()}</span>}
        <ChevronRight size={20} className="text-slate-500" />
      </div>
    </button>
  )
}

type ChannelCardProps = {
  channel: ChannelRecord
  onClick: () => void
}

function ChannelCard({ channel, onClick }: ChannelCardProps) {
  const [imageError, setImageError] = useState(false)
  const initial = channel.name.trim().charAt(0).toUpperCase()

  return (
    <button
      onClick={onClick}
      className="group bg-slate-800 rounded-lg overflow-hidden border border-slate-700 hover:border-indigo-500 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
    >
      <div className="relative aspect-square bg-slate-900 flex items-center justify-center p-4">
        {!imageError && channel.logoUrl ? (
          <img
            src={channel.logoUrl}
            alt={channel.name}
            className="w-full h-full object-contain"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">{initial}</span>
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-white text-sm font-medium truncate text-center" title={channel.name}>
          {channel.name}
        </p>
      </div>
    </button>
  )
}