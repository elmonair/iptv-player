import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Loader2, Maximize2, Minimize2, List, Tv2, ChevronLeft, ChevronRight, Film, Heart, Volume2, Subtitles, Check, X } from 'lucide-react'
import mpegts from 'mpegts.js'
import { db } from '../lib/db'
import { usePlaylistStore } from '../stores/playlistStore'
import { useBrowseStore } from '../stores/browseStore'
import { useFavoritesStore } from '../stores/favoritesStore'
import { useWatchHistoryStore } from '../stores/watchHistoryStore'
import { getSeriesInfo } from '../lib/xtream'
import type { ChannelRecord, MovieRecord } from '../lib/db'

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

export default function Watch() {
  const { channelId, episodeId } = useParams<{ channelId: string; episodeId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<ReturnType<typeof mpegts.createPlayer> | null>(null)
  const allItemsRef = useRef<WatchableItem[]>([])
  const categoryItemsRef = useRef<WatchableItem[]>([])
  const categoryIndexRef = useRef<number>(-1)
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeItemRef = useRef<HTMLButtonElement>(null)
  const hasResumedRef = useRef(false)

  const [status, setStatus] = useState<WatchStatus>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [itemName, setItemName] = useState<string>('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [videoInfo, setVideoInfo] = useState<{ width: number; height: number; fps: number } | null>(null)
  const [categoryItems, setCategoryItems] = useState<WatchableItem[]>([])
  const [categoryName, setCategoryName] = useState<string>('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [currentItemId, setCurrentItemId] = useState<string>('')
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null)
  const [currentType, setCurrentType] = useState<'channel' | 'movie' | 'episode'>('channel')
  const [activeSource, setActiveSource] = useState<Awaited<ReturnType<typeof getActiveSource>> | null>(null)
  const [audioTracks, setAudioTracks] = useState<Array<{ id: number; label: string; language?: string; enabled: boolean }>>([])
  const [subtitleTracks, setSubtitleTracks] = useState<Array<{ id: number; label: string; language?: string; enabled: boolean }>>([])
  const [showAudioMenu, setShowAudioMenu] = useState(false)
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false)
  const audioMenuRef = useRef<HTMLDivElement>(null)
  const subtitleMenuRef = useRef<HTMLDivElement>(null)

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

  const destroyPlayer = useCallback(() => {
    const player = playerRef.current
    if (player) {
      try { player.pause() } catch { /* ignore */ }
      try { player.unload() } catch { /* ignore */ }
      try { player.detachMediaElement() } catch { /* ignore */ }
      try { player.destroy() } catch { /* ignore */ }
      playerRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.src = ''
    }
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current)
      statsIntervalRef.current = null
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    setVideoInfo(null)
  }, [])

  const startProgressTracking = useCallback((itemType: 'channel' | 'movie' | 'episode', itemId: string) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }
    if (!activeSource) return

    const saveProgress = () => {
      if (!videoRef.current || !activeSource) return
      const currentTime = videoRef.current.currentTime
      const duration = videoRef.current.duration
      console.log('[Watch] Saving progress:', { itemType, itemId, sourceId: activeSource.id, currentTime, duration })
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
      console.log('[Watch] Resumed once from position:', saved)
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
      console.error('[Watch] handlePlayClick: videoRef.current is null')
      return
    }
    console.log('[Watch] handlePlayClick: Starting play, video src:', videoRef.current.src)
    try {
      await videoRef.current.play()
      console.log('[Watch] User-initiated play succeeded')
    } catch (err) {
      console.error('[Watch] User-initiated play failed:', err)
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }

  const handleUpBack = useCallback(() => {
    const navState = location.state as { from?: string; tab?: string; categoryId?: string; scrollY?: number; seriesId?: string } | null

    console.log('[Watch Back]', {
      locationState: location.state,
      itemType: currentType,
      itemId: currentItemId,
      from: navState?.from
    })

    // First priority: use the 'from' state if it exists
    if (navState?.from) {
      console.log('[Watch Back] Using from state:', navState.from)
      navigate(navState.from, { replace: true })
      return
    }

    // Second priority: handle specific item types
    if (currentType === 'movie') {
      navigate('/live?tab=movies', { replace: true })
      console.log('[Watch Back] Fallback to /live?tab=movies')
      return
    }

    if (currentType === 'episode' || currentType === 'series') {
      const seriesId = navState?.seriesId
      if (seriesId) {
        navigate(`/series/${encodeURIComponent(seriesId)}`, { replace: true })
        console.log('[Watch Back] Navigate to series detail:', seriesId)
      } else {
        navigate('/live?tab=series', { replace: true })
        console.log('[Watch Back] Fallback to /live?tab=series')
      }
      return
    }

    // Third priority: use browseStore for channels
    if (currentType === 'channel') {
      const ctx = useBrowseStore.getState().exitPlayer()
      if (ctx && ctx.section === 'live') {
        const categoryId = ctx.selectedCategoryId
        const params = new URLSearchParams()
        params.set('tab', 'channels')
        if (categoryId && categoryId !== 'all') {
          params.set('category', categoryId)
        }
        navigate(`/live?${params.toString()}`, { replace: true })
        console.log('[Watch Back] Using browseStore to navigate:', `/live?${params.toString()}`)
        return
      }

      navigate('/live?tab=channels', { replace: true })
      console.log('[Watch Back] Default fallback to /live?tab=channels')
      return
    }

    // Final fallback
    navigate('/live')
  }, [currentType, currentItemId, location.state, navigate])

  const handleAudioTrackSelect = (index: number) => {
    if (!videoRef.current || !videoRef.current.audioTracks) return
    const tracks = videoRef.current.audioTracks
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].enabled = (i === index)
    }
    setAudioTracks(prev => prev.map((track, i) => ({ ...track, enabled: i === index })))
    console.log('[Watch] Selected audio track:', index)
  }

  const handleSubtitleTrackSelect = (index: number) => {
    if (!videoRef.current || !videoRef.current.textTracks) return
    const tracks = videoRef.current.textTracks
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = (i === index) ? 'showing' : 'hidden'
    }
    setSubtitleTracks(prev => prev.map((track, i) => ({ ...track, enabled: i === index })))
    console.log('[Watch] Selected subtitle track:', index)
  }

  const handleToggleSubtitles = () => {
    if (!videoRef.current || !videoRef.current.textTracks) return
    const tracks = videoRef.current.textTracks
    let hasShowing = false
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].mode === 'showing') {
        tracks[i].mode = 'hidden'
        hasShowing = true
      }
    }
    if (!hasShowing && tracks.length > 0) {
      tracks[0].mode = 'showing'
    }
    const updated = Array.from(tracks).map((track, i) => ({
      id: i,
      label: track.label || `Subtitle ${i + 1}`,
      language: track.language,
      enabled: track.mode === 'showing'
    }))
    setSubtitleTracks(updated)
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target as Node)) {
        setShowAudioMenu(false)
      }
      if (subtitleMenuRef.current && !subtitleMenuRef.current.contains(e.target as Node)) {
        setShowSubtitleMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const buildStreamUrl = (source: { serverUrl: string; username: string; password: string }, item: WatchableItem): string => {
    if (!item) return ''
    if (item.type === 'channel') {
      return `${source.serverUrl}/live/${source.username}/${source.password}/${(item.data as { streamId: string }).streamId}.ts`
    } else if (item.type === 'movie') {
      const movie = item.data as MovieRecord
      const ext = movie.containerExtension || 'mp4'
      return `${source.serverUrl}/movie/${source.username}/${source.password}/${movie.streamId}.${ext}`
    } else if (item.type === 'episode') {
      const episode = item.data as EpisodeInfo
      return `${source.serverUrl}/series/${source.username}/${source.password}/${episode.streamId}.${episode.containerExtension}`
    }
    return ''
  }

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
    const safeUrl = streamUrl.replace(source.username, '[USER]').replace(source.password, '[PASS]')
    console.log('[Watch] Episode stream URL:', safeUrl)

    const videoEl = videoRef.current
    videoEl.src = streamUrl

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
      console.error('[Watch] Episode video error:', videoEl.error)
      setStatus('error')
      const errCode = videoEl.error?.code ?? 0
      if (errCode === 4) {
        setErrorMsg('Video format not supported by browser. Copy URL for VLC.')
      } else {
        setErrorMsg('Unable to play episode. Copy URL for VLC.')
      }
    }
    videoEl.onstalled = () => console.log('[Watch] Episode video stalled')

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
    if (!source || source.type !== 'xtream') return

    destroyPlayer()

    let item: WatchableItem = null
    try {
      const channel = await db.channels.where('id').equals(decodeURIComponent(targetItemId)).first()
      if (channel) {
        item = { type: 'channel', data: channel }
      } else {
        const movie = await db.movies.where('id').equals(decodeURIComponent(targetItemId)).first()
        if (movie) {
          item = { type: 'movie', data: movie }
        }
      }
    } catch {
      setStatus('error')
      setErrorMsg('Failed to load item')
      return
    }

    if (!item) {
      setStatus('error')
      setErrorMsg('Item not found')
      return
    }

    const streamId = item.type === 'channel' ? (item.data as ChannelRecord).streamId : (item.data as MovieRecord).streamId
    console.log('[Watch] Zap to:', { type: item.type, name: getItemName(item), streamId, id: item.data.id })
    setItemName(getItemName(item))
    setCurrentItemId(item.data.id)
    setCurrentType(item.type)
    setCurrentCategoryId(item.data.categoryId)
    setStatus('loading')
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
    const safeUrl = streamUrl.replace(source.username, '[USER]').replace(source.password, '[PASS]')
    console.log('[Watch] Stream URL:', safeUrl)

    const videoEl = videoRef.current

    if (item.type === 'channel') {
      if (mpegts.isSupported()) {
        const player = mpegts.createPlayer({
          type: 'mpegts',
          url: streamUrl,
          isLive: true,
        })
        playerRef.current = player

        player.on(mpegts.Events.ERROR, (_type: string, _detail: string, info: { message?: string }) => {
          console.error('[Watch] mpegts ERROR:', _type, _detail, info)
          setStatus('error')
          setErrorMsg(info?.message ?? 'Player error occurred')
        })

        player.on(mpegts.Events.LOADING_COMPLETE, () => {
          console.log('[Watch] mpegts LOADING_COMPLETE')
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

        videoEl.oncanplay = () => {
          if (videoEl.videoWidth && videoEl.videoHeight) {
            setVideoInfo((prev) => ({
              width: videoEl.videoWidth,
              height: videoEl.videoHeight,
              fps: prev?.fps ?? 0,
            }))
          }
        }
        videoEl.onplaying = () => {
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
        videoEl.onstalled = () => console.log('[Watch] video stalled event')
        videoEl.onerror = () => {
          console.error('[Watch] video error:', videoEl.error)
          setStatus('error')
          const errCode = videoEl.error?.code ?? 0
          if (errCode === 4) {
            setErrorMsg('Video format not supported. Try copying URL for VLC.')
          } else {
            setErrorMsg('Video element error')
          }
        }

        try {
          await videoEl.play()
          setStatus('playing')
          setLastChannelId(item.data.id)
        } catch (err) {
          if (err instanceof Error && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
            setStatus('ready-click-to-play')
          } else {
            setStatus('error')
            setErrorMsg(err instanceof Error ? err.message : String(err))
          }
        }
      } else {
        videoEl.src = streamUrl
      }
    } else {
      videoEl.src = streamUrl

      const movieId = (item.data as MovieRecord).id
      const history = getWatchHistory()
      const savedProgress = history.find(h => h.itemType === 'movie' && h.itemId === movieId)

      if (savedProgress && savedProgress.position > 0) {
        console.log('[Watch] Found saved progress for movie:', savedProgress.position)
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
        startProgressTracking('movie', movieId)
      }
      videoEl.onerror = () => {
        console.error('[Watch] Movie video error:', videoEl.error)
        setStatus('error')
        const errCode = videoEl.error?.code ?? 0
        if (errCode === 4) {
          setErrorMsg('Video format not supported by browser. Copy URL for VLC.')
        } else {
          setErrorMsg('Unable to play movie. Copy URL for VLC.')
        }
      }
      videoEl.onstalled = () => console.log('[Watch] Movie video stalled')

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
  }, [destroyPlayer, getWatchHistory, startProgressTracking, handleLoadedMetadata, setLastChannelId])

  const handleFullscreenToggle = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  const handlePrevChannel = useCallback(() => {
    const items = categoryItemsRef.current
    if (items.length === 0) return

    const nextIndex = categoryIndexRef.current > 0
      ? categoryIndexRef.current - 1
      : items.length - 1

    const nextItem = items[nextIndex]
    if (!nextItem) return
    categoryIndexRef.current = nextIndex
    console.log('[Watch] Prev item:', { nextIndex, item: getItemName(nextItem) })
    zapTo(nextItem.data.id)
  }, [zapTo])

  const handleNextChannel = useCallback(() => {
    const items = categoryItemsRef.current
    if (items.length === 0) return

    const nextIndex = categoryIndexRef.current < items.length - 1
      ? categoryIndexRef.current + 1
      : 0

    const nextItem = items[nextIndex]
    if (!nextItem) return
    categoryIndexRef.current = nextIndex
    console.log('[Watch] Next item:', { nextIndex, item: getItemName(nextItem) })
    zapTo(nextItem.data.id)
  }, [zapTo])

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
        console.log('[Watch] Quick-zap:', { direction: e.key, nextIndex, item: getItemName(nextItem) })
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
      stopProgressTracking()
    }
  }, [stopProgressTracking])

  // Detect audio and subtitle tracks
  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl) {
      console.log('[Tracks] No video element yet')
      return
    }

    console.log('[Tracks] Setting up track detection, currentType:', currentType)
    console.log('[Tracks] audioTracks:', videoEl.audioTracks, 'length:', videoEl.audioTracks?.length)
    console.log('[Tracks] textTracks:', videoEl.textTracks, 'length:', videoEl.textTracks?.length)

    const updateTracks = () => {
      // Get audio tracks
      const audioList: Array<{ id: number; label: string; language?: string; enabled: boolean }> = []
      for (let i = 0; i < (videoEl.audioTracks?.length || 0); i++) {
        const track = videoEl.audioTracks![i]
        audioList.push({
          id: i,
          label: track.label || `Audio ${i + 1}`,
          language: track.language,
          enabled: track.enabled
        })
      }
      setAudioTracks(audioList)

      // Get subtitle tracks - skip description/kind tracks that aren't captions/subtitles
      const subtitleList: Array<{ id: number; label: string; language?: string; enabled: boolean }> = []
      for (let i = 0; i < (videoEl.textTracks?.length || 0); i++) {
        const track = videoEl.textTracks![i]
        // Only list subtitles and captions, not metadata or descriptions
        if (track.kind === 'subtitles' || track.kind === 'captions' || track.kind === '') {
          subtitleList.push({
            id: i,
            label: track.label || track.language || `Subtitle ${i + 1}`,
            language: track.language,
            enabled: track.mode === 'showing'
          })
        }
      }
      setSubtitleTracks(subtitleList)

      console.log('[Tracks] Updated — audio:', audioList.length, 'subtitle:', subtitleList.length)
      console.log('[Tracks] rendered controls:', {
        hasAudioTracks: audioList.length > 0,
        hasTextTracks: subtitleList.length > 0,
        currentType
      })
    }

    updateTracks()

    const handleAudioTrackChange = () => updateTracks()
    const handleTextTrackChange = () => updateTracks()

    // Listen for track events
    videoEl.addEventListener('loadedmetadata', updateTracks)
    if (videoEl.audioTracks) {
      videoEl.audioTracks.addEventListener('change', handleAudioTrackChange)
      videoEl.audioTracks.addEventListener('addtrack', handleTextTrackChange)
    }
    if (videoEl.textTracks) {
      videoEl.textTracks.addEventListener('addtrack', handleTextTrackChange)
      videoEl.textTracks.addEventListener('removetrack', handleTextTrackChange)
      videoEl.textTracks.addEventListener('change', handleTextTrackChange)
    }

    return () => {
      videoEl.removeEventListener('loadedmetadata', updateTracks)
      if (videoEl.audioTracks) {
        videoEl.audioTracks.removeEventListener('change', handleAudioTrackChange)
        videoEl.audioTracks.removeEventListener('addtrack', handleTextTrackChange)
      }
      if (videoEl.textTracks) {
        videoEl.textTracks.removeEventListener('addtrack', handleTextTrackChange)
        videoEl.textTracks.removeEventListener('removetrack', handleTextTrackChange)
        videoEl.textTracks.removeEventListener('change', handleTextTrackChange)
      }
    }
  }, [currentItemId])

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentItemId])

  useEffect(() => {
    if (!channelId && !episodeId) {
      navigate('/live')
      return
    }

    const init = async () => {
      const source = getActiveSource()
      setActiveSource(source)
      if (!source || source.type !== 'xtream') {
        console.log('[Watch] No active Xtream source, redirecting')
        navigate('/home')
        return
      }

      console.log('[Watch] Source found:', source.name ?? '')
      console.log('[Watch] episodeId:', episodeId, 'location.state:', location.state)

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

        console.log('[Watch] Playing episode:', episodeState.episodeTitle)
        await playEpisode(episodeState)
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

      if (channelId) {
        await zapTo(channelId)
      }
    }

    init()

    return () => {
      destroyPlayer()
    }
  }, [channelId, episodeId, navigate, zapTo, playEpisode, destroyPlayer, location])

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

      {/* Main Content Area - Full remaining height */}
      <div
        className={`flex-1 flex flex-col lg:flex-row ${currentType === 'movie' ? 'overflow-y-auto lg:overflow-hidden' : 'overflow-hidden'}`}
        style={{ height: 'calc(100dvh - 56px)' }}
      >
{/* Left Side - Video + Controls + Status */}
        <div className={`${currentType === 'movie' ? 'flex-shrink-0 lg:flex-1' : 'flex-1'} flex flex-col overflow-hidden min-h-0`}>
          {/* Video Container - flex-1 to take remaining space */}
          <div className="flex-1 min-h-0 overflow-hidden p-2">
            <div className="relative w-full h-full flex items-center justify-center bg-black rounded border border-slate-700">
              <video
                ref={videoRef}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
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

          {/* Audio/Subtitle Control Bar - shown for movies and episodes */}
          {(currentType === 'movie' || currentType === 'episode') && (
            <div className="flex-shrink-0 px-4 py-2 bg-slate-900 border-t border-slate-800 select-none">
              <div className="flex items-center justify-center gap-4">
                {/* Audio Selection */}
                <div className="relative">
                  <button
                    onClick={() => { console.log('[Tracks] audioTracks:', videoRef.current?.audioTracks); setShowAudioMenu(!showAudioMenu); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[36px] disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Select audio track"
                    disabled={audioTracks.length === 0}
                  >
                    <Volume2 size={18} className="text-slate-400" />
                    <span className="text-sm text-slate-300">
                      {audioTracks.length > 0 ? (audioTracks.find(t => t.enabled)?.label || `Audio (${audioTracks.length})`) : 'Audio'}
                    </span>
                  </button>
                  {showAudioMenu && audioTracks.length > 0 && (
                    <div
                      ref={audioMenuRef}
                      className="absolute top-full left-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden"
                    >
                      {audioTracks.map((track, index) => (
                        <button
                          key={track.id}
                          onClick={() => { handleAudioTrackSelect(index); setShowAudioMenu(false); }}
                          className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50"
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-sm text-slate-300">{track.label}</span>
                            {track.language && (
                              <span className="text-xs text-slate-500">{track.language}</span>
                            )}
                          </div>
                          {track.enabled && <Check size={16} className="text-green-500" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subtitle Selection */}
                <div className="relative">
                  <button
                    onClick={() => { console.log('[Tracks] textTracks:', videoRef.current?.textTracks); setShowSubtitleMenu(!showSubtitleMenu); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[36px] disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Select subtitle track"
                    disabled={subtitleTracks.length === 0}
                  >
                    <Subtitles size={18} className="text-slate-400" />
                    <span className="text-sm text-slate-300">
                      {subtitleTracks.length > 0 ? (subtitleTracks.find(t => t.enabled)?.label || `Subs (${subtitleTracks.length})`) : 'Subs'}
                    </span>
                    {subtitleTracks.some(t => t.enabled) && (
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    )}
                  </button>
                  {showSubtitleMenu && (
                    <div
                      ref={subtitleMenuRef}
                      className="absolute top-full left-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden"
                    >
                      <button
                        onClick={() => { handleToggleSubtitles(); setShowSubtitleMenu(false); }}
                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 border-b border-slate-700"
                      >
                        <span className="text-sm text-slate-300">Off</span>
                        {!subtitleTracks.some(t => t.enabled) && <Check size={16} className="text-green-500" />}
                      </button>
                      {subtitleTracks.map((track, index) => (
                        <button
                          key={track.id}
                          onClick={() => { handleSubtitleTrackSelect(index); setShowSubtitleMenu(false); }}
                          className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50"
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-sm text-slate-300">{track.label}</span>
                            {track.language && (
                              <span className="text-xs text-slate-500">{track.language}</span>
                            )}
                          </div>
                          {track.enabled && <Check size={16} className="text-green-500" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* No tracks available message */}
                {audioTracks.length === 0 && subtitleTracks.length === 0 && (
                  <span className="text-xs text-slate-500">No audio/subtitle tracks available for this stream</span>
                )}
              </div>
            </div>
          )}

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
              {status === 'error' && (
                <p className="text-red-400 text-sm truncate max-w-[200px] sm:max-w-md">{errorMsg}</p>
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
                        } else {
                          navigate(`/watch/${encodeURIComponent(item.data.id)}`)
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
                          src={(item.data as ChannelRecord).logoUrl}
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
                          src={(item.data as MovieRecord).logoUrl}
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
                    </button>
                  )
                })}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
