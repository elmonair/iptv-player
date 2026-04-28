import { useRef, useMemo, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ChannelRecord } from '../../lib/db'
import ChannelCard from './ChannelCard'

type Props = {
  channels: ChannelRecord[]
  favoriteIds: Set<string>
  onToggleFavorite: (channelId: string) => void
  onItemClick: (channel: ChannelRecord) => void
  estimateHeight?: number
}

export default function VirtualChannelGrid({
  channels,
  favoriteIds,
  onToggleFavorite,
  onItemClick,
  estimateHeight = 140,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null)

  // Calculate columns based on container width
  const getColumns = (width: number) => {
    if (width >= 1536) return 6  // 2xl
    if (width >= 1280) return 5  // xl
    if (width >= 768) return 4   // md
    if (width >= 640) return 3   // sm
    return 2
  }

  const columns = parentRef.current ? getColumns(parentRef.current.offsetWidth) : 4
  const rows = useMemo(() => {
    const result: ChannelRecord[][] = []
    for (let i = 0; i < channels.length; i += columns) {
      result.push(channels.slice(i, i + columns))
    }
    return result
  }, [channels, columns])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateHeight,
    overscan: 5,
  })

  const handleToggle = useCallback((channelId: string) => {
    onToggleFavorite(channelId)
  }, [onToggleFavorite])

  const handleClick = useCallback((channel: ChannelRecord) => {
    onItemClick(channel)
  }, [onItemClick])

  return (
    <div ref={parentRef} className="h-full overflow-y-auto" style={{ contain: 'strict' }}>
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index]
          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap: '0.75rem',
                padding: '0 0.25rem',
              }}
            >
              {row.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  isFavorite={favoriteIds.has(channel.id)}
                  onToggleFavorite={handleToggle}
                  onClick={handleClick}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
