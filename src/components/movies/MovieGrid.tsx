import { useRef, useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowLeft } from 'lucide-react'
import { db } from '../../lib/db'
import MovieCard from './MovieCard'
import type { MovieRecord } from '../../lib/db'

type Props = {
  sourceId: string
  selectedCategoryId: string | null
  onMovieClick: (movie: MovieRecord) => void
  onBackToCategories: () => void
  categoryName?: string
}

const GAP = 12

function getColumnsForWidth(width: number): number {
  if (width < 480) return 2
  if (width < 640) return 3
  if (width < 900) return 4
  if (width < 1200) return 5
  if (width < 1500) return 6
  return 7
}

function getCardWidth(containerWidth: number, columns: number): number {
  const availableWidth = containerWidth - GAP * (columns - 1)
  return Math.floor(availableWidth / columns)
}

function MovieSkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden bg-slate-800 border border-slate-700/60 animate-pulse">
      <div className="aspect-[2/3] bg-slate-700" />
    </div>
  )
}

export default function MovieGrid({ sourceId, selectedCategoryId, onMovieClick, onBackToCategories, categoryName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const [columns, setColumns] = useState(5)

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

  const movies = useLiveQuery(
    async () => {
      let query
      if (selectedCategoryId) {
        query = db.movies.where('categoryId').equals(selectedCategoryId).toArray()
      } else {
        query = db.movies.where('sourceId').equals(sourceId).toArray()
      }
      const result = await query
      return result
    },
    [sourceId, selectedCategoryId],
  )

  const cardWidth = Math.max(120, getCardWidth(containerWidth, columns))
  const cardHeight = Math.floor(cardWidth / (2 / 3))
  const rowHeight = cardHeight + GAP

  const rowCount = movies ? Math.ceil(movies.length / columns) : 0

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
  })

  const totalHeight = virtualizer.getTotalSize()

  if (movies === undefined) {
    return (
      <div className="flex-1 p-3 sm:p-4 md:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <MovieSkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (movies.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <p className="text-slate-300 text-lg font-medium mb-2">No movies found</p>
        <p className="text-slate-500 text-sm mb-6">
          {selectedCategoryId
            ? `No movies in "${categoryName || 'this category'}"`
            : 'Your catalog is empty'}
        </p>
        <button
          onClick={onBackToCategories}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to categories</span>
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={containerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
        <div style={{ height: totalHeight, position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const rowStartIndex = virtualRow.index * columns
            const rowMovies = movies.slice(rowStartIndex, rowStartIndex + columns)

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
                className="flex gap-3"
              >
                {rowMovies.map((movie) => (
                  <div key={movie.id} style={{ width: cardWidth, flexShrink: 0 }}>
                    <MovieCard movie={movie} onClick={onMovieClick} />
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}