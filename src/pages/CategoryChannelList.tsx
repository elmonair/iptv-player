import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, MoreVertical } from 'lucide-react'
import { usePlaylistStore } from '../stores/playlistStore'
import { useBrowseStore } from '../stores/browseStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { TopNavBar } from '../components/TopNavBar'

export default function CategoryChannelList() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const navigate = useNavigate()
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const activeSource = getActiveSource()
  const { enterPlayer, saveItems, setFocusedItem, selectCategory } = useBrowseStore()

  const categoryName = useLiveQuery(
    async () => {
      if (!activeSource || !categoryId || categoryId === '__all__') return 'All Channels'
      const cat = await db.categories.where('id').equals(decodeURIComponent(categoryId)).first()
      return cat?.name ?? 'Unknown'
    },
    [activeSource, categoryId],
  )

  const channels = useLiveQuery(
    async () => {
      if (!activeSource) return []
      let query
      if (categoryId && categoryId !== '__all__') {
        const catId = decodeURIComponent(categoryId)
        query = db.channels.where('categoryId').equals(catId).toArray()
      } else {
        query = db.channels.where('sourceId').equals(activeSource.id).toArray()
      }
      const result = await query
      return result.sort((a, b) => a.name.localeCompare(b.name))
    },
    [activeSource, categoryId],
  )

  const handleChannelClick = (channelId: string) => {
    const catId = categoryId && categoryId !== '__all__' ? decodeURIComponent(categoryId) : null
    const channel = channels?.find((c) => c.id === channelId)
    if (channels) saveItems(channels)
    enterPlayer(channelId)
    setFocusedItem(channelId)
    selectCategory(catId, categoryName ?? null)
    navigate(`/watch/${encodeURIComponent(channelId)}`, {
      state: { returnCategoryId: catId || '__all__', returnChannelId: channel?.id },
    })
  }

  return (
    <div className="h-[100dvh] bg-slate-900 flex flex-col overflow-hidden">
      <TopNavBar />

      {/* Header */}
      <header className="h-14 flex-shrink-0 bg-slate-900 border-b border-slate-700 flex items-center px-2">
        <button
          onClick={() => navigate('/live')}
          className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="flex-1 text-center text-base font-medium text-white truncate px-2">
          {categoryName ?? 'Loading...'}
        </h1>
        <div className="flex items-center gap-1">
          <button className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
            <Search size={20} />
          </button>
          <button className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      {/* Channel List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {channels === undefined && (
          <div className="flex items-center justify-center h-32">
            <p className="text-slate-400">Loading channels...</p>
          </div>
        )}

        {channels && channels.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <p className="text-slate-400">No channels in this category</p>
          </div>
        )}

        {channels?.map(channel => (
          <button
            key={channel.id}
            onClick={() => handleChannelClick(channel.id)}
            className="w-full h-20 px-4 flex items-center gap-4 bg-slate-900 hover:bg-slate-800 border-b border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50"
          >
            {channel.logoUrl ? (
              <img
                src={channel.logoUrl}
                alt={channel.name}
                className="w-14 h-14 rounded object-contain bg-slate-800 flex-shrink-0"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const fallback = target.nextElementSibling as HTMLDivElement
                  if (fallback) fallback.style.display = 'flex'
                }}
              />
            ) : null}
            <div
              className={`w-14 h-14 rounded bg-slate-700 flex-shrink-0 items-center justify-center ${
                channel.logoUrl ? 'hidden' : 'flex'
              }`}
            >
              <span className="text-white text-lg font-bold">
                {channel.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-base font-medium text-white truncate">{channel.name}</p>
              <p className="text-sm text-slate-400">EPG not available</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
