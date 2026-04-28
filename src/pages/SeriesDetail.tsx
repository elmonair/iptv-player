import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Loader2, Star, Calendar, Clock, Globe, Play, Heart, ChevronLeft, Info, Monitor } from 'lucide-react'
import { usePlaylistStore } from '../stores/playlistStore'
import { useBrowseStore } from '../stores/browseStore'
import { useFavoritesStore } from '../stores/favoritesStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { TopNavBar } from '../components/TopNavBar'
import { parseTitle, formatRating, formatYear, formatDuration, formatReleaseDate } from '../lib/metadata'
import { getSeriesInfo } from '../lib/xtream'
import type { XtreamSeriesInfo } from '../lib/xtreamTypes'
import { getProxiedImageUrl } from '../lib/imageProxy'

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-white truncate" title={value}>{value}</p>
    </div>
  )
}

export default function SeriesDetail() {
  const { seriesId } = useParams<{ seriesId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const activeSource = getActiveSource()
  const browseSeries = useBrowseStore((state) => state.state.series)
  const setSelectedEpisode = useBrowseStore((state) => state.setSelectedEpisode)
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite)
  const isFavorite = useFavoritesStore((state) => state.isFavorite)

  const [loading, setLoading] = useState(true)
  const [imageError, setImageError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seriesInfo, setSeriesInfo] = useState<XtreamSeriesInfo | null>(null)
  const [selectedSeason, setSelectedSeason] = useState<number>(1)

  const series = useLiveQuery(
    async () => {
      if (!seriesId) return null
      const allSeries = await db.series.toArray()
      return allSeries.find(s =>
        String(s.externalId) === String(seriesId) ||
        String(s.id) === String(seriesId)
      ) || null
    },
    [seriesId],
  )

  const categoryName = useLiveQuery(
    async () => {
      if (!series?.categoryId) return ''
      const cat = await db.categories.where('id').equals(series.categoryId).first()
      return cat?.name || ''
    },
    [series?.categoryId],
  )

  const parsedMetadata = useMemo(() => series ? parseTitle(series.name) : null, [series?.name])

  console.log('[SeriesDetail] params', { seriesId })
  console.log('[SeriesDetail] loading', loading, 'seriesIsUndefined', series === undefined, 'series', series)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setSeriesInfo(null)
  }, [seriesId])

  useEffect(() => {
    async function fetchSeriesMetadata() {
      if (!seriesId || !activeSource || activeSource.type !== 'xtream') {
        setError('Invalid series or no active playlist')
        setLoading(false)
        return
      }

      try {
        console.log('[SeriesDetail] Fetching series info:', seriesId)
        const info = await getSeriesInfo(activeSource.serverUrl, {
          username: activeSource.username,
          password: activeSource.password,
        }, seriesId)
        setSeriesInfo(info)
        console.log('[SeriesDetail] Series info loaded:', info.info.name)

        const seasonNumbers = Object.keys(info.episodes).map(Number).sort((a, b) => a - b)
        if (seasonNumbers.length > 0) {
          const initialSeason = browseSeries.selectedSeasonNumber && seasonNumbers.includes(browseSeries.selectedSeasonNumber)
            ? browseSeries.selectedSeasonNumber
            : seasonNumbers[0]
          setSelectedSeason(initialSeason)
        }
      } catch (err) {
        console.error('[SeriesDetail] Failed to load series:', err)
        setError(err instanceof Error ? err.message : 'Failed to load series')
      } finally {
        setLoading(false)
      }
    }

    fetchSeriesMetadata()
  }, [seriesId, activeSource, browseSeries.selectedSeasonNumber])

  const { seasons, currentEpisodes, totalEpisodes } = useMemo(() => {
    if (!seriesInfo) return { seasons: [], currentEpisodes: [], totalEpisodes: 0 }

    const seasonNumbers = Object.keys(seriesInfo.episodes)
      .map(Number)
      .sort((a, b) => a - b)

    const episodes = seriesInfo.episodes[selectedSeason] || []
    const total = seasonNumbers.reduce((acc, s) => acc + (seriesInfo.episodes[s]?.length || 0), 0)

    return {
      seasons: seasonNumbers,
      currentEpisodes: episodes,
      totalEpisodes: total,
    }
  }, [seriesInfo, selectedSeason])

  const handleBack = () => {
    const categoryId = browseSeries.selectedCategoryId
    navigate(categoryId ? `/live?tab=series&category=${encodeURIComponent(categoryId)}` : '/live?tab=series', { replace: true })
  }

  const handlePlayFirst = () => {
    if (currentEpisodes.length > 0) {
      handleEpisodeClick(currentEpisodes[0])
    }
  }

  const handleFavoriteClick = () => {
    if (!series || !activeSource) return
    toggleFavorite('series', series.id, activeSource.id)
  }

  const handleEpisodeFavoriteClick = async (e: React.MouseEvent, episode: XtreamSeriesInfo['episodes'][string][number]) => {
    e.stopPropagation()
    if (!activeSource || !seriesId) return

    const episodeId = String(episode.id)
    const favorite = isFavorite('episode', episodeId)

    if (favorite) {
      const existing = await db.favorites
        .where('sourceId')
        .equals(activeSource.id)
        .and(f => f.itemType === 'episode' && f.itemId === episodeId)
        .first()
      if (existing) {
        await db.favorites.delete(existing.id)
        console.log('[SeriesDetail] Removed episode favorite:', episodeId)
      }
    } else {
      const { generateId } = await import('../lib/uuid')
      const newFavorite = {
        id: generateId(),
        itemType: 'episode' as const,
        itemId: episodeId,
        sourceId: activeSource.id,
        addedAt: Date.now(),
      }
      await db.favorites.add(newFavorite)
      console.log('[SeriesDetail] Added episode favorite:', episodeId)
    }

    if (activeSource) {
      const { loadFavorites } = useFavoritesStore.getState()
      loadFavorites(activeSource.id).catch(console.error)
    }
  }

  const handleEpisodeClick = (episode: XtreamSeriesInfo['episodes'][string][number]) => {
    if (!seriesInfo || !activeSource || activeSource.type !== 'xtream') return

    console.log('[SeriesDetail] Episode clicked:', {
      episodeId: episode.id,
      episodeNum: episode.episode_num,
      title: episode.title,
    })

    const allEpisodes: Array<{
      id: number
      episode_num: number
      title: string
      container_extension: string
      seasonNumber: number
    }> = []

    for (const [seasonNum, eps] of Object.entries(seriesInfo.episodes)) {
      for (const ep of eps) {
        allEpisodes.push({
          id: ep.id,
          episode_num: ep.episode_num,
          title: ep.title,
          container_extension: ep.container_extension,
          seasonNumber: parseInt(seasonNum, 10),
        })
      }
    }

    const episodeId = episode.id
    setSelectedEpisode(selectedSeason, String(episodeId))

    const from = location.pathname + location.search

    console.log('[SeriesDetail] Open episode:', {
      current: from,
      episodeId,
      seriesId,
      seriesName: seriesInfo?.info?.name || series?.name || 'Unknown',
      state: { from, tab: 'series', seriesId, seasonId: selectedSeason }
    })

    navigate(`/watch/episode/${episodeId}`, {
      state: {
        from,
        tab: 'series',
        seriesId,
        seasonId: selectedSeason,
        seriesName: seriesInfo?.info?.name || series?.name || 'Unknown',
        seasonNumber: selectedSeason,
        episodeNumber: episode.episode_num,
        episodeTitle: episode.title || `Episode ${episode.episode_num}`,
        containerExtension: episode.container_extension,
        streamId: episodeId,
        allEpisodes,
        returnTo: `/series/${seriesId}`,
      },
    })
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault()
        handleBack()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [browseSeries.selectedCategoryId])

  if (!activeSource || activeSource.type !== 'xtream') {
    return (
      <div className="min-h-screen bg-slate-900">
        <TopNavBar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p className="text-slate-400">No active Xtream playlist</p>
        </div>
      </div>
    )
  }

  if (series === undefined || loading) {
    return (
      <div className="min-h-screen bg-slate-900">
        <TopNavBar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900">
        <TopNavBar />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] px-4">
          <p className="text-red-400 text-base mb-4">{error || 'Failed to load series'}</p>
          <button onClick={handleBack} className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
            Back to Series
          </button>
        </div>
      </div>
    )
  }

  if (!series) {
    return (
      <div className="min-h-screen bg-slate-900">
        <TopNavBar />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] px-4">
          <Monitor className="w-16 h-16 text-slate-600 mb-4" />
          <p className="text-slate-400 text-center">Series not found</p>
          <button onClick={handleBack} className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
            Back to Series
          </button>
        </div>
      </div>
    )
  }

  const info = seriesInfo?.info
  const { cleanTitle, year, quality, language, provider } = parsedMetadata || { cleanTitle: series.name, year: null, quality: null, language: null, provider: null }
  const displayYear = formatYear(info?.releaseDate || series.year, year)
  const displayRating = formatRating(info?.rating_5based || series.rating)
  const hasBackdrop = info?.backdrop_path || series.backdropUrl || series.logoUrl
  const displayGenre = info?.genre || series.genre
  const displayCast = info?.cast || series.cast
  const displayDirector = info?.director || series.director
  const displayDuration = info?.episode_run_time || formatDuration(currentEpisodes[0]?.info?.duration_secs)
  const displayReleaseDate = formatReleaseDate(info?.releaseDate || series.releaseDate)
  const betterBackdrop = info?.backdrop_path || series.backdropUrl || null
  const betterPoster = info?.cover || info?.backdrop_path || series.logoUrl || null
  const overview = info?.plot || series.plot || ''

  return (
    <div className="min-h-screen bg-slate-900">
      <TopNavBar />

      <div className="relative">
        {hasBackdrop && !imageError && (
          <div className="absolute inset-0 z-0">
            <img
              src={getProxiedImageUrl(betterBackdrop) || getProxiedImageUrl(series.backdropUrl) || getProxiedImageUrl(series.logoUrl)}
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

          <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-5 lg:py-6">
            <div className="flex flex-col md:flex-row gap-4 md:gap-6">
              <div className="flex-shrink-0 mx-auto md:mx-0">
                <div className="w-[170px] sm:w-[190px] md:w-[200px] lg:w-[230px] aspect-[2/3] rounded-lg overflow-hidden shadow-2xl border border-slate-700/50 bg-slate-800">
                  {betterPoster ? (
                    <img src={getProxiedImageUrl(betterPoster)} alt={cleanTitle} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                      <Monitor className="w-10 h-10 text-slate-600" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-end">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 sm:mb-3 leading-tight">
                  {cleanTitle}
                </h1>

                <div className="flex flex-wrap items-center gap-2 mb-3 sm:mb-4">
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

                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-5">
                  <button
                    onClick={handlePlayFirst}
                    className="inline-flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-white text-slate-900 rounded-md font-semibold text-sm hover:bg-slate-200 transition-colors min-h-[44px]"
                  >
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                    <span>Play First</span>
                  </button>
                  <button
                    onClick={handleFavoriteClick}
                    className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors backdrop-blur-sm"
                    aria-label={series && activeSource && isFavorite('series', series.id) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors ${series && activeSource && isFavorite('series', series.id) ? 'text-red-500 fill-red-500' : ''}`} />
                  </button>
                </div>

                <div className="max-w-2xl mb-3 sm:mb-5">
                  <h2 className="sr-only">Overview</h2>
                  {overview ? (
                    <p className="text-slate-300 text-sm leading-relaxed line-clamp-3 sm:line-clamp-none">{overview}</p>
                  ) : (
                    <p className="text-slate-500 text-sm italic">No description is available from this playlist.</p>
                  )}
                </div>

                {displayCast && (
                  <div className="mb-3 sm:mb-4">
                    <span className="text-xs text-slate-500">Cast: </span>
                    <span className="text-slate-400 text-xs line-clamp-2">{displayCast}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {displayDirector && <span>Director: <span className="text-slate-400">{displayDirector}</span></span>}
                  {displayGenre && <span>Genre: <span className="text-slate-400">{displayGenre}</span></span>}
                  {displayReleaseDate && <span>Release: <span className="text-slate-400">{displayReleaseDate}</span></span>}
                  <span>Seasons: <span className="text-slate-400">{seasons.length}</span></span>
                  <span>Episodes: <span className="text-slate-400">{totalEpisodes}</span></span>
                </div>
              </div>

              <aside className="hidden lg:block w-56 flex-shrink-0">
                <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider">
                    <Info className="w-3.5 h-3.5" />
                    <span>Info</span>
                  </div>
                  {categoryName && <InfoRow label="Category" value={categoryName} />}
                  {displayYear && <InfoRow label="Year" value={displayYear} />}
                  {displayRating && <InfoRow label="Rating" value={`${displayRating}/10`} />}
                  <InfoRow label="Type" value="Series" />
                  {quality && <InfoRow label="Quality" value={quality} />}
                  {language && <InfoRow label="Language" value={language} />}
                  {provider && <InfoRow label="Source" value={provider} />}
                  <InfoRow label="Seasons" value={String(seasons.length)} />
                  <InfoRow label="Episodes" value={String(totalEpisodes)} />
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-8 space-y-5 sm:space-y-6">
        {seasons.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {seasons.map((season) => {
                const isSelected = season === selectedSeason
                return (
                  <button
                    key={season}
                    onClick={() => setSelectedSeason(season)}
                    className={`flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
                      isSelected
                        ? 'bg-violet-600 text-white border border-violet-400'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-transparent'
                    }`}
                  >
                    Season {season}
                  </button>
                )
              })}
            </div>

            {currentEpisodes.length > 0 ? (
              <div className="space-y-2">
                {currentEpisodes.map((episode) => {
                  const duration = episode.info?.duration_secs
                  const formattedDuration = duration ? `${Math.floor(duration / 60)} min` : null
                  const episodeId = String(episode.id)
                  const favorite = activeSource ? isFavorite('episode', episodeId) : false

                  return (
                    <button
                      key={episode.id}
                      onClick={() => handleEpisodeClick(episode)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-colors text-left focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    >
                      <div className="flex-shrink-0 w-10 h-10 bg-slate-700 text-white rounded-lg flex items-center justify-center">
                        <span className="text-sm font-semibold">{episode.episode_num}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium line-clamp-1">
                          {episode.title || `Episode ${episode.episode_num}`}
                        </p>
                        {formattedDuration && (
                          <p className="text-slate-500 text-xs mt-0.5">{formattedDuration}</p>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleEpisodeFavoriteClick(e, episode)}
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Heart className={`w-4 h-4 transition-colors ${favorite ? 'text-red-500 fill-red-500' : ''}`} />
                      </button>
                      <div className="flex-shrink-0 w-9 h-9 bg-violet-600 hover:bg-violet-500 text-white rounded-full flex items-center justify-center transition-colors">
                        <Play className="w-4 h-4 ml-0.5 fill-current" />
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-400">No episodes in this season</p>
              </div>
            )}
          </div>
        )}

        {totalEpisodes === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400">No episodes found in this series</p>
          </div>
        )}
      </div>
    </div>
  )
}
