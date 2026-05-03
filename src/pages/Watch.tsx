import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Loader2, Maximize2, Minimize2, List, Tv2, ChevronLeft, ChevronRight, Film, Heart, Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Settings, AlertTriangle } from 'lucide-react'
import mpegts from 'mpegts.js'
import Hls from 'hls.js'
import { db } from '../lib/db'
import { ChannelErrorOverlay } from '../components/ChannelErrorOverlay'
import { usePlaylistStore } from '../stores/playlistStore'
import { useBrowseStore } from '../stores/browseStore'
import { useFavoritesStore } from '../stores/favoritesStore'
import { useWatchHistoryStore } from '../stores/watchHistoryStore'
import { getSeriesInfo, getVodInfo } from '../lib/xtream'
import { getEpgForChannel } from '../lib/epgParser'
import type { ChannelRecord, MovieRecord } from '../lib/db'
import type { EpgProgram } from '../lib/epgParser'
import { getProxiedImageUrl } from '../lib/imageProxy'

const formatTime = (secs: number): string => {
  if (!secs || !Number.isFinite(secs)) return '0:00'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

const parseDurationString = (str: string): number => {
  if (!str || typeof str !== 'string') return 0

  const parts = str.split(':').map((p) => parseInt(p, 10))
  if (parts.some(Number.isNaN)) return 0

  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 1) return parts[0]
  return 0
}

type WatchStatus = 'loading' | 'ready-click-to-play' | 'playing' | 'error'
type EpisodeInfo = {
  id: string
  seriesId: string
  seriesName: string
  seasonNumber: number
  episodeNumber: number
  episodeTitle: string
  containerExtension: string
  streamId: number
  realDuration?: number
  allEpisodes?: Array<{
    id: number
    episode_num: number
    title: string
    container_extension: string
    seasonNumber: number
  }>
}
type WatchableItem = { type: 'channel'; data: ChannelRecord } | { type: 'movie'; data: MovieRecord } | { type: 'episode'; data: EpisodeInfo } | null

function getItemName(item: WatchableItem): string {
  if (!item) return ''
  if (item.type === 'episode') {
    return item.data.episodeTitle ?? ''
  }
  return (item.data as ChannelRecord | MovieRecord).name ?? ''
}

function getLiveStreamId(channel: Partial<ChannelRecord> & { id?: string }): string | null {
  if (channel.streamId) return String(channel.streamId)

  const id = String(channel.id || '')
  const match = id.match(/live-(\d+)$/)
  return match ? match[1] : null
}

function buildLiveProxyUrl(source: { id: string; serverUrl: string; username: string; password: string }, streamId: string): string {
  const params = new URLSearchParams({
    serverUrl: source.serverUrl,
    username: source.username,
    password: source.password,
  })

  return `/proxy/live/${encodeURIComponent(source.id)}/${encodeURIComponent(streamId)}?${params.toString()}`
}

function buildMovieProxyUrl(source: { id: string; serverUrl: string; username: string; password: string }, streamId: string, ext: string): string {
  const params = new URLSearchParams({
    serverUrl: source.serverUrl,
    username: source.username,
    password: source.password,
  })

  return `/proxy/movie/${encodeURIComponent(source.id)}/${encodeURIComponent(streamId)}.${ext}?${params.toString()}`
}

function buildSeriesProxyUrl(source: { id: string; serverUrl: string; username: string; password: string }, streamId: string, ext: string): string {
  const params = new URLSearchParams({
    serverUrl: source.serverUrl,
    username: source.username,
    password: source.password,
  })

  return `/proxy/series/${encodeURIComponent(source.id)}/${encodeURIComponent(streamId)}.${ext}?${params.toString()}`
}

const TRANSCODE_EXTENSIONS = ['mkv', 'avi', 'wmv', 'flv', 'ts', 'divx', 'xvid', 'm4v']
const DIRECT_PLAY_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4a', 'mp3']

function needsTranscode(ext: string): boolean {
  const lower = (ext || '').toLowerCase()
  return TRANSCODE_EXTENSIONS.includes(lower) && !DIRECT_PLAY_EXTENSIONS.includes(lower)
}

function buildTranscodeUrl(source: { id: string; serverUrl: string; username: string; password: string }, streamId: string, ext: string, type: 'movie' | 'series', seek?: number): string {
  const params = new URLSearchParams({
    serverUrl: source.serverUrl,
    username: source.username,
    password: source.password,
    ext,
  })
  if (seek !== undefined) {
    params.set('seek', String(Math.floor(seek)))
  }
  return `/transcode/${type}/${encodeURIComponent(streamId)}?${params.toString()}`
}

function extractStreamId(routeType: string | null, routeId: string | undefined, episodeId: string | undefined): { id: string; type: 'movie' | 'series' | null } {
  if (routeType === 'movie' && routeId) {
    const match = routeId.match(/movie-(\d+)/)
    if (match) return { id: match[1], type: 'movie' }
  } else if (routeType === 'episode' && episodeId) {
    return { id: episodeId, type: 'series' }
  }
  return { id: '', type: null }
}

