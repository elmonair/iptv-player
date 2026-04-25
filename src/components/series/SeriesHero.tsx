import { useState } from 'react'
import { Play, Heart, ArrowLeft, Star, Calendar, Clock } from 'lucide-react'
import { formatRating } from '../../lib/metadata'
import type { XtreamSeriesInfo } from '../../lib/xtreamTypes'

interface SeriesHeroProps {
  info: XtreamSeriesInfo['info']
  categoryName?: string
  seasonCount: number
  episodeCount: number
  onPlayFirst: () => void
  onBack: () => void
}

export default function SeriesHero({
  info,
  categoryName,
  seasonCount,
  episodeCount,
  onPlayFirst,
  onBack,
}: SeriesHeroProps) {
  const [showFullDescription, setShowFullDescription] = useState(false)
  const rating = formatRating(info.rating)
  const hasBackdrop = info.backdrop_path
  const posterUrl = info.cover || info.backdrop_path

  return (
    <div className="relative">
      {/* Backdrop Background - darker on mobile */}
      {hasBackdrop && (
        <div className="absolute inset-0 z-0">
          <img
            src={hasBackdrop}
            alt=""
            className="w-full h-full object-cover opacity-30 sm:opacity-100"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/95 to-slate-900/70 sm:bg-gradient-to-t sm:from-slate-900 sm:via-slate-900/80 sm:to-slate-900/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent sm:via-slate-900/60" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 px-4 py-3 sm:p-6 lg:p-8">
        {/* Back button - more compact on mobile */}
        <button
          onClick={onBack}
          className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 min-h-[40px] sm:min-h-[44px] mb-3 sm:mb-4"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Mobile: Compact horizontal layout, Desktop: Vertical stack */}
        <div className="flex flex-row sm:flex-col md:flex-row gap-3 sm:gap-4 md:gap-6">
          {/* Poster - smaller on mobile */}
          <div className="flex-shrink-0">
            <div className="w-[105px] h-[155px] sm:w-[130px] sm:h-[195px] md:w-[220px] md:h-[330px] rounded-lg sm:rounded-xl overflow-hidden shadow-lg sm:shadow-xl border border-slate-700 bg-slate-800">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={info.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-800">
                  <span className="text-2xl sm:text-4xl md:text-6xl font-bold text-slate-600">
                    {info.name?.charAt(0) || 'S'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Info - compact on mobile */}
          <div className="flex-1 min-w-0 flex flex-col justify-start sm:justify-end">
            <div dir="auto" className="text-left">
              {/* Title - slightly smaller on mobile */}
              <h1 className="text-lg sm:text-2xl md:text-4xl font-bold text-white mb-1 sm:mb-2 leading-tight">
                {info.name}
              </h1>

              {/* Meta row - tighter on mobile */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 md:gap-4 text-xs sm:text-sm text-slate-300 mb-2">
                {rating && (
                  <span className="flex items-center gap-0.5 sm:gap-1 bg-slate-800/80 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                    <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 fill-yellow-500" />
                    <span>{rating}</span>
                  </span>
                )}
                {info.releaseDate && (
                  <span className="flex items-center gap-0.5 sm:gap-1 text-slate-400">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                    {info.releaseDate}
                  </span>
                )}
                {info.episode_run_time && (
                  <span className="flex items-center gap-0.5 sm:gap-1 text-slate-400 hidden sm:flex">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                    {info.episode_run_time}
                  </span>
                )}
              </div>

              {/* Genre - smaller on mobile */}
              {info.genre && (
                <p className="text-slate-400 text-xs sm:text-sm mb-2 line-clamp-1">{info.genre}</p>
              )}

              {/* Seasons/Episodes count */}
              <p className="text-slate-400 text-xs sm:text-sm mb-2 sm:mb-4">
                {seasonCount} {seasonCount === 1 ? 'Season' : 'Seasons'} • {episodeCount} {episodeCount === 1 ? 'Episode' : 'Episodes'}
              </p>

              {/* Category - mobile only */}
              {categoryName && (
                <p className="text-slate-500 text-xs mb-2 sm:hidden">{categoryName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Description - full width below poster row on mobile */}
        {info.plot && (
          <div className="mt-3 sm:mt-4">
            <p 
              dir="auto" 
              className={`text-slate-300 text-xs sm:text-sm leading-relaxed ${showFullDescription ? '' : 'line-clamp-3'}`}
            >
              {info.plot}
            </p>
            {/* Show more/less toggle for long descriptions */}
            {info.plot.length > 150 && (
              <button
                onClick={() => setShowFullDescription(!showFullDescription)}
                className="mt-1 text-violet-400 text-xs hover:text-violet-300 transition-colors"
              >
                {showFullDescription ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Cast - mobile optimized */}
        {info.cast && (
          <div className="mt-2 sm:mt-4">
            <span className="text-slate-500 text-xs">Cast: </span>
            <span className="text-slate-400 text-xs line-clamp-2">{info.cast}</span>
          </div>
        )}

        {/* Action Buttons - mobile optimized layout */}
        <div className="flex items-center gap-2 sm:gap-3 mt-4 sm:mt-6">
          <button
            onClick={onPlayFirst}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 min-h-[44px] sm:min-h-[48px] text-sm sm:text-base"
          >
            <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            <span>Play First</span>
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