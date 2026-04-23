import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Maximize2, Minimize2 } from 'lucide-react'
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
  const currentIndexRef = useRef<number>(-1)
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [status, setStatus] = useState<WatchStatus>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [channelName, setChannelName] = useState<string>('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [videoInfo, setVideoInfo] = useState<{ width: number; height: number; fps: number } | null>(null)

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

    console.log('[Watch] Zap to channel:', { name: channel.name, streamId: channel.streamId })
    setChannelName(channel.name)
    setStatus('loading')
    setVideoInfo(null)

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const channels = allChannelsRef.current
        if (channels.length === 0) return

        let nextIndex: number
        if (e.key === 'ArrowUp') {
          nextIndex = currentIndexRef.current > 0
            ? currentIndexRef.current - 1
            : channels.length - 1
        } else {
          nextIndex = currentIndexRef.current < channels.length - 1
            ? currentIndexRef.current + 1
            : 0
        }

        const nextChannel = channels[nextIndex]
        currentIndexRef.current = nextIndex
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

      const idx = sorted.findIndex((c) => c.id === decodeURIComponent(channelId))
      currentIndexRef.current = idx >= 0 ? idx : 0

      await zapTo(channelId)
    }

    init()

    return () => {
      destroyPlayer()
    }
  }, [channelId, navigate, zapTo, destroyPlayer])

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <header className="h-16 flex-shrink-0 flex items-center gap-4 px-4 border-b border-slate-800 bg-slate-900">
        <button
          onClick={() => navigate('/live')}
          className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-indigo-500/50 min-h-[44px]"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-base font-medium">Back</span>
        </button>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <h1 className="text-xl font-semibold text-white truncate">{channelName || 'Loading...'}</h1>
          {videoInfo && (
            <span className="text-slate-500 text-sm font-mono flex-shrink-0">
              {videoInfo.width}x{videoInfo.height}
              {videoInfo.fps > 0 && ` @ ${videoInfo.fps}fps`}
            </span>
          )}
        </div>
        <button
          onClick={handleFullscreenToggle}
          className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="relative w-full max-w-6xl">
          <video
            ref={videoRef}
            controls
            playsInline
            className="w-full aspect-video bg-black rounded-lg"
          />
          {status === 'ready-click-to-play' && (
            <button
              onClick={handlePlayClick}
              className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg hover:bg-black/50 transition-colors focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
            >
              <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-500 transition-colors">
                <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </button>
          )}
        </div>

        {status === 'playing' && allChannelsRef.current.length > 1 && (
          <p className="mt-3 text-slate-500 text-sm">Use ↑ / ↓ arrows to change channels</p>
        )}

        <div className="mt-4 text-center">
          {status === 'loading' && (
            <div className="flex items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading channel...</span>
            </div>
          )}
          {status === 'ready-click-to-play' && (
            <p className="text-slate-400 text-base">Click play to start</p>
          )}
          {status === 'playing' && (
            <p className="text-green-400 text-base">Playing</p>
          )}
          {status === 'error' && (
            <p className="text-red-400 text-base">{errorMsg}</p>
          )}
        </div>
      </div>
    </div>
  )
}