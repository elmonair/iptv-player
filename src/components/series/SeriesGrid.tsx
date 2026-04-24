import { useRef, useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useVirtualizer } from '@tanstack/react-virtual'
import { db } from '../../lib/db'
import SeriesCard from './SeriesCard'
import type { SeriesRecord } from '../../lib/db'

type Props = {
  sourceId: string
  selectedCategoryId: string | null
  onSeriesClick: (series: SeriesRecord) => void
}

const CARD_HEIGHT = 300
const GAP = 16

function getColumnsForWidth(width: number): number {
  if (width < 640) return 2
  if (width < 768) return 3
  if (width < 1024) return 4
  if (width < 1280) return 5
  if (width < 1536) return 5
  return 6
}

function getCardWidth(containerWidth: number, columns: number): number {
  const availableWidth = containerWidth - (GAP * (columns - 1))
  return Math.floor(availableWidth / columns)
}

export default function SeriesGrid({ sourceId, selectedCategoryId, onSeriesClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const [columns, setColumns] = useState(4)

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

  const seriesList = useLiveQuery(
    async () => {
      let query
      if (selectedCategoryId) {
        query = db.series.where('categoryId').equals(selectedCategoryId).toArray()
      } else {
        query = db.series.where('sourceId').equals(sourceId).toArray()
      }
      const result = await query
      return result.sort((a, b) => a.name.localeCompare(b.name))
    },
    [sourceId, selectedCategoryId],
  )

  const cardWidth = Math.max(140, getCardWidth(containerWidth, columns))
  const rowHeight = CARD_HEIGHT + GAP

  const rowCount = seriesList ? Math.ceil(seriesList.length / columns) : 0

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
  })

  const totalHeight = virtualizer.getTotalSize()

  if (seriesList === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400 text-base">Loading series...</p>
      </div>
    )
  }

  if (seriesList.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400 text-base">
          {selectedCategoryId ? 'No series in this category' : 'No series in your catalog'}
        </p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex-1 p-3 sm:p-4 md:p-6 lg:overflow-y-auto lg:max-h-[calc(100vh-200px)] lg:min-h-0">
      <div style={{ height: totalHeight, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowStartIndex = virtualRow.index * columns
          const rowSeries = seriesList.slice(rowStartIndex, rowStartIndex + columns)

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
              {rowSeries.map((series) => (
                <div key={series.id} style={{ width: cardWidth, flexShrink: 0 }}>
                  <SeriesCard series={series} onClick={onSeriesClick} cardWidth={cardWidth} />
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}