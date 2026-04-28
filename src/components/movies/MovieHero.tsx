import { useState } from 'react'
import { Play, Heart, ArrowLeft, Star, Calendar, Clock, Film } from 'lucide-react'
import { getProxiedImageUrl } from '../../lib/imageProxy'
import { formatRating } from '../../lib/metadata'
import type { MovieRecord } from '../../lib/db'

interface MovieHeroProps {
  movie: MovieRecord
  categoryName?: string
  onPlay: () => void
  onBack: () => void
}

export default function MovieHero({
  movie,
  categoryName,
  onPlay,
  onBack,
}: MovieHeroProps) {
  const [imageError, setImageError] = useState(false)
  const hasBackdrop = movie.logoUrl || movie.backdropUrl
  const posterUrl = movie.logoUrl

  const rating = formatRating(movie.rating)
  const duration = movie.durationSeconds
    ? `${Math.floor(movie.durationSeconds / 60)} min`
    : null

  return (
    <div className="relative">
      {/* Backdrop Background */}
      {hasBackdrop && !imageError && (
        <div className="absolute inset-0 z-0">
          <img
            src={getProxiedImageUrl(movie.backdropUrl) || getProxiedImageUrl(movie.logoUrl)}
            alt=""
            className="w-full h-full object-cover opacity-30 sm:opacity-100"
            onError={() => setImageError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/95 to-slate-900/70 sm:bg-gradient-to-t sm:from-slate-900 sm:via-slate-900/80 sm:to-slate-900/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent sm:via-slate-900/60" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 px-4 py-3 sm:p-6 lg:p-8">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 min-h-[40px] sm:min-h-[44px] mb-3 sm:mb-4"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Main layout: Mobile horizontal, Desktop vertical stack then row */}
        <div className="flex flex-row sm:flex-col md:flex-row gap-3 sm:gap-4 md:gap-6">
          {/* Poster */}
          <div className="flex-shrink-0">
            <div className="w-[105px] h-[155px] sm:w-[130px] sm:h-[195px] md:w-[220px] md:h-[330px] rounded-lg sm:rounded-xl overflow-hidden shadow-lg sm:shadow-xl border border-slate-700 bg-slate-800">
              {posterUrl && !imageError ? (
                <img
                  src={getProxiedImageUrl(posterUrl)}
                  alt={movie.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                  <Film size={36} className="text-slate-600 mb-2" />
                  <span className="text-2xl sm:text-4xl md:text-6xl font-bold text-slate-600">
                    {movie.name?.charAt(0) || 'M'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col justify-start sm:justify-end">
            <div dir="auto" className="text-left">
              {/* Title */}
              <h1 className="text-lg sm:text-2xl md:text-4xl font-bold text-white mb-1 sm:mb-2 leading-tight">
                {movie.name || 'Untitled'}
              </h1>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 md:gap-4 text-xs sm:text-sm text-slate-300 mb-2">
                {rating && rating !== 'N/A' && (
                  <span className="flex items-center gap-0.5 sm:gap-1 bg-slate-800/80 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                    <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 fill-yellow-500" />
                    <span>{rating}</span>
                  </span>
                )}
                {movie.year && (
                  <span className="flex items-center gap-0.5 sm:gap-1 text-slate-400">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                    {movie.year}
                  </span>
                )}
                {duration && (
                  <span className="flex items-center gap-0.5 sm:gap-1 text-slate-400">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                    {duration}
                  </span>
                )}
              </div>

              {/* Genre */}
              {movie.genre && (
                <p className="text-slate-400 text-xs sm:text-sm mb-2 line-clamp-1">{movie.genre}</p>
              )}

              {/* Category */}
              {categoryName && (
                <p className="text-slate-500 text-xs sm:text-sm mb-2">{categoryName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {movie.plot && (
          <div className="mt-3 sm:mt-4">
            <p dir="auto" className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              {movie.plot}
            </p>
          </div>
        )}

        {/* Cast */}
        {movie.cast && (
          <div className="mt-2 sm:mt-4">
            <span className="text-slate-500 text-xs">Cast: </span>
            <span className="text-slate-400 text-xs line-clamp-2">{movie.cast}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 mt-4 sm:mt-6">
          <button
            onClick={onPlay}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 min-h-[44px] sm:min-h-[48px] text-sm sm:text-base"
          >
            <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            <span>Play Movie</span>
          </button>
          <button
            onClick={() => {}}
            className="flex-shrink-0 w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-3 flex items-center justify-center bg-slate-700/80 hover:bg-slate-600 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            aria-label="Add to favorites"
          >
            <Heart className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
