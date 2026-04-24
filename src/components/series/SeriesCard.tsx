import { useState } from 'react'
import type { SeriesRecord } from '../../lib/db'

type Props = {
  series: SeriesRecord
  onClick: (series: SeriesRecord) => void
  cardWidth?: number
}

export default function SeriesCard({ series, onClick, cardWidth = 200 }: Props) {
  const [imageError, setImageError] = useState(false)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(series)
    }
  }

  const initial = series.name.trim().charAt(0).toUpperCase()
  const posterHeight = cardWidth < 180 ? 'h-40' : 'h-48'

  return (
    <button
      role="button"
      tabIndex={0}
      onClick={() => onClick(series)}
      onKeyDown={handleKeyDown}
      className="group w-full bg-slate-900 rounded-lg border border-slate-800 hover:border-indigo-500 transition-all duration-150 hover:scale-105 focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-slate-950 active:scale-100 text-left overflow-hidden"
    >
      {/* Poster/backdrop area */}
      <div className={`${posterHeight} bg-slate-950 flex items-center justify-center relative`}>
        {!imageError && series.backdropUrl ? (
          <img
            src={series.backdropUrl}
            alt={series.name}
            loading="lazy"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : !imageError && series.logoUrl ? (
          <img
            src={series.logoUrl}
            alt={series.name}
            loading="lazy"
            onError={() => setImageError(true)}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">{initial}</span>
          </div>
        )}
        {series.rating && Number(series.rating) > 0 && (
          <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded">
            {Number(series.rating).toFixed(1)}
          </div>
        )}
      </div>

      {/* Info area */}
      <div className="p-3">
        <p className="text-white text-sm font-medium leading-tight line-clamp-2" title={series.name}>
          {series.name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {series.year && (
            <span className="text-slate-400 text-xs">{series.year}</span>
          )}
          {series.genre && (
            <>
              <span className="text-slate-600 text-xs">•</span>
              <span className="text-slate-400 text-xs truncate">{series.genre}</span>
            </>
          )}
        </div>
        {series.plot && (
          <p className="text-slate-500 text-xs mt-2 line-clamp-2">{series.plot}</p>
        )}
      </div>
    </button>
  )
}