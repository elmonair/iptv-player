import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, Star, ChevronRight } from 'lucide-react'
import { usePlaylistStore } from '../stores/playlistStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { ChannelRecord } from '../lib/db'
import { TopNavBar } from '../components/TopNavBar'

type Tab = 'channels' | 'movies' | 'series'

export default function ChannelCategories() {
  const navigate = useNavigate()
  const [selectedTab, setSelectedTab] = useState<Tab>('channels')
  const [playlistExpanded, setPlaylistExpanded] = useState(false)
  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const activeSource = getActiveSource()

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024)
    checkDesktop()
    window.addEventListener('resize', checkDesktop)
    return () => window.removeEventListener('resize', checkDesktop)
  }, [])

  const categories = useLiveQuery(
    async () => {
      if (!activeSource) return []
      const type = selectedTab === 'channels' ? 'live' : selectedTab === 'movies' ? 'movie' : 'series'
      const cats = await db.categories.where('sourceId').equals(activeSource.id).and(c => c.type === type).toArray()
      return cats.sort((a, b) => a.name.localeCompare(b.name))
    },
    [activeSource, selectedTab],
  )

  const channelCounts = useLiveQuery(
    async () => {
      if (!activeSource) return new Map<string, number>()
      const channels = await db.channels.where('sourceId').equals(activeSource.id).toArray()
      const countMap = new Map<string, number>()
      channels.forEach(ch => {
        countMap.set(ch.categoryId, (countMap.get(ch.categoryId) ?? 0) + 1)
      })
      return countMap
    },
    [activeSource],
  )

  const previewChannels = useLiveQuery(
    async () => {
      if (!activeSource) return []
      const catId = hoveredCategoryId ?? selectedCategoryId
      let query
      if (catId) {
        query = db.channels.where('categoryId').equals(catId).toArray()
      } else {
        query = db.channels.where('sourceId').equals(activeSource.id).toArray()
      }
      const result = await query
      return result.sort((a, b) => a.name.localeCompare(b.name))
    },
    [activeSource, hoveredCategoryId, selectedCategoryId],
  )

  const totalCount = channelCounts
    ? Array.from(channelCounts.values()).reduce((a, b) => a + b, 0)
    : 0

  const displayCategoryId = selectedCategoryId ?? hoveredCategoryId
  const displayCategoryName = displayCategoryId === null
    ? 'All Channels'
    : categories?.find(c => c.id === displayCategoryId)?.name ?? 'Channels'

  const handleCategoryClick = (categoryId: string | null) => {
    if (isDesktop) {
      setSelectedCategoryId(categoryId)
    } else {
      navigate(`/live/${encodeURIComponent(categoryId ?? '__all__')}`)
    }
  }

  const handleChannelClick = (channel: ChannelRecord) => {
    navigate(`/watch/${encodeURIComponent(channel.id)}`)
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

  return (
    <div className="min-h-screen bg-slate-900">
      <TopNavBar />

      <div className="flex flex-col lg:flex-row">
        {/* Left Column: Categories */}
        <div className={`flex-shrink-0 bg-slate-900 flex flex-col ${isDesktop ? 'w-[400px] border-r border-slate-700' : 'w-full'}`}>
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
              onClick={() => { setSelectedTab('channels'); setSelectedCategoryId(null) }}
              className={`h-12 text-base font-medium border-b-2 transition-colors focus:outline-none ${
                selectedTab === 'channels'
                  ? 'text-yellow-500 border-yellow-500'
                  : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              Channels
            </button>
            <button
              onClick={() => { setSelectedTab('movies'); setSelectedCategoryId(null) }}
              className={`h-12 text-base font-medium border-b-2 transition-colors focus:outline-none ${
                selectedTab === 'movies'
                  ? 'text-yellow-500 border-yellow-500'
                  : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              Movies
            </button>
            <button
              onClick={() => { setSelectedTab('series'); setSelectedCategoryId(null) }}
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
          <div className="flex-1 overflow-y-auto">
            {selectedTab === 'channels' && (
              <>
                <CategoryListItem
                  name="All channels"
                  count={totalCount}
                  isActive={displayCategoryId === null}
                  onClick={() => handleCategoryClick(null)}
                  onMouseEnter={() => setHoveredCategoryId(null)}
                  onMouseLeave={() => setHoveredCategoryId(null)}
                />
                <CategoryListItem
                  name="Favorites"
                  count={0}
                  starred
                  isActive={false}
                  onClick={() => {}}
                  onMouseEnter={() => {}}
                  onMouseLeave={() => {}}
                />
              </>
            )}

            {categories?.map(cat => (
              <CategoryListItem
                key={cat.id}
                name={cat.name}
                count={channelCounts?.get(cat.id) ?? 0}
                isActive={displayCategoryId === cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                onMouseEnter={() => setHoveredCategoryId(cat.id)}
                onMouseLeave={() => setHoveredCategoryId(null)}
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

        {/* Right Column: Channel Grid - Desktop only */}
        <main className="hidden lg:flex flex-1 flex-col overflow-hidden">
          {/* Category Header */}
          <div className="h-14 flex-shrink-0 bg-slate-900 border-b border-slate-700 flex items-center px-6">
            <h2 className="text-xl font-bold text-white">{displayCategoryName}</h2>
            {previewChannels && (
              <span className="ml-3 text-sm text-slate-400">{previewChannels.length} channels</span>
            )}
          </div>

          {/* Channel Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {previewChannels === undefined && (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-400">Hover or select a category</p>
              </div>
            )}

            {previewChannels && previewChannels.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-400">No channels in this category</p>
              </div>
            )}

            {previewChannels && previewChannels.length > 0 && (
              <div className="grid grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {previewChannels.map(channel => (
                  <ChannelCard
                    key={channel.id}
                    channel={channel}
                    onClick={() => handleChannelClick(channel)}
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
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function CategoryListItem({ name, count, starred, isActive, onClick, onMouseEnter, onMouseLeave }: CategoryListItemProps) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
