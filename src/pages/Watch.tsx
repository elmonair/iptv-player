import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Maximize2, Minimize2, List, Tv2, ChevronLeft, ChevronRight } from 'lucide-react'
import mpegts from 'mpegts.js'
import { db } from '../lib/db'
import { usePlaylistStore } from '../stores/playlistStore'
import type { ChannelRecord } from '../lib/db'

type WatchStatus = 'loading' | 'ready-click-to-play' | 'playing' | 'error'

export default function Watch() {
  const { channelId } = useParams<{ channelId: string }>()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<ReturnType<typeof mpegts.createPlayer> | null>(null)
  const allChannelsRef = useRef<ChannelRecord[]>([])
  const categoryChannelsRef = useRef<ChannelRecord[]>([])
  const categoryIndexRef = useRef<number>(-1)
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeChannelRef = useRef<HTMLButtonElement>(null)

  const [status, setStatus] = useState<WatchStatus>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [channelName, setChannelName] = useState<string>('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [videoInfo, setVideoInfo] = useState<{ width: number; height: number; fps: number } | null>(null)
  const [categoryChannels, setCategoryChannels] = useState<ChannelRecord[]>([])
  const [categoryName, setCategoryName] = useState<string>('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [currentChanId, setCurrentChanId] = useState<string>('')

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
    if (!videoRef.current) return
    try {
      await videoRef.current.play()
      console.log('[Watch] User-initiated play succeeded')
    } catch (err) {
      console.error('[Watch] User-initiated play failed:', err)
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }

  const zapTo = useCallback(async (targetChannelId: string) => {
    if (!targetChannelId || !videoRef.current) return

    const source = usePlaylistStore.getState().getActiveSource()
    if (!source || source.type !== 'xtream') return

    destroyPlayer()

    let channel: ChannelRecord | undefined
    try {
      channel = await db.channels.where('id').equals(decodeURIComponent(targetChannelId)).first()
    } catch {
      setStatus('error')
      setErrorMsg('Failed to load channel')
      return
    }

    if (!channel) {
      setStatus('error')
      setErrorMsg('Channel not found')
      return
    }

    console.log('[Watch] Zap to channel:', { name: channel.name, streamId: channel.streamId, id: channel.id })
    setChannelName(channel.name)
    setCurrentChanId(channel.id)
    setStatus('loading')
    setVideoInfo(null)

    const allChannels = allChannelsRef.current
    const categoryChan = allChannels.filter((c) => c.categoryId === channel.categoryId)
    categoryChannelsRef.current = categoryChan
    const catIdx = categoryChan.findIndex((c) => c.id === channel.id)
    categoryIndexRef.current = catIdx >= 0 ? catIdx : 0
    setCategoryChannels(categoryChan)

    try {
      const cat = await db.categories.where('id').equals(channel.categoryId).first()
      setCategoryName(cat?.name ?? 'Unknown')
    } catch {
      setCategoryName('Unknown')
    }

    const streamUrl = `${source.serverUrl}/live/${source.username}/${source.password}/${channel.streamId}.ts`
    const safeUrl = streamUrl.replace(source.username, '[USER]').replace(source.password, '[PASS]')
    console.log('[Watch] Stream URL:', safeUrl)

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

    // Media info — gives resolution and frame rate
    player.on(mpegts.Events.MEDIA_INFO, (info: { width?: number; height?: number; frame_rate?: number }) => {
      console.log('[Watch] mpegts MEDIA_INFO:', info)
      if (info.width && info.height) {
        setVideoInfo((prev) => ({
          width: info.width as number,
          height: info.height as number,
          fps: info.frame_rate ?? prev?.fps ?? 0,
        }))
      }
    })

    // Statistics — FPS from mpegts stats
    player.on(mpegts.Events.STATISTICS_INFO, (info: { speed?: number; fps?: number } | unknown) => {
      const stats = info as { speed?: number; fps?: number }
      if (stats && typeof stats.fps === 'number' && stats.fps > 0) {
        setVideoInfo((prev) => prev ? { ...prev, fps: stats.fps as number } : null)
      }
    })

    const videoEl = videoRef.current
    videoEl.oncanplay = () => {
      console.log('[Watch] video canplay event')
      if (videoEl.videoWidth && videoEl.videoHeight) {
        setVideoInfo((prev) => ({
          width: videoEl.videoWidth,
          height: videoEl.videoHeight,
          fps: prev?.fps ?? 0,
        }))
      }
    }
    videoEl.onplaying = () => {
      console.log('[Watch] video playing event')
      setStatus('playing')
      setLastChannelId(channel!.id)

      // Periodic check for video dimensions in case MEDIA_INFO didn't fire
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
      setErrorMsg('Video element error')
    }

    player.attachMediaElement(videoEl)
    player.load()

    try {
      await videoEl.play()
      setStatus('playing')
      setLastChannelId(channel.id)
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
        setStatus('ready-click-to-play')
      } else {
        setStatus('error')
        setErrorMsg(err instanceof Error ? err.message : String(err))
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
    const channels = categoryChannelsRef.current
    if (channels.length === 0) return

    const nextIndex = categoryIndexRef.current > 0
      ? categoryIndexRef.current - 1
      : channels.length - 1

    const nextChannel = channels[nextIndex]
    categoryIndexRef.current = nextIndex
    console.log('[Watch] Prev channel:', { nextIndex, channel: nextChannel.name })
    zapTo(nextChannel.id)
  }, [zapTo])

  const handleNextChannel = useCallback(() => {
    const channels = categoryChannelsRef.current
    if (channels.length === 0) return

    const nextIndex = categoryIndexRef.current < channels.length - 1
      ? categoryIndexRef.current + 1
      : 0

    const nextChannel = channels[nextIndex]
    categoryIndexRef.current = nextIndex
    console.log('[Watch] Next channel:', { nextIndex, channel: nextChannel.name })
    zapTo(nextChannel.id)
  }, [zapTo])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const channels = categoryChannelsRef.current
        if (channels.length === 0) return

        let nextIndex: number
        if (e.key === 'ArrowUp') {
          nextIndex = categoryIndexRef.current > 0
            ? categoryIndexRef.current - 1
            : channels.length - 1
        } else {
          nextIndex = categoryIndexRef.current < channels.length - 1
            ? categoryIndexRef.current + 1
            : 0
        }

        const nextChannel = channels[nextIndex]
        categoryIndexRef.current = nextIndex
        console.log('[Watch] Quick-zap:', { direction: e.key, nextIndex, channel: nextChannel.name })
        zapTo(nextChannel.id)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [zapTo])

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  useEffect(() => {
    if (activeChannelRef.current) {
      activeChannelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentChanId])

  useEffect(() => {
    if (!channelId) {
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

      console.log('[Watch] Source found:', source.name)

      const channels = await db.channels
        .where('sourceId')
        .equals(source.id)
        .toArray()
      const sorted = channels.sort((a, b) => a.name.localeCompare(b.name))
      allChannelsRef.current = sorted

      await zapTo(channelId)
    }

    init()

    return () => {
      destroyPlayer()
    }
  }, [channelId, navigate, zapTo, destroyPlayer])

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-900">
      {/* Top Navigation Bar */}
      <header className="flex-shrink-0 h-14 sm:h-16 flex items-center gap-2 sm:gap-4 px-2 sm:px-4 border-b border-slate-800 bg-slate-900">
        <button
          onClick={() => navigate('/live')}
          className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-indigo-500/50 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-sm sm:text-base font-medium hidden sm:inline">Back</span>
        </button>
        <div className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0">
          <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-white truncate">{channelName || 'Loading...'}</h1>
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
        </div>
      </header>

      {/* Main Content Area - Side-by-side on desktop */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Video Section - Left side on desktop */}
        <div className="flex-1 flex flex-col bg-black min-h-0">
          {/* Video Player */}
          <div className="flex-1 flex items-center justify-center bg-black p-2 sm:p-4">
            <video
              ref={videoRef}
              key={channelName}
              controls
              playsInline
              autoPlay
              className="w-full h-full object-contain"
            />
            {status === 'ready-click-to-play' && (
              <button
                onClick={handlePlayClick}
                className="absolute inset-0 flex items-center justify-center bg-black/60 hover:bg-black/50 transition-colors focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-indigo-500/50"
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
                  <span className="text-sm">Loading channel...</span>
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
            {status === 'playing' && categoryChannels.length > 1 && (
              <p className="text-slate-500 text-xs hidden sm:block">↑ / ↓ arrows to change channels</p>
            )}
          </div>
        </div>

        {/* Channel List - Right side on desktop */}
        {isSidebarOpen && categoryChannels.length > 0 && (
          <aside className="flex-shrink-0 w-full lg:w-80 flex flex-col bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-700 min-h-0">
            {/* Category Header */}
            <div className="flex-shrink-0 p-3 border-b border-slate-700">
              <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide truncate">{categoryName}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{categoryChannels.length} channels</p>
            </div>
            {/* Channel List - scrollable with visible scrollbar */}
            <div className="flex-1 min-h-0 overflow-y-scroll">
              <div className="flex flex-col gap-1 p-2">
                {categoryChannels.map((chan) => {
                  const isActive = chan.id === currentChanId
                  return (
                    <button
                      key={chan.id}
                      ref={isActive ? activeChannelRef : null}
                      onClick={() => navigate(`/watch/${encodeURIComponent(chan.id)}`)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[48px] w-full ${
                        isActive
                          ? 'bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {chan.logoUrl ? (
                        <img
                          src={chan.logoUrl}
                          alt={chan.name}
                          className="w-10 h-10 object-contain rounded bg-slate-800 flex-shrink-0"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            const fallback = target.nextElementSibling as HTMLDivElement
                            if (fallback) fallback.style.display = 'flex'
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 bg-slate-800 rounded flex items-center justify-center text-sm font-semibold text-slate-400 flex-shrink-0">
                          {chan.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="flex-1 text-sm font-medium truncate text-left">{chan.name}</span>
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