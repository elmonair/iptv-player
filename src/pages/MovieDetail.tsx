import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Loader2, Film, Star, Calendar, Clock, Globe, Play, Heart, ChevronLeft, Info } from 'lucide-react'
import { usePlaylistStore } from '../stores/playlistStore'
import { useBrowseStore } from '../stores/browseStore'
import { useFavoritesStore } from '../stores/favoritesStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { TopNavBar } from '../components/TopNavBar'
import MovieCard from '../components/movies/MovieCard'
import type { MovieRecord } from '../lib/db'
import { parseTitle, getCleanTitleForComparison, formatRating, formatYear, formatDuration, formatReleaseDate } from '../lib/metadata'
import { getVodInfo } from '../lib/xtream'
import type { XtreamVodInfo } from '../lib/xtreamTypes'

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-white truncate" title={value}>{value}</p>
    </div>
  )
}

export default function MovieDetail() {
  const { movieId } = useParams<{ movieId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const activeSource = getActiveSource()
  const browseMovies = useBrowseStore((state) => state.state.movies)
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite)
  const isFavorite = useFavoritesStore((state) => state.isFavorite)

  const [loading, setLoading] = useState(true)
  const [imageError, setImageError] = useState(false)
  const [vodInfo, setVodInfo] = useState<XtreamVodInfo | null>(null)

  const movie = useLiveQuery(
    async () => {
      if (!movieId || !activeSource) return null
      const matches = await db.movies
        .where('sourceId')
        .equals(activeSource.id)
        .toArray()

      return matches.find(m =>
        String(m.externalId) === String(movieId) ||
        String(m.id) === String(movieId)
      ) || null
    },
    [movieId, activeSource?.id],
  )

  const categoryName = useLiveQuery(
    async () => {
      if (!movie?.categoryId) return ''
      const cat = await db.categories.where('id').equals(movie.categoryId).first()
      return cat?.name || ''
    },
    [movie?.categoryId],
  )

  const relatedMovies = useLiveQuery(
    async () => {
      if (!movie?.categoryId || !activeSource) return []
      return db.movies
        .where('categoryId')
        .equals(movie.categoryId)
        .and(m => m.sourceId === activeSource.id && m.id !== movie.id)
        .limit(16)
        .toArray()
    },
    [movie?.categoryId, movie?.id, activeSource?.id],
  )

  const parsedMetadata = useMemo(() => movie ? parseTitle(movie.name) : null, [movie?.name])

  const similarVersions = useMemo(() => {
    if (!movie || !relatedMovies) return []
    const currentClean = getCleanTitleForComparison(movie.name)
    return relatedMovies.filter(m => {
      const otherClean = getCleanTitleForComparison(m.name)
      return otherClean === currentClean && m.id !== movie.id
    })
  }, [movie, relatedMovies])

  const duration = useMemo(() => formatDuration(movie?.durationSeconds), [movie?.durationSeconds])

  useEffect(() => { if (movie !== undefined) setLoading(false) }, [movie])

  useEffect(() => {
    async function fetchVodMetadata() {
      if (!movie || !activeSource) return
      if (activeSource.type !== 'xtream') {
        console.log('[MovieDetail] Not an Xtream source, skipping metadata fetch')
        return
      }

      const movieId = movie.id
      console.log('[MovieDetail] Selected movie object:', movie)
      console.log('[MovieDetail] Route/movie ID:', movieId)

      const vodIdMatch = movieId.match(/movie-(\d+)/)
      if (!vodIdMatch) {
        console.log('[MovieDetail] Could not extract VOD ID from:', movieId)
        return
      }

      const vodId = vodIdMatch[1]
      console.log('[MovieDetail] Extracted VOD ID:', vodId)

      try {
        const apiUrl = `${activeSource.serverUrl}/player_api.php?action=get_vod_info&vod_id=${vodId}`
        console.log('[MovieDetail] Calling get_vod_info API:', apiUrl.replace(/password=[^&]+/, 'password=***'))

        const response = await getVodInfo(activeSource.serverUrl, { username: activeSource.username, password: activeSource.password }, vodId)
        console.log('[MovieDetail] Raw get_vod_info response:', response)

        if (!response || !response.info) {
          console.log('[MovieDetail] Provider did not return movie metadata for vod_id:', vodId)
          return
        }

        const info = response.info
        console.log('[MovieDetail] Extracted fields:')
        console.log('  - plot:', info.plot)
        console.log('  - description:', info.description)
        console.log('  - genre:', info.genre)
        console.log('  - cast:', info.cast)
        console.log('  - director:', info.director)
        console.log('  - duration:', info.duration)
        console.log('  - releasedate:', info.releasedate)
        console.log('  - backdrop_path:', info.backdrop_path)
        console.log('  - movie_image:', info.movie_image)

        setVodInfo(response)
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        console.error('[MovieDetail] Error fetching VOD info:', error)
      }
    }

    fetchVodMetadata()
  }, [movie, activeSource])

  const handleBack = () => {
    const categoryId = browseMovies.selectedCategoryId
    navigate(categoryId ? `/live?tab=movies&category=${encodeURIComponent(categoryId)}` : '/live?tab=movies', { replace: true })
  }

  const handlePlay = () => {
    if (!movie) return

    const from = location.pathname + location.search
    const categoryId = browseMovies.selectedCategoryId
    const realDuration = Number(vodInfo?.info?.duration_secs) || 0

    console.log('[MovieDetail] Open movie:', {
      current: from,
      movieId: movie.id,
      movieName: movie.name,
      realDuration,
      state: { from, tab: 'movies', categoryId, realDuration }
    })

    navigate(`/watch/movie/${encodeURIComponent(movie.id)}`, {
      state: {
        from,
        tab: 'movies',
        categoryId,
        scrollY: window.scrollY,
        realDuration,
        movieTitle: movie.name,
        containerExtension: movie.containerExtension,
      }
    })
  }

  const handleFavoriteClick = () => {
    if (!movie || !activeSource) return
    toggleFavorite('movie', movie.id, activeSource.id)
  }
  const handleMovieClick = (m: MovieRecord) => navigate(`/movie/${encodeURIComponent(m.id)}`, { replace: true })

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900">
        <TopNavBar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      </div>
    )
  }

  if (!movie || !parsedMetadata) {
    return (
      <div className="min-h-screen bg-slate-900">
        <TopNavBar />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] px-4">
          <Film className="w-16 h-16 text-slate-600 mb-4" />
          <p className="text-slate-400 text-center">Movie not found</p>
          <button onClick={handleBack} className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
            Back to Movies
          </button>
        </div>
      </div>
    )
  }

  const { cleanTitle, year, quality, language, provider } = parsedMetadata
  const displayYear = formatYear(vodInfo?.info?.releasedate || movie.year, year)
  const displayRating = formatRating(vodInfo?.info?.rating_5based || movie.rating)
  const hasBackdrop = vodInfo?.info?.backdrop_path || movie.backdropUrl || movie.logoUrl

  const overview = vodInfo?.info?.plot
    || (vodInfo?.info as any)?.description
    || vodInfo?.movie_data?.plot
    || (vodInfo?.movie_data as any)?.description
    || movie.plot
    || movie.description
    || ''
  const displayGenre = vodInfo?.info?.genre || movie.genre
  const displayCast = vodInfo?.info?.cast || movie.cast
  const displayDirector = vodInfo?.info?.director || movie.director
  const displayDuration = vodInfo?.info?.duration || duration
  const displayReleaseDate = formatReleaseDate(vodInfo?.info?.releasedate || movie.releaseDate)
  const betterBackdrop = vodInfo?.info?.backdrop_path || null
  const betterPoster = vodInfo?.info?.movie_image || null

  return (
    <div className="min-h-screen bg-slate-900">
      <TopNavBar />

      {/* Hero Section with Backdrop */}
      <div className="relative">
        {hasBackdrop && !imageError && (
          <div className="absolute inset-0 z-0">
            <img
              src={betterBackdrop || movie.backdropUrl || movie.logoUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/90 to-slate-900/60" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent" />
          </div>
        )}

        <div className="relative z-10">
          <div className="px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          </div>

          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            <div className="flex flex-col md:flex-row gap-5 md:gap-8">
              <div className="flex-shrink-0 mx-auto md:mx-0">
                <div className="w-[170px] sm:w-[190px] md:w-[210px] lg:w-[230px] aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border border-slate-700/50 bg-slate-800">
                  {betterPoster || movie.logoUrl ? (
                    <img src={betterPoster || movie.logoUrl} alt={cleanTitle} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                      <Film className="w-10 h-10 text-slate-600" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3 sm:mb-4 leading-[1.05] tracking-tight">
                  {cleanTitle}
                </h1>

                <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-5">
                  {displayRating && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded">
                      <Star className="w-3 h-3" />
                      {displayRating}
                    </span>
                  )}
                  {displayYear && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700/80 text-slate-300 text-xs font-medium rounded">
                      <Calendar className="w-3 h-3" />
                      {displayYear}
                    </span>
                  )}
                  {displayDuration && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700/80 text-slate-300 text-xs font-medium rounded">
                      <Clock className="w-3 h-3" />
                      {displayDuration}
                    </span>
                  )}
                  {quality && (
                    <span className="px-2 py-0.5 bg-violet-500/20 text-violet-300 text-xs font-medium rounded">{quality}</span>
                  )}
                  {language && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs font-medium rounded">
                      <Globe className="w-3 h-3" />
                      {language}
                    </span>
                  )}
                  {provider && (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs font-medium rounded">{provider}</span>
                  )}
                  {categoryName && (
                    <span className="px-2 py-0.5 bg-slate-700/80 text-slate-300 text-xs font-medium rounded truncate max-w-[120px]">{categoryName}</span>
                  )}
                </div>

                <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                  <button
                    onClick={handlePlay}
                    className="inline-flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-white text-slate-900 rounded-lg font-semibold text-sm hover:bg-slate-200 transition-colors min-h-[48px] focus:outline-none focus:ring-2 focus:ring-white/40"
                  >
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                    <span>Play</span>
                  </button>
                  <button
                    onClick={handleFavoriteClick}
                    className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                    aria-label={movie && activeSource && isFavorite('movie', movie.id) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors ${movie && activeSource && isFavorite('movie', movie.id) ? 'text-red-500 fill-red-500' : ''}`} />
                  </button>
                </div>

                <div className="max-w-3xl mb-4 sm:mb-6">
                  <h2 className="sr-only">Overview</h2>
                  {overview ? (
                    <p className="text-slate-200 text-sm sm:text-[15px] leading-7 sm:leading-8 line-clamp-4 sm:line-clamp-none">{overview}</p>
                  ) : (
                    <p className="text-slate-500 text-sm italic">No description is available from this playlist.</p>
                  )}
                </div>

                {displayCast && (
                  <div className="mb-4 sm:mb-5">
                    <span className="text-xs uppercase tracking-wide text-slate-500">Cast</span>
                    <p className="mt-1 text-sm text-slate-300 line-clamp-2">{displayCast}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                  {displayDirector && <span>Director: <span className="text-slate-400">{displayDirector}</span></span>}
                  {displayGenre && <span>Genre: <span className="text-slate-400">{displayGenre}</span></span>}
                  {displayReleaseDate && <span>Release: <span className="text-slate-400">{displayReleaseDate}</span></span>}
                </div>
              </div>

              <aside className="hidden lg:block w-56 flex-shrink-0">
                <div className="bg-slate-900/65 backdrop-blur-sm border border-slate-700/60 rounded-2xl p-4 space-y-3 sticky top-24">
                  <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider">
                    <Info className="w-3.5 h-3.5" />
                    <span>Info</span>
                  </div>
                  {categoryName && <InfoRow label="Category" value={categoryName} />}
                  {displayYear && <InfoRow label="Year" value={displayYear} />}
                  {displayRating && <InfoRow label="Rating" value={`${displayRating}/10`} />}
                  <InfoRow label="Type" value="Movie" />
                  {quality && <InfoRow label="Quality" value={quality} />}
                  {language && <InfoRow label="Language" value={language} />}
                  {provider && <InfoRow label="Source" value={provider} />}
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-8 space-y-6 sm:space-y-7">
        {similarVersions.length > 0 && (
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-white mb-3">Available Versions</h2>
            <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3">
              {similarVersions.map(version => (
                <MovieCard key={version.id} movie={version} onClick={() => handleMovieClick(version)} />
              ))}
            </div>
          </div>
        )}

        {relatedMovies && relatedMovies.length > 0 && (
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-white mb-3">More Like This</h2>
            <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3">
              {relatedMovies
                .filter(m => !similarVersions.find(v => v.id === m.id))
                .slice(0, 12)
                .map(m => (
                  <MovieCard key={m.id} movie={m} onClick={() => handleMovieClick(m)} />
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
