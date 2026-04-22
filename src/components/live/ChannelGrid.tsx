import { useRef, useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useVirtualizer } from '@tanstack/react-virtual'
import { db } from '../../lib/db'
import ChannelCard from './ChannelCard'
import type { ChannelRecord } from '../../lib/db'

type Props = {
  sourceId: string
  selectedCategoryId: string | null
  onChannelClick: (channel: ChannelRecord) => void
}

const CARD_WIDTH = 180
const CARD_HEIGHT = 160
const GAP = 16

export default function ChannelGrid({ sourceId, selectedCategoryId, onChannelClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const channels = useLiveQuery(
    async () => {
      let query
      if (selectedCategoryId) {
        query = db.channels.where('categoryId').equals(selectedCategoryId).toArray()
      } else {
        query = db.channels.where('sourceId').equals(sourceId).toArray()
      }
      const result = await query
      return result.sort((a, b) => a.name.localeCompare(b.name))
    },
    [sourceId, selectedCategoryId],
  )

  const columnsCount = Math.max(1, Math.floor((containerWidth + GAP) / (CARD_WIDTH + GAP)))
  const rowHeight = CARD_HEIGHT + GAP

  const rowCount = channels ? Math.ceil(channels.length / columnsCount) : 0

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
  })

  const totalHeight = virtualizer.getTotalSize()

  if (channels === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400">Loading channels...</p>
      </div>
    )
  }

  if (channels.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400">
          {selectedCategoryId ? 'No channels in this category' : 'No channels in your catalog'}
        </p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
      <div style={{ height: totalHeight, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowStartIndex = virtualRow.index * columnsCount
          const rowChannels = channels.slice(rowStartIndex, rowStartIndex + columnsCount)

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="flex gap-4"
            >
              {rowChannels.map((channel) => (
                <div key={channel.id} style={{ width: CARD_WIDTH, flexShrink: 0 }}>
                  <ChannelCard channel={channel} onClick={onChannelClick} />
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}