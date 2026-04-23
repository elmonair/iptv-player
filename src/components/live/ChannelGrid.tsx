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

const CARD_HEIGHT = 160
const GAP = 16

function getColumnsForWidth(width: number): number {
  if (width < 640) return 1      // mobile
  if (width < 768) return 2      // small tablet
  if (width < 1024) return 3     // tablet
  if (width < 1280) return 4     // desktop
  if (width < 1536) return 4     // large desktop
  return 5                        // TV
}

function getCardWidth(containerWidth: number, columns: number): number {
  const availableWidth = containerWidth - (GAP * (columns - 1))
  return Math.floor(availableWidth / columns)
}

export default function ChannelGrid({ sourceId, selectedCategoryId, onChannelClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const [columns, setColumns] = useState(3)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        setContainerWidth(width)
        setColumns(getColumnsForWidth(width))
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

  const cardWidth = Math.max(140, getCardWidth(containerWidth, columns))
  const rowHeight = CARD_HEIGHT + GAP

  const rowCount = channels ? Math.ceil(channels.length / columns) : 0

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
        <p className="text-slate-400 text-base">Loading channels...</p>
      </div>
    )
  }

  if (channels.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400 text-base">
          {selectedCategoryId ? 'No channels in this category' : 'No channels in your catalog'}
        </p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
      <div style={{ height: totalHeight, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowStartIndex = virtualRow.index * columns
          const rowChannels = channels.slice(rowStartIndex, rowStartIndex + columns)

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
              className="flex gap-3 sm:gap-4"
            >
              {rowChannels.map((channel) => (
                <div key={channel.id} style={{ width: cardWidth, flexShrink: 0 }}>
                  <ChannelCard channel={channel} onClick={onChannelClick} cardWidth={cardWidth} />
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}