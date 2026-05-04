import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Loader2, Maximize2, Minimize2, List, Tv2, ChevronLeft, ChevronRight, Film, Settings } from 'lucide-react'
import mpegts from 'mpegts.js'
import { db } from '../lib/db'
import { usePlaylistStore, type PlaylistSource } from '../stores/playlistStore'
import { useBrowseStore } from '../stores/browseStore'
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

type AudioTrack = {
  index: number
  stream_index: number
  codec: string
  language: string
  title: string | null
  channels: number | null
  channel_layout: string | null
  is_default: boolean
  browser_compatible: boolean
}

type SubtitleTrack = {
  index: number
  stream_index: number
  codec: string
  language: string
  title: string | null
  forced: boolean
  is_default: boolean
  is_bitmap: boolean
  extractable: boolean
}

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
  const activeItemRef = useRef<HTMLButtonElement>(null)

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
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([])
  const [selectedSubtitle, setSelectedSubtitle] = useState<number | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [activeSource, setActiveSource] = useState<PlaylistSource | null>(null)
  const lastKnownTimeRef = useRef<number>(0)

  const setLastChannelId = usePlaylistStore((state) => state.setLastChannelId)

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
    setVideoInfo(null)
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
    if (currentType === 'episode' && location.state && (location.state as EpisodeInfo).seriesId) {
      navigate(`/series/${encodeURIComponent((location.state as EpisodeInfo).seriesId)}`, { replace: true })
      return
    }

    // Keep Live TV and Movies on the previous stable browseStore return behavior.
    const ctx = useBrowseStore.getState().exitPlayer()
    if (ctx) {
      const tab = ctx.section === 'live' ? 'channels' : ctx.section === 'movies' ? 'movies' : 'series'
      navigate(`/live?tab=${tab}`)
      return
    }

    navigate('/live')
  }, [currentType, location.state, navigate])

  const probeTracks = useCallback(async (streamId: number, type: 'movie' | 'series', ext: string) => {
    const source = activeSource
    if (!source || source.type !== 'xtream') return

    const params = new URLSearchParams({
      serverUrl: source.serverUrl,
      username: source.username,
      password: source.password,
      ext,
    })

    try {
      const res = await fetch(`/probe/${type}/${streamId}?${params.toString()}`)
      if (!res.ok) {
        console.warn('[Probe] Failed to fetch:', res.status)
        return
      }
      const data = await res.json()
      console.log('[Probe] Tracks:', data)
      setAudioTracks(data.audio_tracks || [])
      setSubtitleTracks(data.subtitle_tracks || [])
    } catch (err) {
      console.error('[Probe] Failed:', err)
    }
  }, [activeSource])

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

    const source = usePlaylistStore.getState().getActiveSource()
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
    setActiveSource(source)
    setAudioTracks([])
    setSubtitleTracks([])
    setSelectedSubtitle(null)
    setShowSettings(false)

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
      probeTracks(episodeInfo.streamId, 'series', episodeInfo.containerExtension)
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
  }, [destroyPlayer])

  const zapTo = useCallback(async (targetItemId: string) => {
    if (!targetItemId || !videoRef.current) return

    const source = usePlaylistStore.getState().getActiveSource()
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
    setStatus('loading')
    setVideoInfo(null)
    setActiveSource(source)
    setAudioTracks([])
    setSubtitleTracks([])
    setSelectedSubtitle(null)
    setShowSettings(false)

    const allItems = allItemsRef.current
    const categoryItms = allItems.filter((i) => i && i.type === item.type && i.data.categoryId === item.data.categoryId)
    categoryItemsRef.current = categoryItms
    const catIdx = categoryItms.findIndex((i) => i && i.data.id === item.data.id)
    categoryIndexRef.current = catIdx >= 0 ? catIdx : 0
    setCategoryItems(categoryItms)

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
        if (item.type === 'movie') {
          const ext = (item.data as MovieRecord).containerExtension || 'mp4'
          probeTracks(parseInt((item.data as MovieRecord).streamId, 10), 'movie', ext)
        }
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
  }, [destroyPlayer, setLastChannelId])

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
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentItemId])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const apply = () => {
      const tracks = video.textTracks
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = 'disabled'
      }
      if (selectedSubtitle !== null && tracks.length > 0) {
        tracks[tracks.length - 1].mode = 'showing'
      }
    }
    apply()
    video.textTracks.addEventListener('addtrack', apply)
    return () => video.textTracks.removeEventListener('addtrack', apply)
  }, [selectedSubtitle])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTime = () => {
      if (video.currentTime > 1 && !isNaN(video.currentTime)) {
        lastKnownTimeRef.current = video.currentTime
      }
    }
    video.addEventListener('timeupdate', onTime)
    return () => video.removeEventListener('timeupdate', onTime)
  }, [])

  useEffect(() => {
    if (!channelId && !episodeId) {
      navigate('/live')
      return
    }

    const init = async () => {
      const source = usePlaylistStore.getState().getActiveSource()
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

  useEffect(() => {
    return () => {
      setAudioTracks([])
      setSubtitleTracks([])
      setSelectedSubtitle(null)
      setShowSettings(false)
    }
  }, [channelId, episodeId])

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-900">
      {/* Top Navigation Bar */}
      <header className="flex-shrink-0 h-14 sm:h-16 flex items-center gap-2 sm:gap-4 px-2 sm:px-4 border-b border-slate-800 bg-slate-900">
        <button
          onClick={handleUpBack}
          className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-indigo-500/50 min-h-[44px]"
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
            className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-indigo-500/50"
            aria-label={isSidebarOpen ? 'Hide channel list' : 'Show channel list'}
          >
            {isSidebarOpen ? <Tv2 className="w-5 h-5" /> : <List className="w-5 h-5" />}
          </button>
          <button
            onClick={handlePrevChannel}
            className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-indigo-500/50"
            aria-label="Previous channel"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNextChannel}
            className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-indigo-500/50"
            aria-label="Next channel"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={handleFullscreenToggle}
            className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-indigo-500/50"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          {(currentType === 'movie' || currentType === 'episode') && (
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-indigo-500/50"
                aria-label="Audio & subtitle settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              {showSettings && (
                <div className="absolute right-0 top-full mt-2 w-72 max-h-96 overflow-y-auto bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl z-50 p-4">
                  {audioTracks.length > 1 && (
                    <div className="mb-4">
                      <p className="text-xs uppercase text-slate-400 mb-2 tracking-wide">Audio</p>
                      {audioTracks.map((t) => (
                        <div
                          key={t.index}
                          className={'w-full text-left px-3 py-2 rounded text-sm mb-1 ' +
                            (t.is_default ? 'bg-indigo-600/30 text-white' : 'text-slate-300')}
                        >
                          <span className="text-white">{(t.language || 'UND').toUpperCase()}</span>
                          <span className="text-slate-400 ml-2">
                            {t.codec.toUpperCase()}
                            {t.channel_layout ? ' · ' + t.channel_layout : t.channels ? ' · ' + t.channels + 'ch' : ''}
                          </span>
                          {t.title && <span className="text-slate-500 ml-2">{t.title}</span>}
                          {!t.browser_compatible && (
                            <span className="text-amber-500/70 ml-1 text-xs">(needs transcode)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {subtitleTracks.length > 0 && (
                    <div>
                      <p className="text-xs uppercase text-slate-400 mb-2 tracking-wide">Subtitles</p>
                      <button
                        onClick={() => setSelectedSubtitle(null)}
                        className={'w-full text-left px-3 py-2 rounded text-sm transition-colors mb-1 ' +
                          (selectedSubtitle === null
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800')}
                      >
                        Off
                      </button>
                      {subtitleTracks.map((t) => {
                        const isBitmap = t.is_bitmap === true
                        const isSelected = selectedSubtitle === t.index
                        return (
                          <button
                            key={t.index}
                            disabled={isBitmap}
                            onClick={() => {
                              if (isBitmap) return
                              if (videoRef.current && videoRef.current.currentTime > 1) {
                                lastKnownTimeRef.current = videoRef.current.currentTime
                              }
                              setSelectedSubtitle(t.index)
                            }}
                            className={'w-full text-left px-3 py-2 rounded text-sm transition-colors mb-1 ' +
                              (isBitmap ? 'text-slate-600 cursor-not-allowed'
                                : isSelected ? 'bg-indigo-600 text-white'
                                : 'text-slate-300 hover:bg-slate-800')}
                          >
                            <span className={isBitmap ? 'text-slate-600' : 'text-white'}>
                              {(t.language || 'UND').toUpperCase()}
                            </span>
                            {t.title && <span className="text-slate-400 ml-2">{t.title}</span>}
                            {t.forced && <span className="text-slate-500 ml-1 text-xs">(forced)</span>}
                            {isBitmap && (
                              <span className="text-slate-600 ml-1 text-xs block">
                                (requires burn-in, not supported)
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {(audioTracks.length === 0 && subtitleTracks.length === 0) && (
                    <p className="text-slate-500 text-sm text-center py-4">No tracks available</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Video Section - 40vh on mobile, auto on desktop */}
        <div className="h-[40vh] lg:h-auto lg:flex-1 flex flex-col bg-black flex-shrink-0">
          {/* Video Player */}
          <div className="relative flex-1 flex items-center justify-center bg-black p-2 sm:p-4">
            <video
              ref={videoRef}
              controls
              playsInline
              className="w-full h-full object-contain"
            >
              {selectedSubtitle !== null &&
               subtitleTracks[selectedSubtitle] !== undefined &&
               subtitleTracks[selectedSubtitle].extractable &&
               !subtitleTracks[selectedSubtitle].is_bitmap &&
               activeSource?.type === 'xtream' && (() => {
                const t = subtitleTracks[selectedSubtitle]
                const streamId = currentType === 'episode' ? episodeId : currentItemId
                if (!streamId) return null
                const p = new URLSearchParams({
                  serverUrl: activeSource.serverUrl,
                  username: activeSource.username,
                  password: activeSource.password,
                  ext: currentType === 'episode'
                    ? (location.state as EpisodeInfo)?.containerExtension || 'mkv'
                    : '',
                })
                return (
                  <track
                    key={'sub-' + currentType + '-' + streamId + '-' + selectedSubtitle}
                    kind="subtitles"
                    src={'/subtitles/' + (currentType === 'episode' ? 'series' : currentType) + '/' + streamId + '/' + selectedSubtitle + '.vtt?' + p}
                    srcLang={t?.language || 'und'}
                    label={t?.title || t?.language?.toUpperCase() || 'Sub'}
                    default
                  />
                )
              })()}
            </video>
            {status === 'ready-click-to-play' && (
              <button
                onClick={handlePlayClick}
                className="absolute inset-0 flex items-center justify-center bg-black/60 hover:bg-black/50 transition-colors focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-indigo-500/50 z-10"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-500 transition-colors">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </button>
            )}
          </div>

          {/* Status Bar */}
          <div className="flex-shrink-0 px-4 py-2 flex items-center justify-between bg-slate-900 border-t border-slate-800">
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
                <p className="text-red-400 text-sm">{errorMsg}</p>
              )}
            </div>
            {status === 'playing' && categoryItems.length > 1 && (
              <p className="text-slate-500 text-xs hidden sm:block">↑ / ↓ arrows to change</p>
            )}
          </div>
        </div>

        {/* Channel List - Right side on desktop, below player on mobile */}
        {isSidebarOpen && categoryItems.length > 0 && (
          <aside className="flex-1 lg:flex-initial lg:w-80 flex flex-col bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-700 overflow-hidden min-h-0">
            {/* Category Header */}
            <div className="flex-shrink-0 p-3 border-b border-slate-700">
              <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide truncate">{categoryName}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentType === 'episode' ? 'Episode' : currentType === 'channel' ? 'channels' : 'movies'}
              </p>
            </div>
            {/* Channel List - scrollable with visible scrollbar */}
            <div className="flex-1 min-h-0 overflow-y-scroll">
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
                          className="w-10 h-10 object-cover rounded bg-slate-800 flex-shrink-0"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 bg-slate-800 rounded flex items-center justify-center flex-shrink-0">
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
