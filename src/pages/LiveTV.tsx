import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { usePlaylistStore } from '../stores/playlistStore'
import CategorySidebar from '../components/live/CategorySidebar'
import ChannelGrid from '../components/live/ChannelGrid'
import type { ChannelRecord } from '../lib/db'

export default function LiveTV() {
  const navigate = useNavigate()
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const activeSource = getActiveSource()
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [sidebarVisible, setSidebarVisible] = useState(true)

  if (!activeSource) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">No playlist active. Add one from settings.</p>
      </div>
    )
  }

  const handleChannelClick = (channel: ChannelRecord) => {
    console.log('[LiveTV] Channel clicked, navigating to watch:', { name: channel.name, streamId: channel.streamId })
    navigate(`/watch/${encodeURIComponent(channel.id)}`)
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Categories panel — fixed width, always visible */}
      <div className="flex h-full">
        {sidebarVisible && (
          <CategorySidebar
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            sourceId={activeSource.id}
          />
        )}

        {/* Toggle button between sidebar and grid */}
        <button
          onClick={() => setSidebarVisible((v) => !v)}
          className="w-8 h-full flex-shrink-0 bg-slate-900 border-r border-slate-800 flex items-center justify-center hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          aria-label={sidebarVisible ? 'Hide categories' : 'Show categories'}
        >
          {sidebarVisible ? (
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
        </button>
      </div>

      {/* Channels panel — takes remaining width, independently scrollable */}
      <div className="flex-1 h-full overflow-hidden">
        <ChannelGrid
          sourceId={activeSource.id}
          selectedCategoryId={selectedCategoryId}
          onChannelClick={handleChannelClick}
        />
      </div>
    </div>
  )
}