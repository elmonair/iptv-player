import { useState } from 'react'
import { Film, Heart } from 'lucide-react'
import { usePlaylistStore } from '../../stores/playlistStore'
import { formatRating } from '../../lib/metadata'
import { useFavoritesStore } from '../../stores/favoritesStore'
import type { MovieRecord } from '../../lib/db'

type Props = {
  movie: MovieRecord
  onClick: (movie: MovieRecord) => void
}

export default function MovieCard({ movie, onClick }: Props) {
  const [imageError, setImageError] = useState(false)
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite)
  const isFavorite = useFavoritesStore((state) => state.isFavorite)
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(movie)
    }
  }

  const rating = formatRating(movie.rating)
  const activeSource = getActiveSource()
  const favorite = activeSource ? isFavorite('movie', movie.id) : false

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (activeSource) {
      toggleFavorite('movie', movie.id, activeSource.id)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(movie)}
      onKeyDown={handleKeyDown}
      className="group relative w-full rounded-xl overflow-hidden bg-slate-800 border border-slate-700/60 hover:border-violet-500 transition-all duration-200 hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-900 active:scale-[1.01] text-left"
    >
      {/* Poster area with aspect-[2/3] */}
      <div className="aspect-[2/3] bg-slate-900 flex items-center justify-center relative">
        {movie.logoUrl && !imageError ? (
          <img
            src={movie.logoUrl}
            alt={movie.name || 'Movie'}
            loading="lazy"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <Film size={36} className="text-slate-600 mb-2" />
            <p className="text-slate-400 text-xs text-center px-4 line-clamp-3 font-medium">
              {movie.name || 'Untitled'}
            </p>
          </div>
        )}

        {/* Favorite button - top left */}
        <button
          onClick={handleFavoriteClick}
          className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-black/50 hover:bg-black/70 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 backdrop-blur-sm"
          aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${favorite ? 'text-red-500 fill-red-500' : 'text-white'}`} />
        </button>

        {/* Rating badge - top right */}
        {rating && rating !== 'N/A' && (
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-yellow-500 text-black text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded shadow-lg">
            {rating}
          </div>
        )}

        {/* Bottom gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/70 to-transparent pt-6 pb-2 px-2 sm:p-3">
          <p className="text-white text-xs sm:text-sm font-semibold line-clamp-2 leading-tight">
            {movie.name || 'Untitled'}
          </p>
          {movie.year && (
            <p className="text-slate-300 text-[10px] sm:text-xs mt-0.5 sm:mt-1">{movie.year}</p>
          )}
        </div>
      </div>
    </div>
  )
}
