import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import mpegts from 'mpegts.js'
import { db } from '../lib/db'
import { usePlaylistStore } from '../stores/playlistStore'

type WatchStatus = 'loading' | 'ready-click-to-play' | 'playing' | 'error'

export default function Watch() {
  const { channelId } = useParams<{ channelId: string }>()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<ReturnType<typeof mpegts.createPlayer> | null>(null)

  const [status, setStatus] = useState<WatchStatus>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [channelName, setChannelName] = useState<string>('')

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

  useEffect(() => {
    if (!channelId) {
      navigate('/live')
      return
    }

    let cancelled = false

    const init = async () => {
      const source = usePlaylistStore.getState().getActiveSource()
      if (!source || source.type !== 'xtream') {
        console.log('[Watch] No active Xtream source, redirecting to home')
        navigate('/home')
        return
      }

      console.log('[Watch] Source found:', source.name)

      let channel
      try {
        channel = await db.channels.where('id').equals(decodeURIComponent(channelId)).first()
      } catch (err) {
        console.error('[Watch] Failed to query channel:', err)
        setStatus('error')
        setErrorMsg('Channel not found in database')
        return
      }

      if (cancelled) return

      if (!channel) {
        console.log('[Watch] Channel not found for id:', channelId)
        setStatus('error')
        setErrorMsg('Channel not found')
        return
      }

      console.log('[Watch] Channel loaded:', { name: channel.name, streamId: channel.streamId })
      setChannelName(channel.name)

      const streamUrl = `${source.serverUrl}/live/${source.username}/${source.password}/${channel.streamId}.ts`
      const safeUrl = streamUrl.replace(source.username, '[USER]').replace(source.password, '[PASS]')
      console.log('[Watch] Stream URL:', safeUrl)

      console.log('[Watch] mpegts.js feature check:', mpegts.getFeatureList())
      if (!mpegts.getFeatureList().mseLivePlayback) {
        setStatus('error')
        setErrorMsg('Browser does not support MSE live playback')
        return
      }

      if (cancelled) return

      const player = mpegts.createPlayer({
        type: 'mpegts',
        url: streamUrl,
        isLive: true,
      })
      playerRef.current = player

      const videoEl = videoRef.current
      if (!videoEl || cancelled) {
        player.destroy()
        return
      }

      player.attachMediaElement(videoEl)

      player.on(mpegts.Events.ERROR, (_type: string, _detail: string, info: { message?: string }) => {
        console.error('[Watch] mpegts ERROR:', _type, _detail, info)
        if (!cancelled) {
          setStatus('error')
          setErrorMsg(info?.message ?? 'Player error occurred')
        }
      })

      player.on(mpegts.Events.LOADING_COMPLETE, () => {
        console.log('[Watch] mpegts LOADING_COMPLETE')
      })

      videoEl.oncanplay = () => console.log('[Watch] video canplay event')
      videoEl.onplaying = () => {
        console.log('[Watch] video playing event')
        if (!cancelled) setStatus('playing')
      }
      videoEl.onstalled = () => console.log('[Watch] video stalled event')
      videoEl.onerror = () => {
        console.error('[Watch] video error:', videoEl.error)
        if (!cancelled) {
          setStatus('error')
          setErrorMsg('Video element error')
        }
      }

      console.log('[Watch] Player created, calling load')
      player.load()

      if (cancelled) return

      try {
        await videoEl.play()
        console.log('[Watch] Auto-play succeeded immediately')
        setStatus('playing')
      } catch (err) {
        if (cancelled) return
        const isBlocked = err instanceof Error && (
          err.name === 'AbortError' ||
          err.name === 'NotAllowedError' ||
          err.name === 'NotAllowedError: Failed to execute \'play\' on \'HTMLMediaElement\''
        )
        if (isBlocked) {
          console.log('[Watch] Auto-play blocked by browser, showing click-to-play overlay')
          setStatus('ready-click-to-play')
        } else {
          console.error('[Watch] Auto-play failed with unexpected error:', err)
          setStatus('error')
          setErrorMsg(err instanceof Error ? err.message : String(err))
        }
      }
    }

    init()

    return () => {
      cancelled = true
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
    }
  }, [channelId, navigate])

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
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
        </div>
      </header>

      {/* Video area */}
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

        {/* Status bar */}
        <div className="mt-6 text-center">
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