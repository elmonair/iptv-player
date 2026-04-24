import { useState } from 'react'
import { Film } from 'lucide-react'
import type { MovieRecord } from '../../lib/db'

type Props = {
  movie: MovieRecord
  onClick: (movie: MovieRecord) => void
  cardWidth?: number
}

export default function MovieCard({ movie, onClick, cardWidth = 200 }: Props) {
  const [imageError, setImageError] = useState(false)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(movie)
    }
  }

  const posterHeight = cardWidth < 180 ? 'h-48' : 'h-56'

  return (
    <button
      role="button"
      tabIndex={0}
      onClick={() => onClick(movie)}
      onKeyDown={handleKeyDown}
      className="group w-full bg-slate-900 rounded-lg border border-slate-800 hover:border-indigo-500 transition-all duration-150 hover:scale-105 focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-slate-950 active:scale-100 text-left overflow-hidden"
    >
      {/* Poster area */}
      <div className={`${posterHeight} bg-slate-800 flex items-center justify-center relative`}>
        {movie.logoUrl && !imageError ? (
          <img
            src={movie.logoUrl}
            alt={movie.name}
            loading="lazy"
            onError={() => {
              console.log('[MovieCard] Image failed for:', movie.name, 'URL:', movie.logoUrl)
              setImageError(true)
            }}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-4">
            <Film size={40} className="text-slate-600 mb-2" />
            <p className="text-slate-400 text-xs text-center line-clamp-3">{movie.name}</p>
          </div>
        )}
        {movie.rating && movie.rating > 0 && (
          <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded">
            {movie.rating.toFixed(1)}
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
          <p className="text-white text-xs font-medium line-clamp-1">{movie.name}</p>
        </div>
      </div>
    </button>
  )
}