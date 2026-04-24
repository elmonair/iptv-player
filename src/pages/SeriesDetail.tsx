import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Play, Calendar, Clock, ChevronDown, ChevronRight } from 'lucide-react'
import { usePlaylistStore } from '../stores/playlistStore'
import { useBrowseStore } from '../stores/browseStore'
import { TopNavBar } from '../components/TopNavBar'
import { getSeriesInfo } from '../lib/xtream'
import type { XtreamSeriesInfo } from '../lib/xtreamTypes'

type SeasonData = {
  seasonNumber: number
  episodes: XtreamSeriesInfo['episodes'][string]
}

export default function SeriesDetail() {
  const { seriesId } = useParams<{ seriesId: string }>()
  const navigate = useNavigate()
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seriesInfo, setSeriesInfo] = useState<XtreamSeriesInfo | null>(null)
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set([1]))
  const episodeScrollRef = useRef<HTMLDivElement>(null)

  const activeSource = getActiveSource()
  const browseSeries = useBrowseStore((state) => state.state.series)
  const setSelectedEpisode = useBrowseStore((state) => state.setSelectedEpisode)
  const saveEpisodeListScrollTop = useBrowseStore((state) => state.saveEpisodeListScrollTop)

  useEffect(() => {
    if (!seriesId || !activeSource || activeSource.type !== 'xtream') {
      setError('Invalid series or no active playlist')
      setLoading(false)
      return
    }

    const fetchSeriesInfo = async () => {
      setLoading(true)
      setError(null)
      try {
        console.log('[SeriesDetail] Fetching series info:', seriesId)
        const info = await getSeriesInfo(activeSource.serverUrl, {
          username: activeSource.username,
          password: activeSource.password,
        }, seriesId)
        setSeriesInfo(info)
        console.log('[SeriesDetail] Series info loaded:', info.info.name)
      } catch (err) {
        console.error('[SeriesDetail] Failed to load series:', err)
        setError(err instanceof Error ? err.message : 'Failed to load series')
      } finally {
        setLoading(false)
      }
    }

    fetchSeriesInfo()
  }, [seriesId, activeSource])

  useEffect(() => {
    if (browseSeries.selectedSeasonNumber) {
      setExpandedSeasons((prev) => new Set(prev).add(browseSeries.selectedSeasonNumber as number))
    }
  }, [browseSeries.selectedSeasonNumber])

  useEffect(() => {
    if (episodeScrollRef.current && browseSeries.episodeListScrollTop > 0) {
      episodeScrollRef.current.scrollTop = browseSeries.episodeListScrollTop
    }
  }, [browseSeries.episodeListScrollTop, seriesInfo])

  const handleBack = () => {
    const categoryId = browseSeries.selectedCategoryId
    navigate(categoryId ? `/live?tab=series&category=${encodeURIComponent(categoryId)}` : '/live?tab=series', { replace: true })
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
      <div className="h-screen bg-slate-900 flex flex-col">
        <TopNavBar />
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-slate-400 text-base mb-4">No active Xtream playlist</p>
          <button
            onClick={() => navigate('/live?tab=series')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[44px]"
          >
            Go to Series
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-screen bg-slate-900 flex flex-col">
        <TopNavBar />
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
          <p className="text-slate-400 text-base">Loading series...</p>
        </div>
      </div>
    )
  }

  if (error || !seriesInfo) {
    return (
      <div className="h-screen bg-slate-900 flex flex-col">
        <TopNavBar />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <p className="text-red-400 text-base mb-4">{error || 'Series not found'}</p>
          <button
            onClick={() => navigate('/live?tab=series')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[44px]"
          >
            Go to Series
          </button>
        </div>
      </div>
    )
  }

  const { info, episodes } = seriesInfo

  const seasons: SeasonData[] = Object.entries(episodes)
    .map(([seasonNum, eps]) => ({
      seasonNumber: parseInt(seasonNum, 10),
      episodes: eps,
    }))
    .sort((a, b) => a.seasonNumber - b.seasonNumber)

  const toggleSeason = (seasonNum: number) => {
    setExpandedSeasons((prev) => {
      const next = new Set(prev)
      if (next.has(seasonNum)) {
        next.delete(seasonNum)
      } else {
        next.add(seasonNum)
      }
      return next
    })
  }

  const handleEpisodeClick = (episode: XtreamSeriesInfo['episodes'][string][number]) => {
    const seasonKey = Object.keys(episodes).find((s) => episodes[s]?.includes(episode))
    const selectedSeason = seasonKey ? parseInt(seasonKey, 10) : 1
    console.log('[SeriesDetail] Episode clicked:', {
      episodeId: episode.id,
      episodeNum: episode.episode_num,
      title: episode.title,
      containerExtension: episode.container_extension,
    })

    const allEps: Array<{
      id: number
      episode_num: number
      title: string
      container_extension: string
      seasonNumber: number
    }> = []
    for (const [seasonNum, eps] of Object.entries(episodes)) {
      for (const ep of eps) {
        allEps.push({
          id: ep.id,
          episode_num: ep.episode_num,
          title: ep.title,
          container_extension: ep.container_extension,
          seasonNumber: parseInt(seasonNum, 10),
        })
      }
    }

    const episodeId = episode.id
    const streamUrl = `${activeSource.serverUrl}/series/${activeSource.username}/${activeSource.password}/${episodeId}.${episode.container_extension}`
    console.log('[SeriesDetail] Navigating to:', `/watch/episode/${episodeId}`)
    console.log('[SeriesDetail] Stream URL:', streamUrl.replace(activeSource.password, '[PASS]'))
    setSelectedEpisode(selectedSeason, String(episodeId))
    if (episodeScrollRef.current) {
      saveEpisodeListScrollTop(episodeScrollRef.current.scrollTop)
    }

    navigate(`/watch/episode/${episodeId}`, {
      state: {
        seriesId,
        seriesName: info.name,
        seasonNumber: selectedSeason,
        episodeNumber: episode.episode_num,
        episodeTitle: episode.title || `Episode ${episode.episode_num}`,
        containerExtension: episode.container_extension,
        streamId: episodeId,
        allEpisodes: allEps,
        returnTo: `/series/${seriesId}`,
      },
    })
  }

  const handleEpisodeKeyDown = (e: React.KeyboardEvent, episode: XtreamSeriesInfo['episodes'][string][number]) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleEpisodeClick(episode)
    }
  }

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60)
    return `${mins} min`
  }

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      <TopNavBar />

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Series Info Header - scrollable */}
        <div className="flex-shrink-0 p-4 border-b border-slate-800">
          {/* Back button row */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[44px]"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            {/* Backdrop/Poster */}
            <div className="w-full md:w-48 flex-shrink-0 aspect-video md:aspect-auto md:h-48 bg-slate-800 rounded-lg overflow-hidden">
              {info.backdrop_path ? (
                <img
                  src={info.backdrop_path}
                  alt={info.name}
                  className="w-full h-full object-cover"
                />
              ) : info.cover ? (
                <img
                  src={info.cover}
                  alt={info.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-800">
                  <span className="text-4xl font-bold text-slate-600">{info.name.charAt(0)}</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-white mb-2">{info.name}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400 mb-2">
                {info.rating && (
                  <span className="flex items-center gap-1">
                    <span className="text-yellow-500">★</span> {info.rating}/10
                  </span>
                )}
                {info.releaseDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {info.releaseDate}
                  </span>
                )}
                {info.episode_run_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {info.episode_run_time}
                  </span>
                )}
              </div>
              {info.plot && (
                <p className="text-slate-300 text-sm leading-relaxed line-clamp-2">{info.plot}</p>
              )}
              {info.cast && (
                <div className="mt-2">
                  <span className="text-slate-500 text-xs">Cast: </span>
                  <span className="text-slate-400 text-xs">{info.cast}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Seasons & Episodes - scrollable */}
        <div ref={episodeScrollRef} className="flex-1 overflow-y-auto p-4">
          <h3 className="text-lg font-semibold text-white mb-3">
            Episodes ({seasons.reduce((acc, s) => acc + s.episodes.length, 0)})
          </h3>

          <div className="space-y-2">
            {seasons.map((season) => {
              const isExpanded = expandedSeasons.has(season.seasonNumber)
              return (
                <div key={season.seasonNumber} className="bg-slate-800 rounded-lg overflow-hidden">
                  {/* Season Header */}
                  <button
                    onClick={() => toggleSeason(season.seasonNumber)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[48px]"
                  >
                    <span className="text-white font-medium">
                      Season {season.seasonNumber}
                      <span className="text-slate-500 text-sm ml-2">({season.episodes.length} episodes)</span>
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                  </button>

                  {/* Episodes */}
                  {isExpanded && (
                    <div className="border-t border-slate-700">
                      {season.episodes.map((episode) => (
                        (() => {
                          const isFocused = browseSeries.focusedEpisodeId === String(episode.id)
                          return (
                        <div
                          key={episode.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleEpisodeClick(episode)}
                          onKeyDown={(e) => handleEpisodeKeyDown(e, episode)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border-b border-slate-700/50 last:border-b-0 cursor-pointer ${isFocused ? 'bg-indigo-600/20 border-l-4 border-l-indigo-500' : ''}`}
                        >
                          {/* Episode Number */}
                          <div className="w-8 h-8 bg-indigo-600 text-white rounded flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium">{episode.episode_num}</span>
                          </div>

                          {/* Episode Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">
                              {episode.title || `Episode ${episode.episode_num}`}
                            </p>
                            {episode.info?.plot && (
                              <p className="text-slate-500 text-xs mt-1 line-clamp-1">{episode.info.plot}</p>
                            )}
                          </div>

                          {/* Duration & Play */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {episode.info?.duration_secs && (
                              <span className="text-slate-500 text-xs">
                                {formatDuration(episode.info.duration_secs)}
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEpisodeClick(episode)
                              }}
                              className="w-8 h-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                              aria-label={`Play episode ${episode.episode_num}`}
                            >
                              <Play className="w-4 h-4 ml-0.5" />
                            </button>
                          </div>
                        </div>
                          )
                        })()
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
