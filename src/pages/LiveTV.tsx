import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
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
    <div className="flex flex-1 overflow-hidden">
      {sidebarVisible && (
        <>
          <CategorySidebar
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            sourceId={activeSource.id}
          />
          <button
            onClick={() => setSidebarVisible(false)}
            className="w-6 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex items-center justify-center hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            aria-label="Hide categories"
          >
            <ChevronLeft className="w-3 h-3 text-slate-500" />
          </button>
        </>
      )}

      {!sidebarVisible && (
        <button
          onClick={() => setSidebarVisible(true)}
          className="w-10 h-10 m-3 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
          aria-label="Show categories"
        >
          <span className="text-xs font-medium">CAT</span>
        </button>
      )}

      <ChannelGrid
        sourceId={activeSource.id}
        selectedCategoryId={selectedCategoryId}
        onChannelClick={handleChannelClick}
      />
    </div>
  )
}