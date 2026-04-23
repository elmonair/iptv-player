import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Settings, MoreVertical, ChevronDown, ChevronUp, Star, ChevronRight } from 'lucide-react'
import { usePlaylistStore } from '../stores/playlistStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'

type Tab = 'channels' | 'movies' | 'series'

export default function ChannelCategories() {
  const navigate = useNavigate()
  const [selectedTab, setSelectedTab] = useState<Tab>('channels')
  const [playlistExpanded, setPlaylistExpanded] = useState(false)
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const activeSource = getActiveSource()

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

  const totalCount = channelCounts
    ? Array.from(channelCounts.values()).reduce((a, b) => a + b, 0)
    : 0

  const handleCategoryClick = (categoryId: string | null) => {
    navigate(`/live/${encodeURIComponent(categoryId ?? '__all__')}`)
  }

  if (!activeSource) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-slate-400">No playlist active</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <header className="h-14 sm:h-16 flex-shrink-0 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4">
        <h1 className="text-lg sm:text-xl font-bold text-white">
          IPTV <span className="text-yellow-500">Player</span>
        </h1>
        <div className="flex items-center gap-1 sm:gap-2">
          <button className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
            <Search size={20} />
          </button>
          <button className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
            <Settings size={20} />
          </button>
          <button className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

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
          onClick={() => setSelectedTab('channels')}
          className={`h-12 text-base font-medium border-b-2 transition-colors focus:outline-none ${
            selectedTab === 'channels'
              ? 'text-yellow-500 border-yellow-500'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          Channels
        </button>
        <button
          onClick={() => setSelectedTab('movies')}
          className={`h-12 text-base font-medium border-b-2 transition-colors focus:outline-none ${
            selectedTab === 'movies'
              ? 'text-yellow-500 border-yellow-500'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          Movies
        </button>
        <button
          onClick={() => setSelectedTab('series')}
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
              onClick={() => handleCategoryClick(null)}
            />
            <CategoryListItem
              name="Favorites"
              count={0}
              starred
              onClick={() => {}}
            />
          </>
        )}

        {categories?.map(cat => (
          <CategoryListItem
            key={cat.id}
            name={cat.name}
            count={channelCounts?.get(cat.id) ?? 0}
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
  )
}

type CategoryListItemProps = {
  name: string
  count: number
  starred?: boolean
  onClick: () => void
  highlight?: boolean
}

function CategoryListItem({ name, count, starred, onClick, highlight }: CategoryListItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full h-14 px-4 flex items-center justify-between border-b border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 ${
        highlight || starred
          ? 'bg-slate-800 hover:bg-slate-750'
          : 'bg-slate-900 hover:bg-slate-800'
      }`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {starred && <Star size={16} className="text-yellow-500 flex-shrink-0 fill-yellow-500" />}
        <span className={`text-base truncate ${highlight || starred ? 'text-yellow-500' : 'text-white'}`}>
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
