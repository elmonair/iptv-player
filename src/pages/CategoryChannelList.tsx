import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, MoreVertical } from 'lucide-react'
import { useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { usePlaylistStore } from '../stores/playlistStore'
import { useBrowseStore } from '../stores/browseStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { TopNavBar } from '../components/TopNavBar'
import { getProxiedImageUrl } from '../lib/imageProxy'

const ROW_HEIGHT = 80

export default function CategoryChannelList() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const navigate = useNavigate()
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const activeSource = getActiveSource()
  const { enterPlayer, saveItems, setFocusedItem, selectCategory } = useBrowseStore()
  const parentRef = useRef<HTMLDivElement>(null)

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

  const handleChannelClick = useCallback((channelId: string) => {
    const catId = categoryId && categoryId !== '__all__' ? decodeURIComponent(categoryId) : null
    const channel = channels?.find((c) => c.id === channelId)
    if (channels) saveItems(channels, catId)
    enterPlayer(channelId)
    setFocusedItem(channelId)
    selectCategory(catId, categoryName ?? null)
    navigate(`/watch/live/${encodeURIComponent(channelId)}`, {
      state: { returnCategoryId: catId || '__all__', returnChannelId: channel?.id },
    })
  }, [categoryId, channels, categoryName, navigate, enterPlayer, saveItems, setFocusedItem, selectCategory])

  const virtualizer = useVirtualizer({
    count: channels?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

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

      {/* Channel List - Virtualized */}
      <div ref={parentRef} className="flex-1 min-h-0 overflow-y-auto">
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

        {channels && channels.length > 0 && (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const channel = channels[virtualRow.index]
              const logoSrc = channel.logoUrl ? getProxiedImageUrl(channel.logoUrl) : null
              return (
                <button
                  key={channel.id}
                  onClick={() => handleChannelClick(channel.id)}
                  className="w-full absolute left-0 px-4 flex items-center gap-4 bg-slate-900 hover:bg-slate-800 border-b border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt={channel.name}
                      className="w-14 h-14 rounded object-contain bg-slate-800 flex-shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded bg-slate-700 flex-shrink-0 flex items-center justify-center">
                      <span className="text-white text-lg font-bold">
                        {channel.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-base font-medium text-white truncate">{channel.name}</p>
                    <p className="text-sm text-slate-400">EPG not available</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
