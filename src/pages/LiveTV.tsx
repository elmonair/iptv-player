import { useState } from 'react'
import { usePlaylistStore } from '../stores/playlistStore'
import CategorySidebar from '../components/live/CategorySidebar'
import ChannelGrid from '../components/live/ChannelGrid'
import type { ChannelRecord } from '../lib/db'

export default function LiveTV() {
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const activeSource = getActiveSource()
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  if (!activeSource) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">No playlist active. Add one from settings.</p>
      </div>
    )
  }

  const handleChannelClick = (channel: ChannelRecord) => {
    console.log('[LiveTV] Channel clicked:', { name: channel.name, streamId: channel.streamId })
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <CategorySidebar
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
        sourceId={activeSource.id}
      />
      <ChannelGrid
        sourceId={activeSource.id}
        selectedCategoryId={selectedCategoryId}
        onChannelClick={handleChannelClick}
      />
    </div>
  )
}