export default function Watch() {
  const mountCountRef = useRef(0)
  useEffect(() => {
    mountCountRef.current++
    console.log('[Watch] MOUNT #', mountCountRef.current)
    return () => console.log('[Watch] UNMOUNT #', mountCountRef.current)
  }, [])
  const { id: routeId, episodeId } = useParams<{ id: string; episodeId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<ReturnType<typeof mpegts.createPlayer> | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const currentStreamUrlRef = useRef<string>('')
  const allItemsRef = useRef<WatchableItem[]>([])
  const categoryItemsRef = useRef<WatchableItem[]>([])
  const categoryIndexRef = useRef<number>(-1)
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeItemRef = useRef<HTMLButtonElement>(null)
  const hasResumedRef = useRef(false)
  const seekInProgressRef = useRef(false)
  const allEpisodesRef = useRef<EpisodeInfo['allEpisodes']>([])
  const currentSeriesIdRef = useRef<string>('')
  const currentSeriesNameRef = useRef<string>('')
  const prevRouteIdRef = useRef<string>('')
  const prevEpisodeIdRef = useRef<string>('')

  useEffect(() => {
    return () => { console.log('[Watch] COMPONENT UNMOUNTING') }
  }, [])

  const pathname = location.pathname
  const routeType: 'live' | 'movie' | 'episode' | null =
    pathname.includes('/watch/live/') ? 'live' :
    pathname.includes('/watch/movie/') ? 'movie' :
    pathname.includes('/watch/episode/') ? 'episode' :
    null

  const [status, setStatus] = useState<WatchStatus>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [itemName, setItemName] = useState<string>('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [videoInfo, setVideoInfo] = useState<{ width: number; height: number; fps: number } | null>(null)
  const [categoryItems, setCategoryItems] = useState<WatchableItem[]>([])
  const [categoryName, setCategoryName] = useState<string>('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [currentItemId, setCurrentItemId] = useState<string>('')
  const [currentType, setCurrentType] = useState<'channel' | 'movie' | 'episode'>('channel')
  const [activeSource, setActiveSource] = useState<Awaited<ReturnType<typeof getActiveSource>> | null>(null)
  const [lastVideoErrorCode, setLastVideoErrorCode] = useState<number | null>(null)
const [currentStreamUrl, setCurrentStreamUrl] = useState<string>('')
  const [currentContainerExtension, setCurrentContainerExtension] = useState<string>('mp4')
  const [channelEpg, setChannelEpg] = useState<Record<string, EpgProgram | null>>({})
  const [realDuration, setRealDuration] = useState<number>(0)
  const [showError, setShowError] = useState(false)
  const [vodError, setVodError] = useState(false)
  const [streamSettled, setStreamSettled] = useState(false)
  const [isLoadingNewContent, setIsLoadingNewContent] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [showControls, setShowControls] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [bufferedPercent, setBufferedPercent] = useState(0)
  const [isBuffering, setIsBuffering] = useState(false)
  const [seekOffset, setSeekOffset] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [audioTracks, setAudioTracks] = useState<Array<{ index: number; codec: string; language: string; title: string; channels: number; default: boolean }>>([])
  const [subtitleTracks, setSubtitleTracks] = useState<Array<{ index: number; codec: string; language: string; title: string; default: boolean }>>([])
  const [selectedAudio, setSelectedAudio] = useState<number | null>(null)
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>('none')
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const vodErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadingNewContentRef = useRef(false)
  const watchedItemRef = useRef<{
    itemType: 'movie' | 'episode' | null
    itemId: string | null
    sourceId: string | null
    currentTime: number
    duration: number
  }>({
    itemType: null,
    itemId: null,
    sourceId: null,
    currentTime: 0,
    duration: 0,
  })

  const setLastChannelId = usePlaylistStore((state) => state.setLastChannelId)
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite)
  const isFavorite = useFavoritesStore((state) => state.isFavorite)
  const updateWatchProgress = useWatchHistoryStore((state) => state.updateWatchProgress)
  const getWatchHistory = useWatchHistoryStore((state) => state.getWatchHistory)

  const handleFavoriteToggle = async () => {
    if (!activeSource || !currentItemId || !currentType) return

    const itemTypeMap: Record<typeof currentType, 'channel' | 'movie' | 'episode'> = {
      channel: 'channel',
      movie: 'movie',
      episode: 'episode',
    }

    const itemType = itemTypeMap[currentType]
    await toggleFavorite(itemType, currentItemId, activeSource.id)
    console.log('[Watch] Toggled favorite:', itemType, currentItemId)
  }

  const safeSetVodError = useCallback((value: boolean) => {
    if (value && loadingNewContentRef.current) {
      console.log('[VOD] Suppressing error during content transition')
      return
    }
    setVodError(value)
  }, [])

  const saveWatchedItemProgress = useCallback(() => {
    const data = watchedItemRef.current
    if (!data.itemType || !data.itemId || !data.sourceId || data.currentTime <= 5) return

    console.log('[Watch] Saving progress for', `${data.itemType}:${data.itemId}`, 'at', data.currentTime, '/', data.duration)
    updateWatchProgress(data.itemType, data.itemId, data.sourceId, data.currentTime, data.duration)
  }, [updateWatchProgress])

  const clearErrorTimer = useCallback(() => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }
  }, [])

  const destroyPlayer = useCallback(() => {
    const player = playerRef.current
    if (player) {
      try { player.pause() } catch { /* ignore */ }
      try { player.unload() } catch { /* ignore */ }
      try { player.detachMediaElement() } catch { /* ignore */ }
      try { player.destroy() } catch { /* ignore */ }
      playerRef.current = null
    }
    const hls = hlsRef.current
    if (hls) {
      try { hls.destroy() } catch { /* ignore */ }
      hlsRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.src = ''
    }
    // Clear streamUrl state when destroying player to prevent error logging
    currentStreamUrlRef.current = ''
    setCurrentStreamUrl('')
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current)
      statsIntervalRef.current = null
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    setVideoInfo(null)
    clearErrorTimer()
    if (vodErrorTimerRef.current) {
      clearTimeout(vodErrorTimerRef.current)
      vodErrorTimerRef.current = null
    }
  }, [clearErrorTimer])

  const startProgressTracking = useCallback((itemType: 'channel' | 'movie' | 'episode', itemId: string) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }
    if (!activeSource) return
    if (itemType === 'channel') return

    const saveProgress = () => {
      if (!videoRef.current || !activeSource) return
      const rawTime = videoRef.current.currentTime
      const ct = rawTime + seekOffset
      const duration = realDuration || videoRef.current.duration
      updateWatchProgress(itemType, itemId, activeSource.id, ct, duration)
    }

    progressIntervalRef.current = setInterval(saveProgress, 10000)
  }, [activeSource, updateWatchProgress, seekOffset, realDuration])

  const handleLoadedMetadata = useCallback(async (savedProgress?: { position: number } | null) => {
    if (hasResumedRef.current) return
    if (!videoRef.current) return

    const videoEl = videoRef.current
    const saved = savedProgress?.position || 0
    const duration = videoEl.duration

    if (saved > 30 && Number.isFinite(duration) && saved < duration * 0.9) {
      const source = activeSource
      if (source && source.type === 'xtream') {
        const { id: streamId, type: transcodeType } = extractStreamId(routeType, routeId, episodeId)
        if (streamId && transcodeType) {
          const transcodeUrl = buildTranscodeUrl(source, streamId, currentContainerExtension, transcodeType, saved)
          console.log('[RESUME] Switching to transcode URL with saved position:', saved, 'URL:', transcodeUrl)
          setSeekOffset(saved)
          setCurrentStreamUrl(transcodeUrl)
          videoEl.src = transcodeUrl
          videoEl.load()
          videoEl.play().catch(() => {})
          hasResumedRef.current = true
          return
        }
      }
    }

    hasResumedRef.current = true
  }, [activeSource, routeType, routeId, episodeId, currentContainerExtension])

  const stopProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }, [])

  const handlePlayClick = async () => {
    if (!videoRef.current) {
      return
    }
    try {
      await videoRef.current.play()
    } catch (err) {
      console.error('[Watch] User-initiated play failed:', err)
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }

  const handleUpBack = useCallback(() => {
    const navState = location.state as { from?: string; tab?: string; categoryId?: string; scrollY?: number; seriesId?: string } | null

    if (navState?.from) {
      navigate(navState.from, { replace: true })
      return
    }

    if (currentType === 'movie') {
      navigate('/live?tab=movies', { replace: true })
      return
    }

    if (currentType === 'episode') {
      const seriesId = navState?.seriesId
      if (seriesId) {
        navigate(`/series/${encodeURIComponent(seriesId)}`, { replace: true })
      } else {
        navigate('/live?tab=series', { replace: true })
      }
      return
    }

    if (currentType === 'channel') {
      const ctx = useBrowseStore.getState().exitPlayer()
      if (ctx && ctx.section === 'live') {
        const categoryId = ctx.categoryId
        const params = new URLSearchParams()
        params.set('tab', 'channels')
        if (categoryId && categoryId !== 'all') {
          params.set('category', categoryId)
        }
        navigate(`/live?${params.toString()}`, { replace: true })
        return
      }

      navigate('/live?tab=channels', { replace: true })
      return
    }

    // Final fallback
    navigate('/live')
  }, [currentType, currentItemId, location.state, navigate])

  const buildStreamUrl = (source: { serverUrl: string; username: string; password: string }, item: WatchableItem): string => {
    if (!item) return ''
    if (item.type === 'channel') {
      const channel = item.data as ChannelRecord
      const streamId = getLiveStreamId(channel)
      if (!streamId) return ''

      const directUrl = `${source.serverUrl}/live/${source.username}/${source.password}/${streamId}.ts`

      if (import.meta.env.PROD) {
        return buildLiveProxyUrl(source as { id: string; serverUrl: string; username: string; password: string }, streamId)
      }

      return directUrl
    } else if (item.type === 'movie') {
      const movie = item.data as MovieRecord
      const ext = movie.containerExtension || 'mp4'
      if (import.meta.env.PROD && needsTranscode(ext)) {
        return buildTranscodeUrl(source as { id: string; serverUrl: string; username: string; password: string }, String(movie.streamId), ext, 'movie')
      }
      if (import.meta.env.PROD) {
        return buildMovieProxyUrl(source as { id: string; serverUrl: string; username: string; password: string }, String(movie.streamId), ext)
      }
      return `${source.serverUrl}/movie/${source.username}/${source.password}/${movie.streamId}.${ext}`
    } else if (item.type === 'episode') {
      const episode = item.data as EpisodeInfo
      const ext = episode.containerExtension || 'mkv'
      if (import.meta.env.PROD && needsTranscode(ext)) {
        return buildTranscodeUrl(source as { id: string; serverUrl: string; username: string; password: string }, String(episode.streamId), ext, 'series')
      }
      if (import.meta.env.PROD) {
        return buildSeriesProxyUrl(source as { id: string; serverUrl: string; username: string; password: string }, String(episode.streamId), ext)
      }
      return `${source.serverUrl}/series/${source.username}/${source.password}/${episode.streamId}.${ext}`
    }
    return ''
  }

  const setupVideoSource = useCallback((videoEl: HTMLVideoElement, streamUrl: string): boolean => {
    // Destroy previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const isHls = streamUrl.includes('.m3u8') || streamUrl.includes('m3u8')

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      })
      hlsRef.current = hls

      hls.loadSource(streamUrl)
      hls.attachMedia(videoEl)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // tracks available via hls.audioTracks / hls.subtitleTracks if needed
      })

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error('[HLS] Error:', data.type, data.details, data.fatal)
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad()
          } else {
            setStatus('error')
            setErrorMsg(`HLS error: ${data.details}`)
          }
        }
      })

      return true
    }

    // Not HLS or HLS not supported — use native video
    videoEl.src = streamUrl
    return false
  }, [])

  const playEpisode = useCallback(async (episodeInfo: EpisodeInfo, overrideSource?: Awaited<ReturnType<typeof getActiveSource>> | null) => {
    if (!videoRef.current) return

    const source = overrideSource || activeSource
    if (!source || source.type !== 'xtream') return

    destroyPlayer()

    const episodeItem: WatchableItem = { type: 'episode', data: episodeInfo }
    const episodeName = `S${episodeInfo.seasonNumber}E${episodeInfo.episodeNumber} - ${episodeInfo.episodeTitle}`

    console.log('[Watch] Playing episode:', episodeName)
    setItemName(episodeName)
    setCurrentItemId(`episode_${episodeInfo.streamId}`)
    setCurrentType('episode')
    setCurrentContainerExtension(episodeInfo.containerExtension || 'mkv')
    setStatus('loading')
    setVodError(false)
    setErrorMsg(null)
    setLastVideoErrorCode(null)
    setVideoInfo(null)
    setCategoryName(episodeInfo.seriesName)

    if (episodeInfo.allEpisodes && episodeInfo.allEpisodes.length > 0) {
      allEpisodesRef.current = episodeInfo.allEpisodes
      currentSeriesIdRef.current = episodeInfo.seriesId
      currentSeriesNameRef.current = episodeInfo.seriesName
    }

    const allEps = allEpisodesRef.current
    const seriesId = episodeInfo.seriesId || currentSeriesIdRef.current
    const seriesName = episodeInfo.seriesName || currentSeriesNameRef.current

    let sidebarEpisodes: WatchableItem[] = [episodeItem]
    if (allEps && allEps.length > 0) {
      sidebarEpisodes = allEps.map((ep) => ({
        type: 'episode' as const,
        data: {
          id: String(ep.id),
          seriesId,
          seriesName,
          seasonNumber: ep.seasonNumber,
          episodeNumber: ep.episode_num,
          episodeTitle: ep.title || `Episode ${ep.episode_num}`,
          containerExtension: ep.container_extension,
          streamId: ep.id,
        } as EpisodeInfo,
      }))
    }

    setCategoryItems(sidebarEpisodes)
    categoryItemsRef.current = sidebarEpisodes
    const currentIdx = sidebarEpisodes.findIndex(
      (e) => e !== null && e.type === 'episode' && (e.data as EpisodeInfo).streamId === episodeInfo.streamId
    )
    categoryIndexRef.current = currentIdx >= 0 ? currentIdx : 0

    const streamUrl = buildStreamUrl(source, episodeItem)
    currentStreamUrlRef.current = streamUrl
    setCurrentStreamUrl(streamUrl)

    const videoEl = videoRef.current
    if (!videoEl) {
      console.warn('[Watch] videoRef not ready after await, skipping playEpisode')
      return
    }

    const episodeId = String(episodeInfo.streamId)
    let savedProgress: { position: number } | null = null
    try {
      const dbRecord = await db.watchHistory.where('id').equals(`episode:${episodeId}`).first()
      console.log('[RESUME] Dexie query for episode:', episodeId, 'result:', dbRecord ? `position=${dbRecord.position}` : 'not found')
      if (dbRecord && dbRecord.position > 0) {
        savedProgress = { position: dbRecord.position }
      }
    } catch (err) {
      console.error('[Watch] Failed to query episode watch history:', err)
    }

    if (!videoRef.current) {
      console.warn('[Watch] videoRef not ready after Dexie await, skipping episode setup')
      return
    }

    if (savedProgress && savedProgress.position > 30) {
      const resumeUrl = buildTranscodeUrl(source, String(episodeInfo.streamId), episodeInfo.containerExtension || 'mkv', 'series', savedProgress.position)
      console.log('[RESUME] Starting episode directly with transcode URL, seek:', savedProgress.position, 'URL:', resumeUrl)
      setSeekOffset(savedProgress.position)
      setCurrentContainerExtension(episodeInfo.containerExtension || 'mkv')
      setCurrentStreamUrl(resumeUrl)
      currentStreamUrlRef.current = resumeUrl
      setupVideoSource(videoEl, resumeUrl)
      videoEl.onloadedmetadata = () => {
        hasResumedRef.current = true
      }
    } else {
      setupVideoSource(videoEl, streamUrl)
      videoEl.onloadedmetadata = () => {
        handleLoadedMetadata(savedProgress)
      }
    }
    videoEl.oncanplay = () => {
      if (videoEl.videoWidth && videoEl.videoHeight) {
        setVideoInfo({
          width: videoEl.videoWidth,
          height: videoEl.videoHeight,
          fps: 0,
        })
      }
    }
    videoEl.onplaying = () => {
      setStatus('playing')
      setVodError(false)
      startProgressTracking('episode', episodeId)
    }
    videoEl.onerror = () => {
      if (!currentStreamUrlRef.current) {
        return
      }
      console.error('[Watch] Episode video error:', videoEl.error)
      safeSetVodError(true)
      const errCode = videoEl.error?.code ?? 0
      if (errCode === 4) {
        setErrorMsg('Video format not supported by browser. Copy URL for VLC.')
      } else {
        setErrorMsg('Unable to play episode. Copy URL for VLC.')
      }
    }
    videoEl.onstalled = null

    try {
      await videoEl.play()
      setStatus('playing')
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
        setStatus('ready-click-to-play')
      } else {
        safeSetVodError(true)
        setErrorMsg(err instanceof Error ? err.message : String(err))
      }
    }
  }, [destroyPlayer, getWatchHistory, startProgressTracking, handleLoadedMetadata])

  const zapTo = useCallback(async (targetItemId: string) => {
    if (!targetItemId || !videoRef.current) return

    const source = usePlaylistStore.getState().getActiveSource()
    console.log('[zapTo] called with:', targetItemId, '| source from store:', source?.type, source?.name, '| id:', source?.id)
    if (!source || source.type !== 'xtream') {
      console.warn('[zapTo] FAIL - no valid Xtream source, source:', source)
      return
    }

    clearErrorTimer()

    destroyPlayer()

    const decodedId = targetItemId.includes('%') ? decodeURIComponent(targetItemId) : targetItemId

    // Set currentItemId immediately to prevent empty state during DB query
    // This ensures video error handlers always have a valid ID to log
    setCurrentItemId(decodedId)

    let item: WatchableItem = null
    try {
      const channel = await db.channels.where('id').equals(decodedId).first()
      if (channel) {
        item = { type: 'channel', data: channel }
      } else {
        const movie = await db.movies.where('id').equals(decodedId).first()
        if (movie) {
          item = { type: 'movie', data: movie }
        }
      }
    } catch (err) {
      console.error('[Watch] Failed to load item:', err)
      setStatus('error')
      setErrorMsg('Failed to load item')
      return
    }

    if (!item) {
      console.warn('[Watch] Media not found', { id: targetItemId, decodedId })
      setStatus('error')
      setErrorMsg('Media not found')
      return
    }

    console.log('[Watch] Zap to:', getItemName(item))
    setItemName(getItemName(item))
    setCurrentItemId(item.data.id)
    setCurrentType(item.type)
    if (item.type === 'movie') {
      setCurrentContainerExtension((item.data as MovieRecord).containerExtension || 'mp4')
    }
    setStatus('loading')
    setShowError(false)
    setVodError(false)
    setErrorMsg(null)
    setLastVideoErrorCode(null)
    setVideoInfo(null)

    const allItems = allItemsRef.current
    const categoryItms = allItems.filter((i) => i && i.type === item.type && i.data.categoryId === item.data.categoryId)
    const sidebarItems = item.type === 'movie'
      ? categoryItms.filter((i) => i && i.data.id !== item.data.id)
      : categoryItms
    categoryItemsRef.current = sidebarItems
    const catIdx = categoryItms.findIndex((i) => i && i.data.id === item.data.id)
    categoryIndexRef.current = catIdx >= 0 ? catIdx : 0
    setCategoryItems(sidebarItems)

    try {
      const cat = await db.categories.where('id').equals(item.data.categoryId).first()
      setCategoryName(cat?.name ?? 'Unknown')
    } catch {
      setCategoryName('Unknown')
    }

    if (!videoRef.current) {
      console.warn('[Watch] videoRef not ready after await, aborting zapTo')
      return
    }

    const streamUrl = buildStreamUrl(source, item)

    if (!streamUrl) {
      console.warn('[Watch] Skipping video src set - empty streamUrl', { targetItemId, decodedId, itemId: item.data.id })
      setStatus('error')
      setErrorMsg('Failed to build stream URL')
      return
    }

    // Update streamUrl state after building and validating
    currentStreamUrlRef.current = streamUrl
    setCurrentStreamUrl(streamUrl)

    const videoEl = videoRef.current
    if (!videoEl) {
      console.warn('[Watch] videoRef not ready after await, skipping zapTo')
      return
    }

    if (item.type === 'channel') {
      if (mpegts.isSupported()) {
        const player = mpegts.createPlayer(
          {
            type: 'mpegts',
            url: streamUrl,
            isLive: true,
          },
          {
            enableWorker: false,
            enableStashBuffer: true,
            stashInitialSize: 1024 * 1024,
            autoCleanupSourceBuffer: true,
            autoCleanupMaxBackwardDuration: 60,
            autoCleanupMinBackwardDuration: 30,
            lazyLoad: false,
            seekType: 'range',
            liveBufferLatencyChasing: false,
            liveSync: false,
            fixAudioTimestampGap: true,
          }
        )
        playerRef.current = player

        player.on(mpegts.Events.ERROR, (_type: string, _detail: string, info: { message?: string }) => {
          console.error('[Channel] Player error:', info?.message ?? _detail)
        })

        player.on(mpegts.Events.LOADING_COMPLETE, () => {
          // live stream ended (rare for true live)
        })

        player.on(mpegts.Events.MEDIA_INFO, (info: { width?: number; height?: number; frame_rate?: number }) => {
          if (info.width && info.height) {
            setVideoInfo((prev) => ({
              width: info.width as number,
              height: info.height as number,
              fps: info.frame_rate ?? prev?.fps ?? 0,
            }))
          }
        })

        player.on(mpegts.Events.STATISTICS_INFO, (info: { speed?: number; fps?: number } | unknown) => {
          const stats = info as { speed?: number; fps?: number }
          if (stats && typeof stats.fps === 'number' && stats.fps > 0) {
            setVideoInfo((prev) => prev ? { ...prev, fps: stats.fps as number } : null)
          }
        })

        player.attachMediaElement(videoEl)

        player.load()

        videoEl.oncanplay = async () => {
          if (videoEl.videoWidth && videoEl.videoHeight) {
            setVideoInfo((prev) => ({
              width: videoEl.videoWidth,
              height: videoEl.videoHeight,
              fps: prev?.fps ?? 0,
            }))
          }

          try {
            await videoEl.play()
            setStatus('playing')
            setLastChannelId(item.data.id)
          } catch (err) {
            if (err instanceof Error && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
              setStatus('ready-click-to-play')
            } else {
              console.error('[Channel] Play failed:', err)
            }
          }
        }
        videoEl.onloadedmetadata = null
        videoEl.onplaying = () => {
          clearErrorTimer()
          setShowError(false)
          setStatus('playing')
          setLastChannelId(item.data.id)
          statsIntervalRef.current = setInterval(() => {
            if (videoEl.videoWidth && videoEl.videoHeight) {
              setVideoInfo((prev) => {
                const updated = { width: videoEl.videoWidth, height: videoEl.videoHeight, fps: prev?.fps ?? 0 }
                return JSON.stringify(prev) !== JSON.stringify(updated) ? updated : prev
              })
            }
          }, 1000)
        }
        videoEl.onstalled = null
        videoEl.onerror = () => {
          if (!currentStreamUrlRef.current) return
          setLastVideoErrorCode(videoEl.error?.code ?? null)
          console.error('[Channel] Video error:', videoEl.error?.code, videoEl.error?.message)
        }
      } else {
        videoEl.src = streamUrl
      }
    } else {
      // Movie — use HLS.js for m3u8 streams, native for others
      const movieId = (item.data as MovieRecord).id

      let savedProgress: { position: number } | null = null
      try {
        const dbRecord = await db.watchHistory.where('id').equals(`movie:${movieId}`).first()
        console.log('[RESUME] Dexie query for movie:', movieId, 'result:', dbRecord ? `position=${dbRecord.position}` : 'not found')
        if (dbRecord && dbRecord.position > 0) {
          savedProgress = { position: dbRecord.position }
        }
      } catch (err) {
        console.error('[Watch] Failed to query watch history:', err)
      }

      if (!videoRef.current) {
        console.warn('[Watch] videoRef not ready after movie resume await, aborting zapTo')
        return
      }

      if (savedProgress && savedProgress.position > 30) {
        const source = usePlaylistStore.getState().getActiveSource()
        if (source && source.type === 'xtream') {
          const { id: streamId, type: transcodeType } = extractStreamId(routeType, routeId, episodeId)
          if (streamId && transcodeType) {
            const ext = (item.data as MovieRecord).containerExtension || 'mp4'
            const resumeUrl = buildTranscodeUrl(source, streamId, ext, transcodeType, savedProgress.position)
            console.log('[RESUME] Starting directly with transcode URL, seek:', savedProgress.position, 'URL:', resumeUrl)
            setSeekOffset(savedProgress.position)
            setCurrentContainerExtension(ext)
            setCurrentStreamUrl(resumeUrl)
            setupVideoSource(videoEl, resumeUrl)
            videoEl.onloadedmetadata = () => {
              hasResumedRef.current = true
            }
            videoEl.oncanplay = () => {
              if (videoEl.videoWidth && videoEl.videoHeight) {
                setVideoInfo({ width: videoEl.videoWidth, height: videoEl.videoHeight, fps: 0 })
              }
            }
            videoEl.onplaying = () => {
              setStatus('playing')
              setVodError(false)
              startProgressTracking('movie', movieId)
            }
            videoEl.onerror = () => {
              if (!currentStreamUrl) return
              console.error('[Watch] Movie video error:', videoEl.error?.code)
              safeSetVodError(true)
              setErrorMsg('Unable to play movie. Copy URL for VLC.')
            }
            try {
              await videoEl.play()
              setStatus('playing')
            } catch (err) {
              if (err instanceof Error && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
                setStatus('ready-click-to-play')
              }
            }
            return
          }
        }
      }

      setupVideoSource(videoEl, streamUrl)

      videoEl.onloadedmetadata = () => {
        handleLoadedMetadata(savedProgress)
      }
      videoEl.oncanplay = () => {
        if (videoEl.videoWidth && videoEl.videoHeight) {
          setVideoInfo({
            width: videoEl.videoWidth,
            height: videoEl.videoHeight,
            fps: 0,
          })
        }
      }
      videoEl.onplaying = () => {
        setStatus('playing')
        setVodError(false)
        startProgressTracking('movie', movieId)
      }
      videoEl.onerror = () => {
        if (!currentStreamUrl) return
        if (seekInProgressRef.current) {
          console.log('[Watch] Skipping movie error during seek')
          return
        }
        const errCode = videoEl.error?.code ?? 0
        if (errCode === 1) return
        console.error('[Watch] Movie video error:', errCode, videoEl.error?.message)
        safeSetVodError(true)
        if (errCode === 4) {
          setErrorMsg('Video format not supported by browser. Copy URL for VLC.')
        } else {
          setErrorMsg('Unable to play movie. Copy URL for VLC.')
        }
      }
      videoEl.onstalled = null

      try {
        await videoEl.play()
        setStatus('playing')
      } catch (err) {
        if (err instanceof Error && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
          setStatus('ready-click-to-play')
        } else {
          safeSetVodError(true)
          setErrorMsg(err instanceof Error ? err.message : String(err))
        }
      }
    }
  }, [destroyPlayer, getWatchHistory, startProgressTracking, handleLoadedMetadata, setLastChannelId, clearErrorTimer])

  const handleFullscreenToggle = useCallback(() => {
    const container = videoContainerRef.current
    if (!container) return
    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(() => {})
    } else {
      document.exitFullscreen?.().catch(() => {})
    }
  }, [])

  const handleSkip = useCallback((seconds: number) => {
    if (!videoRef.current) return
    const source = activeSource
    if (!source || source.type !== 'xtream') return
    const { id: streamId, type: transcodeType } = extractStreamId(routeType, routeId, episodeId)
    if (!streamId || !transcodeType) return
    const displayDur = realDuration || videoRef.current?.duration || 0
    const newTime = Math.max(0, Math.min(displayDur, currentTime + seconds))
    const transcodeUrl = buildTranscodeUrl(source, streamId, currentContainerExtension, transcodeType, newTime)
    console.log('[SKIP] Switching to transcode URL with skip:', newTime, 'URL:', transcodeUrl)
    setSeekOffset(newTime)
    setCurrentStreamUrl(transcodeUrl)
    seekInProgressRef.current = true
    setTimeout(() => { seekInProgressRef.current = false }, 3000)
    videoRef.current.src = transcodeUrl
    videoRef.current.load()
    videoRef.current.play().catch(() => {})
  }, [activeSource, routeType, routeId, episodeId, realDuration, currentTime, currentContainerExtension])

  const navigateToEpisode = useCallback((episodeInfo: EpisodeInfo) => {
    const allEpisodes = episodeInfo.allEpisodes && episodeInfo.allEpisodes.length > 0
      ? episodeInfo.allEpisodes
      : allEpisodesRef.current
    const seriesId = episodeInfo.seriesId || currentSeriesIdRef.current
    const seriesName = episodeInfo.seriesName || currentSeriesNameRef.current
    const from = location.pathname + location.search

    navigate(`/watch/episode/${episodeInfo.streamId}`, {
      state: {
        from,
        tab: 'series',
        seriesId,
        seriesName,
        seasonNumber: episodeInfo.seasonNumber,
        episodeNumber: episodeInfo.episodeNumber,
        episodeTitle: episodeInfo.episodeTitle,
        containerExtension: episodeInfo.containerExtension,
        streamId: episodeInfo.streamId,
        allEpisodes,
        realDuration: episodeInfo.realDuration || 0,
      },
    })
  }, [location.pathname, location.search, navigate])

  const navigateToMovie = useCallback((movieId: string) => {
    navigate(`/watch/movie/${encodeURIComponent(movieId)}`)
  }, [navigate])

  const handlePrevChannel = useCallback(() => {
    const items = categoryItemsRef.current
    if (items.length === 0) return

    const nextIndex = categoryIndexRef.current > 0
      ? categoryIndexRef.current - 1
      : items.length - 1

    const nextItem = items[nextIndex]
    if (!nextItem) return
    categoryIndexRef.current = nextIndex
    if (nextItem.type === 'episode') {
      navigateToEpisode(nextItem.data as EpisodeInfo)
    } else if (nextItem.type === 'movie') {
      navigateToMovie(nextItem.data.id)
    } else {
      zapTo(nextItem.data.id)
    }
  }, [navigateToEpisode, navigateToMovie, zapTo])

  const handleNextChannel = useCallback(() => {
    const items = categoryItemsRef.current
    if (items.length === 0) return

    const nextIndex = categoryIndexRef.current < items.length - 1
      ? categoryIndexRef.current + 1
      : 0

    const nextItem = items[nextIndex]
    if (!nextItem) return
    categoryIndexRef.current = nextIndex
    if (nextItem.type === 'episode') {
      navigateToEpisode(nextItem.data as EpisodeInfo)
    } else if (nextItem.type === 'movie') {
      navigateToMovie(nextItem.data.id)
    } else {
      zapTo(nextItem.data.id)
    }
  }, [navigateToEpisode, navigateToMovie, zapTo])

  useEffect(() => {
    hasResumedRef.current = false
  }, [currentItemId, routeId, episodeId])

  useEffect(() => {
    const prevRoute = prevRouteIdRef.current
    const prevEpisode = prevEpisodeIdRef.current
    const isContentChange = prevRoute !== routeId || prevEpisode !== episodeId

    if (isContentChange && watchedItemRef.current.itemId) {
      const prev = watchedItemRef.current
      if (prev.currentTime > 5 && prev.itemType && prev.itemId && prev.sourceId) {
        console.log('[Watch] Saving previous content progress:', `${prev.itemType}:${prev.itemId}`, 'at', prev.currentTime)
        updateWatchProgress(prev.itemType, prev.itemId, prev.sourceId, prev.currentTime, prev.duration)
      }
      watchedItemRef.current = {
        itemType: null,
        itemId: null,
        sourceId: null,
        currentTime: 0,
        duration: 0,
      }
    }

    prevRouteIdRef.current = routeId || ''
    prevEpisodeIdRef.current = episodeId || ''
  }, [routeId, episodeId, updateWatchProgress])

  useEffect(() => {
    return () => {
      saveWatchedItemProgress()
    }
  }, [saveWatchedItemProgress])

  useEffect(() => {
    console.log('[VOD] routeId changed to:', routeId, '| vodError currently:', vodError, '| streamUrl:', currentStreamUrl)
  }, [routeId])

  useEffect(() => {
    console.log('[VOD] vodError changed to:', vodError, '| at routeId:', routeId)
  }, [vodError, routeId])

  useLayoutEffect(() => {
    loadingNewContentRef.current = true
    setIsLoadingNewContent(true)
    setVodError(false)
    setShowError(false)

    if (vodErrorTimerRef.current) {
      clearTimeout(vodErrorTimerRef.current)
      vodErrorTimerRef.current = null
    }

    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }
  }, [routeId, episodeId])

  useEffect(() => {
    console.log('[VOD] Content changed, clearing all error state')

    setVodError(false)
    setShowError(false)

    if (vodErrorTimerRef.current) {
      clearTimeout(vodErrorTimerRef.current)
      vodErrorTimerRef.current = null
    }

    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }

    setIsLoadingNewContent(true)
    loadingNewContentRef.current = true

    const timer = setTimeout(() => {
      setIsLoadingNewContent(false)
      loadingNewContentRef.current = false
    }, 3000)

    return () => clearTimeout(timer)
  }, [routeId, episodeId])

  useEffect(() => {
    if (routeType !== 'episode') return

    console.log('[Watch] === EPISODE CHANGE ===', {
      oldEpisodeId: prevEpisodeIdRef.current,
      newEpisodeId: episodeId,
      realDuration,
      videoCurrentTime: videoRef.current?.currentTime,
    })

    prevEpisodeIdRef.current = episodeId || ''

    setRealDuration(0)
    setSeekOffset(0)
    setCurrentTime(0)
    setIsPlaying(false)
    setShowError(false)
    setVodError(false)
    setAudioTracks([])
    setSubtitleTracks([])
    setSelectedAudio(null)
    setSelectedSubtitle('none')

    if (vodErrorTimerRef.current) {
      clearTimeout(vodErrorTimerRef.current)
      vodErrorTimerRef.current = null
    }

    if (videoRef.current) {
      try { videoRef.current.pause() } catch { /* ignore */ }
      try { videoRef.current.currentTime = 0 } catch { /* ignore */ }
      videoRef.current.src = ''
    }
  }, [episodeId, routeType])

  useEffect(() => {
    if (routeType !== 'movie') return

    console.log('[Watch] Movie changed to:', routeId)

    setRealDuration(0)
    setSeekOffset(0)
    setCurrentTime(0)
    setIsPlaying(false)
    setShowError(false)
    setVodError(false)
    setAudioTracks([])
    setSubtitleTracks([])
    setSelectedAudio(null)
    setSelectedSubtitle('none')
    setCurrentStreamUrl('')
    setCurrentContainerExtension('mp4')

    if (vodErrorTimerRef.current) {
      clearTimeout(vodErrorTimerRef.current)
      vodErrorTimerRef.current = null
    }

    if (videoRef.current) {
      try { videoRef.current.pause() } catch { /* ignore */ }
      try { videoRef.current.currentTime = 0 } catch { /* ignore */ }
      videoRef.current.src = ''
      videoRef.current.load()
    }
  }, [routeId, routeType])

  useEffect(() => {
    setStreamSettled(false)
    const timer = setTimeout(() => setStreamSettled(true), 2000)
    return () => clearTimeout(timer)
  }, [currentStreamUrl])

  useEffect(() => {
    setVodError(false)
  }, [currentStreamUrl])

  useEffect(() => {
    setVodError(false)

    if (vodErrorTimerRef.current) {
      clearTimeout(vodErrorTimerRef.current)
      vodErrorTimerRef.current = null
    }
  }, [routeId, episodeId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (currentType === 'episode' && (e.key === 'Escape' || e.key === 'Backspace')) {
        e.preventDefault()
        handleUpBack()
        return
      }

      // Arrow keys ONLY for live channels (zapping)
      if (currentType === 'channel') {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const items = categoryItemsRef.current
          if (items.length === 0) return

          let nextIndex: number
          if (e.key === 'ArrowUp') {
            nextIndex = categoryIndexRef.current > 0
              ? categoryIndexRef.current - 1
              : items.length - 1
          } else {
            nextIndex = categoryIndexRef.current < items.length - 1
              ? categoryIndexRef.current + 1
              : 0
          }

          const nextItem = items[nextIndex]
          if (!nextItem) return
          categoryIndexRef.current = nextIndex
          zapTo(nextItem.data.id)
        }
      }

      // VOD keyboard controls (movies and episodes)
      if (currentType === 'movie' || currentType === 'episode') {
        if (e.key === ' ') {
          e.preventDefault()
          if (videoRef.current) {
            if (videoRef.current.paused) {
              videoRef.current.play().catch(() => {})
            } else {
              videoRef.current.pause()
            }
          }
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          handleSkip(-10)
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          handleSkip(10)
        }
        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault()
          const container = videoContainerRef.current
          if (!document.fullscreenElement) {
            container?.requestFullscreen?.().catch(() => {})
          } else {
            document.exitFullscreen?.().catch(() => {})
          }
        }
        if (e.key === 'm' || e.key === 'M') {
          e.preventDefault()
          if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted
            setIsMuted(videoRef.current.muted)
          }
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [zapTo, handleUpBack, handleSkip, currentType])

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  useEffect(() => {
    return () => {
      clearErrorTimer()
      stopProgressTracking()
    }
  }, [clearErrorTimer, stopProgressTracking])

  // Track detection removed - audio/subtitle UI no longer needed

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentItemId])

  const isLiveChannel = currentType === 'channel'
  const showMainContent = status !== 'error'

  useEffect(() => {
    setShowError(false)
    clearErrorTimer()
  }, [currentStreamUrl, clearErrorTimer])

  useEffect(() => {
    if (!isLiveChannel || !currentStreamUrl) return
    if (showError) return

    const video = videoRef.current
    if (!video) return

    errorTimerRef.current = setTimeout(() => {
      if (video.currentTime === 0) {
        console.log('[Channel] No playback after 12s, showing overlay')
        setShowError(true)
      } else {
        console.log('[Channel] Playing OK at:', video.currentTime)
      }
    }, 12000)

    return () => {
      clearErrorTimer()
    }
  }, [currentStreamUrl, isLiveChannel, showError, clearErrorTimer])

  const initRef = useRef<boolean>(false)
  const locationStateRef = useRef<typeof location.state>(location.state)

  useEffect(() => {
    locationStateRef.current = location.state
  }, [location.state])

  useEffect(() => {
    if (!routeId && !episodeId) {
      navigate('/live')
      return
    }

    const init = async () => {
      if (initRef.current) {
        return
      }
      initRef.current = true

      console.log('[Watch] Init start:', {
        routeType,
        routeId,
        episodeId,
        locationState: locationStateRef.current,
        sourceLoaded: !!getActiveSource(),
      })

      try {
        const source = getActiveSource()
        setActiveSource(source)
        console.log('[Watch] Source resolved:', source?.type, source?.name, '| id:', source?.id)

        if (!source || source.type !== 'xtream') {
          console.warn('[Watch] No Xtream source, navigating to home')
          navigate('/home')
          return
        }

        console.log('[Watch] Source:', source.name ?? 'unknown', '| route:', routeType, routeId ?? episodeId)

        if (episodeId && locationStateRef.current) {
          let episodeState: EpisodeInfo = locationStateRef.current as EpisodeInfo

          if (!episodeState.allEpisodes && episodeState.seriesId) {
            try {
              const seriesInfo = await getSeriesInfo(source.serverUrl, {
                username: source.username,
                password: source.password,
              }, episodeState.seriesId)

              const allEps: EpisodeInfo['allEpisodes'] = []
              for (const [seasonNum, eps] of Object.entries(seriesInfo.episodes)) {
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
              episodeState = { ...episodeState, allEpisodes: allEps }
            } catch (err) {
              console.warn('[Watch] Failed to fetch all episodes:', err)
            }
          }

          if ((episodeState as EpisodeInfo).realDuration) {
            setRealDuration((episodeState as EpisodeInfo).realDuration!)
          }

          await playEpisode(episodeState, source)
          initRef.current = false
          return
        }

        const [channels, movies] = await Promise.all([
          db.channels.where('sourceId').equals(source.id).toArray(),
          db.movies.where('sourceId').equals(source.id).toArray(),
        ])

        const channelItems: WatchableItem[] = channels.map((c) => ({ type: 'channel' as const, data: c }))
        const movieItems: WatchableItem[] = movies.map((m) => ({ type: 'movie' as const, data: m }))

        const allItems: WatchableItem[] = [...channelItems, ...movieItems]
        allItemsRef.current = allItems

        const now = Math.floor(Date.now() / 1000)
        const epgPromises = channels
          .filter((c) => c.epgChannelId)
          .map((c) =>
            getEpgForChannel(c.epgChannelId!, source.id, now).then((result) => ({
              channelId: c.id,
              current: result.current,
            }))
          )
        const epgResults = await Promise.all(epgPromises)
        const newChannelEpg: Record<string, EpgProgram | null> = {}
        for (const r of epgResults) {
          newChannelEpg[r.channelId] = r.current
        }
        setChannelEpg(newChannelEpg)

        if (routeId && routeType) {
          await zapTo(routeId)
        }
        initRef.current = false
      } catch (err) {
        console.error('[Watch] Init error:', err)
        initRef.current = false
      }
    }

    init()

    return () => {
      console.log('[Watch] Cleanup — route changed or unmount')
      initRef.current = false
      destroyPlayer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, routeType, episodeId])

  const episodeSeriesId = routeType === 'episode'
    ? ((location.state as Partial<EpisodeInfo> | null)?.seriesId || currentSeriesIdRef.current)
    : ''

  // Prompt 1: Always fetch real duration on mount for VOD content
  useEffect(() => {
    if (routeType === 'episode') {
      setRealDuration(0)
    }

    async function fetchRealDuration() {
      const source = usePlaylistStore.getState().getActiveSource()
      if (!source || source.type !== 'xtream') return

      try {
        if (routeType === 'movie' && routeId) {
          const match = routeId.match(/movie-(\d+)/)
          if (match) {
            const info = await getVodInfo(source.serverUrl, {
              username: source.username,
              password: source.password,
            }, match[1])
            console.log('[Duration DEBUG]', {
              duration_secs: info?.info?.duration_secs,
              duration: info?.info?.duration,
              duration_type: typeof info?.info?.duration,
              full_info_keys: Object.keys(info?.info ?? {}),
            })

            const fromSecs = Number(info?.info?.duration_secs) || 0
            const fromString = parseDurationString(String(info?.info?.duration ?? ''))
            let dur = Math.max(fromSecs, fromString)

            console.log('[Duration] from secs:', fromSecs, '| from string:', fromString, '| using:', dur)

            if (dur > 0) {
              console.log('[Watch] Fetched movie duration:', dur, 'seconds')
              setRealDuration(dur)
            }
          }
        } else if (routeType === 'episode' && episodeId && episodeSeriesId) {
            console.log('[Duration] Fetching for episode ID:', episodeId)

            const seriesInfo = await getSeriesInfo(source.serverUrl, {
              username: source.username,
              password: source.password,
            }, episodeSeriesId)

            let foundEpisode: { info?: { duration_secs?: number | string }; duration_secs?: number | string; id?: string | number } | null = null
            for (const season of Object.values(seriesInfo?.episodes ?? {})) {
              if (Array.isArray(season)) {
                const ep = (season as Array<{ id: string | number; info?: { duration_secs?: number | string }; duration_secs?: number | string }>).find(e => String(e.id) === String(episodeId))
                if (ep) {
                  foundEpisode = ep
                  break
                }
              }
            }

            if (!foundEpisode) {
              console.warn('[Duration] Episode not found in series info')
              setRealDuration(0)
              return
            }

            const fromSecs = Number(foundEpisode?.info?.duration_secs)
              || Number(foundEpisode?.duration_secs)
              || 0
            const fromString = parseDurationString(String((foundEpisode?.info as { duration?: string } | undefined)?.duration || ''))
            let dur = Math.max(fromSecs, fromString)

            console.log('[Duration] episode from secs:', fromSecs, '| from string:', fromString, '| using:', dur)

            console.log('[Duration] Episode', episodeId, 'duration:', dur, 'seconds')

            if (dur > 0) {
              setRealDuration(dur)
            } else {
              console.log('[Duration] No duration_secs for this episode, will use video.duration')
              setRealDuration(0)
            }
        }
      } catch (err) {
        console.error('[Duration] Failed:', err)
        setRealDuration(0)
      }
    }
    fetchRealDuration()
  }, [routeType, routeId, episodeId, episodeSeriesId, activeSource?.id, location.state])

  useEffect(() => {
    if (currentType === 'channel' || !activeSource || activeSource.type !== 'xtream') return
    if (currentContainerExtension === 'mp4') return

    async function probeTracks() {
      const { id: streamId, type: transcodeType } = extractStreamId(routeType, routeId, episodeId)
      if (!streamId || !transcodeType) return
      const source = activeSource as Awaited<ReturnType<typeof getActiveSource>>
      if (!source || source.type !== 'xtream') return

      try {
        const params = new URLSearchParams({
          serverUrl: source.serverUrl,
          username: source.username,
          password: source.password,
          ext: currentContainerExtension,
        })
        const res = await fetch(`/probe/${transcodeType}/${streamId}?${params}`)
        if (!res.ok) {
          console.warn('[Probe] Failed with status:', res.status)
          return
        }
        const data = await res.json()
        console.log('[Probe] Tracks:', data)
        setAudioTracks(data.audioTracks || [])
        setSubtitleTracks(data.subtitleTracks || [])
        if (data.duration && data.duration > 0) {
          console.log('[Duration] Override with probe duration:', data.duration)
          setRealDuration(Math.floor(data.duration))
        }
        const defaultAudio = data.audioTracks?.find((t: { default: boolean }) => t.default) || data.audioTracks?.[0]
        if (defaultAudio) setSelectedAudio(defaultAudio.index)
      } catch (err) {
        console.warn('[Probe] Error, continuing without track info:', err)
      }
    }
    probeTracks()
  }, [currentType, activeSource, routeType, routeId, episodeId, currentContainerExtension])

  const reloadWithSettings = useCallback((overrides: { audioTrack?: number; subtitleTrack?: string } = {}) => {
    if (!videoRef.current || !activeSource || activeSource.type !== 'xtream') return
    const { id: streamId, type: transcodeType } = extractStreamId(routeType, routeId, episodeId)
    if (!streamId || !transcodeType) return

    const audio = overrides.audioTrack ?? selectedAudio ?? 0
    const sub = overrides.subtitleTrack ?? selectedSubtitle
    const currentPos = (videoRef.current.currentTime || 0) + (seekOffset || 0)

    const params = new URLSearchParams({
      serverUrl: activeSource.serverUrl,
      username: activeSource.username,
      password: activeSource.password,
      ext: currentContainerExtension,
      seek: String(Math.floor(currentPos)),
    })
    if (audio !== null) params.set('audioTrack', String(audio))
    if (sub !== 'none') params.set('subtitleTrack', String(sub))

    const newUrl = `/transcode/${transcodeType}/${streamId}?${params}`
    console.log('[TRACKS] Reloading with:', newUrl.replace(/password=[^&]+/, 'password=[HIDDEN]'))

    setSeekOffset(currentPos)
    setCurrentStreamUrl(newUrl)
    seekInProgressRef.current = true
    setTimeout(() => { seekInProgressRef.current = false }, 3000)
    videoRef.current.src = newUrl
    videoRef.current.load()
    videoRef.current.play().catch(() => {})
  }, [activeSource, routeType, routeId, episodeId, currentContainerExtension, selectedAudio, selectedSubtitle, seekOffset])

  // Prompt 2: Controls auto-hide for VOD
  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false)
      }
    }, 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    }
  }, [])

  const isVod = currentType === 'movie' || currentType === 'episode'

  useEffect(() => {
    if (!isVod || !currentStreamUrl) return
    if (isLoadingNewContent) return

    const video = videoRef.current
    if (!video) return

    if (video.currentSrc !== currentStreamUrl && video.src !== currentStreamUrl) return

    console.log('[VOD] Starting 25s error timer for:', currentStreamUrl)

    vodErrorTimerRef.current = setTimeout(() => {
      if (video.currentTime === 0) {
        console.log('[VOD] No playback after 25s, showing error')
        safeSetVodError(true)
      } else {
        console.log('[VOD] Playing OK, currentTime:', video.currentTime)
      }
    }, 25000)

    const onPlaying = () => {
      if (vodErrorTimerRef.current) {
        console.log('[VOD] Video playing, cancelling error timer')
        clearTimeout(vodErrorTimerRef.current)
        vodErrorTimerRef.current = null
      }
    }

    const onTimeUpdate = () => {
      if (video.currentTime > 0.5 && vodErrorTimerRef.current) {
        clearTimeout(vodErrorTimerRef.current)
        vodErrorTimerRef.current = null
      }
    }

    video.addEventListener('playing', onPlaying)
    video.addEventListener('timeupdate', onTimeUpdate)

    return () => {
      if (vodErrorTimerRef.current) {
        clearTimeout(vodErrorTimerRef.current)
        vodErrorTimerRef.current = null
      }
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('timeupdate', onTimeUpdate)
    }
  }, [currentStreamUrl, isVod, isLoadingNewContent])

  useEffect(() => {
    if (!isVod) return

    const video = videoRef.current
    if (!video) return

    let errorDelayTimer: ReturnType<typeof setTimeout> | null = null

    const onError = () => {
      if (errorDelayTimer) {
        clearTimeout(errorDelayTimer)
      }

      errorDelayTimer = setTimeout(() => {
        if (video.error && video.currentTime === 0) {
          console.log('[VOD] Persistent error after 3s, showing overlay')
          safeSetVodError(true)
        }
      }, 3000)
    }

    const onPlaying = () => {
      if (errorDelayTimer) {
        clearTimeout(errorDelayTimer)
        errorDelayTimer = null
      }
      setVodError(false)
    }

    video.addEventListener('error', onError)
    video.addEventListener('playing', onPlaying)

    return () => {
      if (errorDelayTimer) {
        clearTimeout(errorDelayTimer)
      }
      video.removeEventListener('error', onError)
      video.removeEventListener('playing', onPlaying)
    }
  }, [isVod])

  return (
    <div className="h-[100dvh] overflow-hidden bg-slate-950 flex flex-col select-none">
      {/* Top Navigation Bar - Fixed height 56px */}
      <header className="flex-shrink-0 h-14 flex items-center gap-2 sm:gap-4 px-2 sm:px-4 border-b border-slate-800 bg-slate-900">
        <button
          onClick={handleUpBack}
          className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-sm sm:text-base font-medium hidden sm:inline">Back</span>
        </button>
        <div className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0">
          <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-white truncate">{itemName || 'Loading...'}</h1>
          {videoInfo && (
            <span className="text-slate-500 text-xs sm:text-sm font-mono flex-shrink-0">
              {videoInfo.width}x{videoInfo.height}
              {videoInfo.fps > 0 && ` @ ${videoInfo.fps}fps`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            aria-label={isSidebarOpen ? 'Hide channel list' : 'Show channel list'}
          >
            {isSidebarOpen ? <Tv2 className="w-5 h-5" /> : <List className="w-5 h-5" />}
          </button>
          <button
            onClick={handlePrevChannel}
            className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            aria-label="Previous channel"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleFavoriteToggle}
            className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-red-500 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            aria-label="Toggle favorite"
          >
            <Heart className={`w-5 h-5 ${activeSource && currentItemId && isFavorite(currentType === 'channel' ? 'channel' : currentType === 'movie' ? 'movie' : 'episode', currentItemId) ? 'fill-current text-red-500' : ''}`} />
          </button>
          <button
            onClick={handleNextChannel}
            className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            aria-label="Next channel"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={handleFullscreenToggle}
            className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Error state - dark centered panel */}
      {status === 'error' && (
        <div className="flex-1 flex items-center justify-center bg-slate-950">
          <div className="text-center max-w-md px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Media not found</h2>
            <p className="text-slate-400 text-sm mb-6">{errorMsg || 'The requested content could not be loaded.'}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate('/home')}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[48px]"
              >
                Back to Home
              </button>
              <button
                onClick={() => navigate('/live')}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[48px]"
              >
                Go to Live TV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area - Full remaining height */}
      {showMainContent && (
        <div
          className={`flex-1 flex flex-col lg:flex-row ${currentType === 'movie' ? 'overflow-y-auto lg:overflow-hidden' : 'overflow-hidden'}`}
          style={{ height: 'calc(100dvh - 56px)' }}
        >
          {/* Left Side - Video + Controls + Status */}
          <div className={`${currentType === 'movie' ? 'flex-shrink-0 lg:flex-1' : 'flex-1'} flex flex-col overflow-hidden min-h-0`}>
            {/* Video Container - flex-1 to take remaining space */}
            <div className="flex-1 min-h-0 overflow-hidden p-2">
              <div
                ref={videoContainerRef}
                className="relative w-full h-full flex items-center justify-center bg-black rounded border-slate-700"
                style={isFullscreen ? { width: '100vw', height: '100vh', borderRadius: 0 } : undefined}
                onMouseMove={currentType !== 'channel' ? resetControlsTimer : undefined}
                onMouseLeave={currentType !== 'channel' ? () => { if (videoRef.current && !videoRef.current.paused) setShowControls(false) } : undefined}
              >
                <video
                  ref={videoRef}
                  playsInline
                  className="w-full h-full object-contain"
                  onTimeUpdate={(e) => {
                    const videoEl = e.currentTarget
                    const ct = videoEl.currentTime + seekOffset
                    const displayDur = realDuration || videoEl.duration || 0
                    setCurrentTime(ct)
                    if (isVod && ct > 0) {
                      watchedItemRef.current = {
                        itemType: currentType === 'movie' ? 'movie' : 'episode',
                        itemId: currentType === 'movie' ? (routeId || null) : (episodeId || null),
                        sourceId: activeSource?.id || null,
                        currentTime: ct,
                        duration: displayDur,
                      }
                    }
                    const prog = displayDur > 0 ? (ct / displayDur) * 100 : 0
                    const bar = document.getElementById('watch-progress-bar') as HTMLDivElement | null
                    if (bar) bar.style.width = `${prog}%`
                    if (videoEl.buffered.length > 0) {
                      const buffered = videoEl.buffered.end(videoEl.buffered.length - 1)
                      const bufPct = displayDur > 0 ? (buffered / displayDur) * 100 : 0
                      setBufferedPercent(bufPct)
                      const bufBar = document.getElementById('watch-buffered-bar') as HTMLDivElement | null
                      if (bufBar) bufBar.style.width = `${bufPct}%`
                    }
                  }}
                  onWaiting={() => setIsBuffering(true)}
                  onPlaying={() => { setIsBuffering(false); setIsPlaying(true) }}
                  onPause={() => setIsPlaying(false)}
                  onSeeking={() => console.log('[SEEK] seeking event, readyState:', videoRef.current?.readyState)}
                  onSeeked={() => console.log('[SEEK] seeked event, currentTime:', videoRef.current?.currentTime)}
                  onLoadedMetadata={(e) => {
                    const dd = realDuration || e.currentTarget.duration || 0
                    const durEl = document.getElementById('watch-duration')
                    if (durEl) durEl.textContent = formatTime(dd)
                  }}
                  onClick={() => {
                    if (videoRef.current) {
                      if (videoRef.current.paused) {
                        videoRef.current.play().catch(() => {})
                      } else {
                        videoRef.current.pause()
                      }
                    }
                  }}
                />

                {/* Buffering spinner */}
                {isBuffering && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <Loader2 className="w-12 h-12 text-white animate-spin" />
                  </div>
                )}

                {/* VOD CONTROLS OVERLAY - only for movies/episodes */}
                {currentType !== 'channel' && (
                  <>
                    {/* Center play/pause button - visible when paused or controls shown */}
                    {(!isPlaying || showControls) && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (videoRef.current) {
                              if (videoRef.current.paused) {
                                videoRef.current.play().catch(() => {})
                              } else {
                                videoRef.current.pause()
                              }
                            }
                          }}
                          className={`pointer-events-auto w-16 h-16 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${isPlaying && showControls ? 'opacity-60' : 'opacity-100'}`}
                        >
                          {isPlaying ? (
                            <Pause className="w-8 h-8 text-white" />
                          ) : (
                            <Play className="w-8 h-8 text-white ml-1" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Rest of controls (auto-hide) */}
                    <div
                      className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                      style={{ pointerEvents: showControls ? 'auto' : 'none' }}
                    >
                      {/* Top gradient + title */}
                      <div className="flex items-start justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
                        <span className="text-white text-sm font-medium truncate max-w-[60%]">{itemName}</span>
                        <div className="flex items-center gap-2 text-white text-sm font-mono">
                          <span id="watch-current-time">{formatTime(currentTime)}</span>
                          <span className="text-white/50">/</span>
                          <span id="watch-duration">{formatTime(realDuration || videoRef.current?.duration || 0)}</span>
                        </div>
                      </div>

                      {/* Bottom controls */}
                      <div className="px-4 py-3 bg-gradient-to-t from-black/90 to-transparent">
{/* Seek bar */}
                        <div
                          className="flex items-center gap-2 mb-2 py-2 cursor-pointer"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            const doSeek = (ev: MouseEvent) => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
                              const displayDur = realDuration || videoRef.current?.duration || 0
                              const target = pct * displayDur
                              if (!videoRef.current) return
                              const source = activeSource
                              if (!source || source.type !== 'xtream') return
                              const { id: streamId, type: transcodeType } = extractStreamId(routeType, routeId, episodeId)
                              if (!streamId || !transcodeType) return

                              console.log('=== SEEK START ===')
                              console.log('[SEEK] Target:', target, 'pct:', pct, 'duration:', displayDur)
                              console.log('[SEEK] Current video src:', videoRef.current.src)
                              console.log('[SEEK] Video readyState:', videoRef.current.readyState)
                              console.log('[SEEK] Seekable ranges:', videoRef.current.seekable?.length)
                              console.log('[SEEK] Container ext:', currentContainerExtension)
                              console.log('[SEEK] StreamId:', streamId, 'transcodeType:', transcodeType)

                              const transcodeUrl = buildTranscodeUrl(source, streamId, currentContainerExtension, transcodeType, target)
                              console.log('[SEEK] New transcode URL:', transcodeUrl)

setSeekOffset(target)
                               setCurrentStreamUrl(transcodeUrl)
                               seekInProgressRef.current = true
                               setTimeout(() => { seekInProgressRef.current = false }, 3000)
                               videoRef.current.src = transcodeUrl
                               videoRef.current.load()
                               videoRef.current.play().catch((err) => {
                                 if (err instanceof Error && err.name === 'AbortError') return
                                 console.error('[SEEK] Play failed:', err)
                               })
                            }
                            const doSeekWrapper = (ev: MouseEvent) => { ev.stopPropagation(); doSeek(ev) }
                            const onUp = () => {
                              document.removeEventListener('mousemove', doSeekWrapper)
                              document.removeEventListener('mouseup', onUp)
                            }
                            document.addEventListener('mousemove', doSeekWrapper)
                            document.addEventListener('mouseup', onUp)
                            doSeek(e.nativeEvent)
                          }}
                        >
                          <span className="text-xs text-white/60 w-10 text-right select-none">
                            {formatTime(currentTime)}
                          </span>
                          <div className="flex-1 h-1.5 bg-white/20 rounded-full relative group">
                            <div
                              className="absolute left-0 top-0 h-full bg-white/30 rounded-full pointer-events-none"
                              style={{ width: `${bufferedPercent}%` }}
                            />
                            <div
                              id="watch-progress-bar"
                              className="absolute left-0 top-0 h-full bg-indigo-500 rounded-full pointer-events-none"
                              style={{ width: `${realDuration > 0 ? (currentTime / realDuration) * 100 : 0}%` }}
                            />
                          </div>
<span className="text-xs text-white/60 w-10 select-none">
                            {formatTime(realDuration || videoRef.current?.duration || 0)}
                          </span>
                        </div>

                        {/* Bottom row */}
                        <div className="flex items-center gap-3">
<button
                             onClick={(e) => {
                               e.stopPropagation()
                               handleSkip(-10)
                             }}
                             className="text-white/70 hover:text-white p-1"
                             aria-label="Rewind 10s"
                           >
                             <SkipBack className="w-5 h-5" />
                           </button>
                           <button
                             onClick={(e) => {
                               e.stopPropagation()
                               if (videoRef.current) {
                                 if (videoRef.current.paused) {
                                   videoRef.current.play().catch(() => {})
                                 } else {
                                   videoRef.current.pause()
                                 }
                               }
                             }}
                             className="text-white/70 hover:text-white p-1"
                             aria-label={isPlaying ? 'Pause' : 'Play'}
                           >
                             {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                           </button>
                           <button
                             onClick={(e) => {
                               e.stopPropagation()
                               handleSkip(10)
                             }}
                             className="text-white/70 hover:text-white p-1"
                             aria-label="Forward 10s"
                           >
                             <SkipForward className="w-5 h-5" />
                          </button>
                          <div className="flex items-center gap-2 ml-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (videoRef.current) {
                                  videoRef.current.muted = !videoRef.current.muted
                                  setIsMuted(videoRef.current.muted)
                                }
                              }}
                              className="text-white/70 hover:text-white p-1"
                              aria-label={isMuted ? 'Unmute' : 'Mute'}
                            >
                              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                            </button>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={isMuted ? 0 : volume}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value)
                                setVolume(v)
                                if (videoRef.current) {
                                  videoRef.current.volume = v
                                  videoRef.current.muted = v === 0
                                  setIsMuted(v === 0)
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-20 h-1 accent-indigo-500 cursor-pointer"
                            />
                          </div>
                          <div className="flex-1" />
                          {(audioTracks.length > 0 || subtitleTracks.length > 0) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings) }}
                              className="text-white/70 hover:text-white p-1"
                              aria-label="Audio & subtitle settings"
                            >
                              <Settings className="w-5 h-5" />
                            </button>
                          )}
                          <button
                             onClick={(e) => {
                               e.stopPropagation()
                               const container = videoContainerRef.current
                               if (!container) return
                               if (!document.fullscreenElement) {
                                 container.requestFullscreen?.().catch(() => {})
                               } else {
                                 document.exitFullscreen?.().catch(() => {})
                               }
                             }}
                             className="text-white/70 hover:text-white p-1"
                             aria-label="Toggle fullscreen"
                           >
                            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {showSettings && (
                        <div className="absolute bottom-full right-4 mb-2 bg-slate-900 border border-slate-700 rounded-lg p-4 min-w-[260px] z-50 shadow-xl">
                          {audioTracks.length > 0 && (
                            <div className="mb-4">
                              <p className="text-xs uppercase text-slate-400 mb-2 tracking-wide">Audio</p>
                              {audioTracks.map((track) => (
                                <button
                                  key={track.index}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedAudio(track.index)
                                    reloadWithSettings({ audioTrack: track.index })
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                                    selectedAudio === track.index
                                      ? 'bg-indigo-600 text-white'
                                      : 'text-slate-300 hover:bg-slate-800'
                                  }`}
                                >
                                  <span className="text-white">{track.language?.toUpperCase()}</span>
                                  <span className="text-slate-400 ml-2">{track.title}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {subtitleTracks.length > 0 && (
                            <div>
                              <p className="text-xs uppercase text-slate-400 mb-2 tracking-wide">Subtitles</p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedSubtitle('none')
                                  reloadWithSettings({ subtitleTrack: 'none' })
                                }}
                                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors mb-1 ${
                                  selectedSubtitle === 'none'
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-300 hover:bg-slate-800'
                                }`}
                              >
                                Off
                              </button>
                              {subtitleTracks.map((track) => (
                                <button
                                  key={track.index}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedSubtitle(String(track.index))
                                    reloadWithSettings({ subtitleTrack: String(track.index) })
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors mb-1 ${
                                    selectedSubtitle === String(track.index)
                                      ? 'bg-indigo-600 text-white'
                                      : 'text-slate-300 hover:bg-slate-800'
                                  }`}
                                >
                                  <span className="text-white">{track.language?.toUpperCase()}</span>
                                  <span className="text-slate-400 ml-2">{track.title}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Channel error overlay */}
                {showError && isLiveChannel && (
                  <ChannelErrorOverlay
                    onRetry={() => {
                      setShowError(false)
                      if (videoRef.current) {
                        videoRef.current.load()
                        videoRef.current.play().catch(() => {})
                      }
                    }}
                    onPrev={() => {
                      setShowError(false)
                      handlePrevChannel()
                    }}
                    onNext={() => {
                      setShowError(false)
                      handleNextChannel()
                    }}
                  />
                )}
                {vodError && isVod && currentStreamUrl && streamSettled && !isLoadingNewContent && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50 p-6 text-center">
                    <div className="w-16 h-16 mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-red-400" />
                    </div>
                    <p className="text-white text-lg font-medium mb-2">
                      Unable to play this {routeType === 'movie' ? 'movie' : 'episode'}
                    </p>
                    <p className="text-white/60 text-sm mb-6 max-w-md">
                      The stream may be unavailable or the link has expired. Try a different {routeType === 'movie' ? 'movie' : 'episode'} or contact your provider.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium"
                      >
                        Go Back
                      </button>
                      <button
                        onClick={() => {
                          setVodError(false)
                          if (videoRef.current) {
                            videoRef.current.load()
                            videoRef.current.play().catch(() => {})
                          }
                        }}
                        className="px-6 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}
                {status === 'ready-click-to-play' && (
                  <button
                    onClick={handlePlayClick}
                    className="absolute inset-0 flex items-center justify-center bg-black/60 hover:bg-black/50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 z-10"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-500 transition-colors">
                      <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Status Bar - Fixed height 40px */}
            <div className="flex-shrink-0 h-10 px-4 flex items-center justify-between bg-slate-900 border-t border-slate-800">
              <div>
                {status === 'loading' && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                )}
                 {status === 'ready-click-to-play' && (
                   <p className="text-slate-400 text-sm">Click play to start</p>
                 )}
{status === 'playing' && (
                     <>
                       <p className="text-green-400 text-sm">Playing</p>
                       <span className="text-slate-600 mx-1">|</span>
                       <span className="text-slate-400 text-sm font-mono">
                         {formatTime(currentTime)}
                         <span className="text-slate-600 mx-1">/</span>
                         {formatTime(realDuration || videoRef.current?.duration || 0)}
                       </span>
                     </>
                   )}
                  {import.meta.env.DEV && currentType === 'channel' && (
                    <p className="text-[10px] text-slate-500 truncate">
                      {currentItemId} | {lastVideoErrorCode ?? 'ok'}
                    </p>
                  )}
                </div>
                {status === 'playing' && currentType === 'channel' && categoryItems.length > 1 && (
                  <p className="text-slate-500 text-xs hidden sm:block">↑ / ↓ arrows to change channel</p>
                )}
                {status === 'playing' && currentType !== 'channel' && (
                  <p className="text-slate-500 text-xs hidden sm:block">Space = play/pause · ← → = seek 10s · F = fullscreen</p>
                )}
            </div>
          </div>

          {/* Right Sidebar - Episode/Channel List */}
          {isSidebarOpen && categoryItems.length > 0 && (
            <aside
              className={`${currentType === 'movie' ? 'flex-none' : 'flex-1'} lg:flex-initial lg:w-80 flex flex-col bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-700 overflow-hidden`}
              style={currentType === 'movie' ? undefined : { height: 'calc(100dvh - 56px)' }}
            >
              {/* Category Header */}
              <div className="flex-shrink-0 p-3 border-b border-slate-700">
                <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wide truncate">
                  {currentType === 'movie' ? `More from ${categoryName || 'this category'}` : categoryName}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentType === 'episode' ? 'Episode' : currentType === 'channel' ? 'channels' : `${categoryItems.length} more movies`}
                </p>
              </div>
              {/* Scrollable List */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="flex flex-col gap-1 p-2">
                  {categoryItems.map((item) => {
                    if (!item) return null
                    const itemId = item.type === 'episode' ? `episode_${(item.data as EpisodeInfo).streamId}` : item.data.id
                    const isActive = itemId === currentItemId
                    const itemName = getItemName(item)
                    return (
                      <button
                        key={itemId}
                        ref={isActive ? activeItemRef : null}
onClick={() => {
                          if (item.type === 'episode') {
                            navigateToEpisode(item.data as EpisodeInfo)
                          } else if (item.type === 'movie') {
                            navigateToMovie(item.data.id)
                          } else {
                            zapTo(item.data.id)
                          }
                        }}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[48px] w-full ${
                          isActive
                            ? 'bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {item.type === 'channel' && (item.data as ChannelRecord).logoUrl ? (
                          <img
                            src={getProxiedImageUrl((item.data as ChannelRecord).logoUrl)}
                            alt={getItemName(item)}
                            className="w-10 h-10 object-contain rounded bg-slate-800 flex-shrink-0"
                            loading="lazy"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                            }}
                          />
                        ) : item.type === 'movie' && (item.data as MovieRecord).logoUrl ? (
                          <img
                            src={getProxiedImageUrl((item.data as MovieRecord).logoUrl)}
                            alt={getItemName(item)}
                            className="w-12 h-16 lg:w-10 lg:h-10 object-cover rounded bg-slate-800 flex-shrink-0"
                            loading="lazy"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className={`${item.type === 'movie' ? 'w-12 h-16 lg:w-10 lg:h-10' : 'w-10 h-10'} bg-slate-800 rounded flex items-center justify-center flex-shrink-0`}>
                            {item.type === 'channel' ? (
                              <Tv2 size={18} className="text-slate-400" />
                            ) : (
                              <Film size={18} className="text-slate-400" />
                            )}
                          </div>
                        )}
                        <span className="flex-1 text-sm font-medium truncate text-left">{itemName}</span>
                        {item.type === 'channel' && channelEpg[item.data.id] && (
                          <span className="text-xs text-slate-500 truncate max-w-[100px]">
                            Now: {channelEpg[item.data.id]?.title}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  )
}
