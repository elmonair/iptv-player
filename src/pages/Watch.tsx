import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Loader2, Maximize2, Minimize2, List, Tv2, ChevronLeft, ChevronRight, Film, Heart } from 'lucide-react'
import mpegts from 'mpegts.js'
import Hls from 'hls.js'
import { db } from '../lib/db'
import { usePlaylistStore } from '../stores/playlistStore'
import { useBrowseStore } from '../stores/browseStore'
import { useFavoritesStore } from '../stores/favoritesStore'
import { useWatchHistoryStore } from '../stores/watchHistoryStore'
import { getSeriesInfo } from '../lib/xtream'
import { getEpgForChannel } from '../lib/epgParser'
import type { ChannelRecord, MovieRecord } from '../lib/db'
import type { EpgProgram } from '../lib/epgParser'
import { getProxiedImageUrl } from '../lib/imageProxy'

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

export default function Watch() {
  const { id: routeId, episodeId } = useParams<{ id: string; episodeId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<ReturnType<typeof mpegts.createPlayer> | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const currentStreamUrlRef = useRef<string>('')
  const allItemsRef = useRef<WatchableItem[]>([])
  const categoryItemsRef = useRef<WatchableItem[]>([])
  const categoryIndexRef = useRef<number>(-1)
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoAdvanceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeItemRef = useRef<HTMLButtonElement>(null)
  const hasResumedRef = useRef(false)
  const handleChannelUnavailableRef = useRef<(message: string) => void>(() => {})

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
  const [autoAdvanceSeconds, setAutoAdvanceSeconds] = useState<number | null>(null)
  const [channelEpg, setChannelEpg] = useState<Record<string, EpgProgram | null>>({})

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

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current)
      autoAdvanceTimeoutRef.current = null
    }
    if (autoAdvanceIntervalRef.current) {
      clearInterval(autoAdvanceIntervalRef.current)
      autoAdvanceIntervalRef.current = null
    }
    setAutoAdvanceSeconds(null)
  }, [])

  const clearChannelErrorTimeout = useCallback(() => {
    if (channelErrorTimeoutRef.current) {
      clearTimeout(channelErrorTimeoutRef.current)
      channelErrorTimeoutRef.current = null
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
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current)
      autoAdvanceTimeoutRef.current = null
    }
    if (autoAdvanceIntervalRef.current) {
      clearInterval(autoAdvanceIntervalRef.current)
      autoAdvanceIntervalRef.current = null
    }
    setAutoAdvanceSeconds(null)
    setVideoInfo(null)
    if (channelErrorTimeoutRef.current) {
      clearTimeout(channelErrorTimeoutRef.current)
      channelErrorTimeoutRef.current = null
    }
  }, [])

  const startProgressTracking = useCallback((itemType: 'channel' | 'movie' | 'episode', itemId: string) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }
    if (!activeSource) return
    if (itemType === 'channel') return

    const saveProgress = () => {
      if (!videoRef.current || !activeSource) return
      const currentTime = videoRef.current.currentTime
      const duration = videoRef.current.duration
      updateWatchProgress(itemType, itemId, activeSource.id, currentTime, duration)
    }

    progressIntervalRef.current = setInterval(saveProgress, 10000)
  }, [activeSource, updateWatchProgress])

  const handleLoadedMetadata = useCallback((savedProgress?: { position: number } | null) => {
    if (hasResumedRef.current) return
    if (!videoRef.current) return

    const videoEl = videoRef.current
    const saved = savedProgress?.position || 0
    const duration = videoEl.duration

    if (saved > 5 && Number.isFinite(duration) && saved < duration * 0.9) {
      videoEl.currentTime = saved
    }

    hasResumedRef.current = true
  }, [])

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
      if (import.meta.env.PROD) {
        return buildMovieProxyUrl(source as { id: string; serverUrl: string; username: string; password: string }, String(movie.streamId), ext)
      }
      return `${source.serverUrl}/movie/${source.username}/${source.password}/${movie.streamId}.${ext}`
    } else if (item.type === 'episode') {
      const episode = item.data as EpisodeInfo
      const ext = episode.containerExtension || 'mkv'
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

  const playEpisode = useCallback(async (episodeInfo: EpisodeInfo) => {
    if (!videoRef.current) return

    const source = activeSource
    if (!source || source.type !== 'xtream') return

    destroyPlayer()

    const episodeItem: WatchableItem = { type: 'episode', data: episodeInfo }
    const episodeName = `S${episodeInfo.seasonNumber}E${episodeInfo.episodeNumber} - ${episodeInfo.episodeTitle}`

    console.log('[Watch] Playing episode:', episodeName)
    setItemName(episodeName)
    setCurrentItemId(`episode_${episodeInfo.streamId}`)
    setCurrentType('episode')
    setStatus('loading')
    setErrorMsg(null)
    setLastVideoErrorCode(null)
    setVideoInfo(null)
    setCategoryName(episodeInfo.seriesName)

    let sidebarEpisodes: WatchableItem[] = [episodeItem]
    if (episodeInfo.allEpisodes && episodeInfo.allEpisodes.length > 0) {
      sidebarEpisodes = episodeInfo.allEpisodes.map((ep) => ({
        type: 'episode' as const,
        data: {
          id: String(ep.id),
          seriesId: episodeInfo.seriesId,
          seriesName: episodeInfo.seriesName,
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
    setupVideoSource(videoEl, streamUrl)

    const episodeId = String(episodeInfo.streamId)
    const history = getWatchHistory()
    const savedProgress = history.find(h => h.itemType === 'episode' && h.itemId === episodeId)

    if (savedProgress && savedProgress.position > 0) {
      console.log('[Watch] Found saved progress for episode:', savedProgress.position)
    }

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
      startProgressTracking('episode', episodeId)
    }
    videoEl.onerror = () => {
      if (!currentStreamUrlRef.current) {
        return
      }
      console.error('[Watch] Episode video error:', videoEl.error)
      setStatus('error')
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
        setStatus('error')
        setErrorMsg(err instanceof Error ? err.message : String(err))
      }
    }
  }, [destroyPlayer, getWatchHistory, startProgressTracking, handleLoadedMetadata])

  const zapTo = useCallback(async (targetItemId: string) => {
    if (!targetItemId || !videoRef.current) return

    const source = activeSource
    if (!source || source.type !== 'xtream') {
      console.warn('[Watch] zapTo called without valid Xtream source')
      return
    }

    clearChannelErrorTimeout()
    clearAutoAdvanceTimer()
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
    setStatus('loading')
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
        let hasRetried = false

        player.on(mpegts.Events.ERROR, (_type: string, _detail: string, info: { message?: string }) => {
          if (!currentStreamUrlRef.current) return

          const v = videoRef.current
          if (v && v.readyState >= 2 && !v.paused && v.currentTime > 0) return

          if (_type === mpegts.ErrorTypes.NETWORK_ERROR && !hasRetried) {
            hasRetried = true
            setTimeout(() => {
              try {
                player.unload()
                player.load()
                void player.play()
              } catch {
                handleChannelUnavailableRef.current('Channel temporarily unavailable')
              }
            }, 2000)
            return
          }
          const message = info?.message ?? 'Player error occurred'
          const lowerMessage = message.toLowerCase()
          if (lowerMessage.includes('502') || lowerMessage.includes('503') || lowerMessage.includes('bad gateway')) {
            handleChannelUnavailableRef.current('Channel temporarily unavailable')
          } else if (lowerMessage.includes('timeout') || lowerMessage.includes('not responding')) {
            handleChannelUnavailableRef.current('Channel not responding')
          } else if (lowerMessage.includes('failed to fetch')) {
            handleChannelUnavailableRef.current('Channel temporarily unavailable')
          } else {
            handleChannelUnavailableRef.current(message)
          }
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
            clearChannelErrorTimeout()
            clearAutoAdvanceTimer()
            setStatus('playing')
            setLastChannelId(item.data.id)
          } catch (err) {
            if (err instanceof Error && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
              setStatus('ready-click-to-play')
            } else {
              handleChannelUnavailableRef.current(err instanceof Error ? err.message : String(err))
            }
          }
        }
        videoEl.onloadedmetadata = null
        videoEl.onplaying = () => {
          clearChannelErrorTimeout()
          clearAutoAdvanceTimer()
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

          const v = videoRef.current
          if (v && v.readyState >= 2 && !v.paused && v.currentTime > 0) return

          setLastVideoErrorCode(videoEl.error?.code ?? null)
          const errCode = videoEl.error?.code ?? 0
          if (errCode === 4) {
            handleChannelUnavailableRef.current('Format not supported')
          } else {
            handleChannelUnavailableRef.current('Channel temporarily unavailable')
          }
        }
      } else {
        videoEl.src = streamUrl
      }
    } else {
      // Movie — use HLS.js for m3u8 streams, native for others
      setupVideoSource(videoEl, streamUrl)

      const movieId = (item.data as MovieRecord).id
      const history = getWatchHistory()
      const savedProgress = history.find(h => h.itemType === 'movie' && h.itemId === movieId)

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
        startProgressTracking('movie', movieId)
      }
      videoEl.onerror = () => {
        if (!currentStreamUrl) return
        console.error('[Watch] Movie video error:', videoEl.error?.code, videoEl.error?.message)
        setStatus('error')
        const errCode = videoEl.error?.code ?? 0
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
          setStatus('error')
          setErrorMsg(err instanceof Error ? err.message : String(err))
        }
      }
    }
  }, [destroyPlayer, getWatchHistory, startProgressTracking, handleLoadedMetadata, setLastChannelId, clearChannelErrorTimeout, clearAutoAdvanceTimer])

  const handleFullscreenToggle = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  const handlePrevChannel = useCallback(() => {
    clearAutoAdvanceTimer()
    const items = categoryItemsRef.current
    if (items.length === 0) return

    const nextIndex = categoryIndexRef.current > 0
      ? categoryIndexRef.current - 1
      : items.length - 1

    const nextItem = items[nextIndex]
    if (!nextItem) return
    categoryIndexRef.current = nextIndex
    zapTo(nextItem.data.id)
  }, [clearAutoAdvanceTimer, zapTo])

  const handleNextChannel = useCallback(() => {
    clearAutoAdvanceTimer()
    const items = categoryItemsRef.current
    if (items.length === 0) return

    const nextIndex = categoryIndexRef.current < items.length - 1
      ? categoryIndexRef.current + 1
      : 0

    const nextItem = items[nextIndex]
    if (!nextItem) return
    categoryIndexRef.current = nextIndex
    zapTo(nextItem.data.id)
  }, [clearAutoAdvanceTimer, zapTo])

  const startAutoAdvanceTimer = useCallback(() => {
    clearAutoAdvanceTimer()
    setAutoAdvanceSeconds(5)

    autoAdvanceIntervalRef.current = setInterval(() => {
      setAutoAdvanceSeconds((prev) => {
        if (prev === null) return null
        return prev > 0 ? prev - 1 : 0
      })
    }, 1000)

    autoAdvanceTimeoutRef.current = setTimeout(() => {
      handleNextChannel()
    }, 5000)
  }, [clearAutoAdvanceTimer, handleNextChannel])

  const handleChannelUnavailable = useCallback((message: string) => {
    if (channelErrorTimeoutRef.current) {
      clearTimeout(channelErrorTimeoutRef.current)
    }

    channelErrorTimeoutRef.current = setTimeout(() => {
      if (!currentStreamUrlRef.current) return
      setStatus('error')
      setErrorMsg(message)
      startAutoAdvanceTimer()
    }, 3000)
  }, [startAutoAdvanceTimer])

  handleChannelUnavailableRef.current = handleChannelUnavailable

  useEffect(() => {
    hasResumedRef.current = false
  }, [currentItemId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (currentType === 'episode' && (e.key === 'Escape' || e.key === 'Backspace')) {
        e.preventDefault()
        handleUpBack()
        return
      }

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

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [zapTo, handleUpBack])

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  useEffect(() => {
    return () => {
      clearAutoAdvanceTimer()
      clearChannelErrorTimeout()
      stopProgressTracking()
    }
  }, [clearAutoAdvanceTimer, clearChannelErrorTimeout, stopProgressTracking])

  // Track detection removed - audio/subtitle UI no longer needed

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentItemId])

  const isChannelError = status === 'error' && currentType === 'channel'
  const showMainContent = status !== 'error' || isChannelError

  const initRef = useRef<boolean>(false)

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

      try {
        const source = getActiveSource()
        setActiveSource(source)
        if (!source || source.type !== 'xtream') {
          navigate('/home')
          return
        }

        console.log('[Watch] Source:', source.name ?? 'unknown', '| route:', routeType, routeId ?? episodeId)

        if (episodeId && location.state) {
          let episodeState: EpisodeInfo = location.state as EpisodeInfo

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

          await playEpisode(episodeState)
          initRef.current = false
          return
        }

        const [channels, movies] = await Promise.all([
          db.channels.where('sourceId').equals(source.id).toArray(),
          db.movies.where('sourceId').equals(source.id).toArray(),
        ])

        const channelItems: WatchableItem[] = channels.map((c) => ({ type: 'channel' as const, data: c }))
        const movieItems: WatchableItem[] = movies.map((m) => ({ type: 'movie' as const, data: m }))

        const allItems: WatchableItem[] = [...channelItems, ...movieItems].sort((a, b) =>
          getItemName(a).localeCompare(getItemName(b))
        )
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
      initRef.current = false
      destroyPlayer()
    }
  }, [routeId, routeType, episodeId, navigate, zapTo, playEpisode, destroyPlayer, location])

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
      {status === 'error' && !isChannelError && (
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
                className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500/50 min-h-[48px]"
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
              <div className="relative w-full h-full flex items-center justify-center bg-black rounded border-slate-700">
                <video
                  ref={videoRef}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
                {isChannelError && (
                  <div
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center"
                    style={{
                      background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.85) 100%)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      animation: 'channelErrorFadeIn 0.3s ease-out',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative w-20 h-20">
                        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
                          <circle
                            cx="32" cy="32" r="30"
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="2"
                          />
                          {autoAdvanceSeconds !== null && (
                            <circle
                              cx="32" cy="32" r="30"
                              fill="none"
                              stroke="rgba(255,255,255,0.6)"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeDasharray="188.5"
                              strokeDashoffset="0"
                              style={{
                                animation: 'countdownRing 5s linear forwards',
                              }}
                            />
                          )}
                        </svg>
                        {autoAdvanceSeconds !== null && (
                          <span
                            className="absolute inset-0 flex items-center justify-center text-white text-2xl font-light"
                            style={{ fontFamily: "'DM Sans', sans-serif" }}
                          >
                            {autoAdvanceSeconds}
                          </span>
                        )}
                      </div>

                      <p className="text-white/80 text-sm font-light tracking-wide">
                        Channel unavailable
                      </p>
                      {autoAdvanceSeconds !== null && (
                        <p className="text-white/40 text-xs font-light">
                          Switching in {autoAdvanceSeconds}s
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={handlePrevChannel}
                          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-white/30"
                          aria-label="Previous channel"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            clearAutoAdvanceTimer()
                            zapTo(currentItemId)
                          }}
                          className="px-5 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-sm font-light tracking-wide transition-all focus:outline-none focus:ring-2 focus:ring-white/30"
                        >
                          Retry
                        </button>
                        <button
                          onClick={handleNextChannel}
                          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-white/30"
                          aria-label="Next channel"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
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
                    <p className="text-green-400 text-sm">Playing</p>
                  )}
                  {import.meta.env.DEV && currentType === 'channel' && (
                    <p className="text-[10px] text-slate-500 truncate">
                      {currentItemId} | {lastVideoErrorCode ?? 'ok'}
                    </p>
                  )}
                </div>
              {status === 'playing' && categoryItems.length > 1 && (
                <p className="text-slate-500 text-xs hidden sm:block">↑ / ↓ arrows to change</p>
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
                            const ep = item.data as EpisodeInfo
                            navigate(`/watch/episode/${ep.streamId}`, {
                              state: ep,
                            })
                          } else if (item.type === 'movie') {
                            navigate(`/watch/movie/${encodeURIComponent(item.data.id)}`)
                          } else {
                            const ch = item.data as ChannelRecord
                            navigate(`/watch/live/${encodeURIComponent(ch.id)}`)
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
