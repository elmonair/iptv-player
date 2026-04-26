import { useState } from 'react'
import { Monitor, Heart } from 'lucide-react'
import { usePlaylistStore } from '../../stores/playlistStore'
import { formatRating } from '../../lib/metadata'
import { useFavoritesStore } from '../../stores/favoritesStore'
import type { SeriesRecord } from '../../lib/db'

type Props = {
  series: SeriesRecord
  onClick: (series: SeriesRecord) => void
}

export default function SeriesCard({ series, onClick }: Props) {
  const [imageError, setImageError] = useState(false)
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite)
  const isFavorite = useFavoritesStore((state) => state.isFavorite)
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(series)
    }
  }

  if (!series) {
    return null
  }

  const name = series.name || 'Untitled'
  const logoUrl = series.logoUrl
  const backdropUrl = series.backdropUrl
  const genre = series.genre
  const rating = formatRating(series.rating)
  const activeSource = getActiveSource()
  const favorite = activeSource ? isFavorite('series', series.id) : false

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (activeSource) {
      toggleFavorite('series', series.id, activeSource.id)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(series)}
      onKeyDown={handleKeyDown}
      className="group relative w-full rounded-xl overflow-hidden bg-slate-800 border border-slate-700/60 hover:border-violet-500 transition-all duration-200 hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-900 active:scale-[1.01] text-left"
    >
      {/* Poster area with aspect-[2/3] */}
      <div className="aspect-[2/3] bg-slate-900 flex items-center justify-center relative">
        {!imageError && logoUrl ? (
          <img
            src={logoUrl}
            alt={name}
            loading="lazy"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : !imageError && backdropUrl ? (
          <img
            src={backdropUrl}
            alt={name}
            loading="lazy"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <Monitor size={36} className="text-slate-600 mb-2" />
            <p className="text-slate-400 text-xs text-center px-4 line-clamp-3 font-medium">
              {name}
            </p>
          </div>
        )}

        {/* Favorite button - top left */}
        <button
          onClick={handleFavoriteClick}
          className="absolute top-2 left-2 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/70 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 backdrop-blur-sm"
          aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={`w-4 h-4 transition-colors ${favorite ? 'text-red-500 fill-red-500' : 'text-white'}`} />
        </button>

        {/* Rating badge - top right */}
        {rating && rating !== 'N/A' && (
          <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded shadow-lg">
            {rating}
          </div>
        )}

        {/* Bottom gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3">
          <p className="text-white text-sm font-semibold line-clamp-2 leading-tight">
            {name}
          </p>
          {genre && (
            <p className="text-slate-400 text-xs mt-1 truncate">{genre}</p>
          )}
        </div>
      </div>
    </div>
  )
}