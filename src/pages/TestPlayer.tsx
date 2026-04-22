import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import mpegts from 'mpegts.js'
import { db } from '../lib/db'
import { usePlaylistStore } from '../stores/playlistStore'

export default function TestPlayer() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<ReturnType<typeof mpegts.createPlayer> | null>(null)

  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [channelName, setChannelName] = useState<string>('')

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const source = usePlaylistStore.getState().getActiveSource()
      if (!source || source.type !== 'xtream') {
        navigate('/home')
        return
      }

      try {
        console.log('[TestPlayer] Source found, type:', source.type)

        const serverUrl = source.serverUrl
        const username = source.username
        const password = source.password
        console.log('[TestPlayer] Credentials loaded. Server:', serverUrl)

        const channel = await db.channels.where('sourceId').equals(source.id).first()
        if (cancelled) return
        if (!channel) {
          setStatus('error')
          setErrorMsg('No channels in database')
          return
        }
        console.log('[TestPlayer] First channel:', { name: channel.name, streamId: channel.streamId, streamType: channel.streamType })
        setChannelName(channel.name)

        const streamUrl = `${serverUrl}/live/${username}/${password}/${channel.streamId}.ts`
        const safeUrl = streamUrl.replace(username, '[USER]').replace(password, '[PASS]')
        console.log('[TestPlayer] Stream URL:', safeUrl)

        console.log('[TestPlayer] mpegts.js feature check:', mpegts.getFeatureList())
        if (!mpegts.getFeatureList().mseLivePlayback) {
          throw new Error('Browser does not support MSE live playback')
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
          console.error('[TestPlayer] mpegts ERROR:', _type, _detail, info)
          setStatus('error')
          setErrorMsg(info?.message ?? 'Player error occurred')
        })

        player.on(mpegts.Events.LOADING_COMPLETE, () => {
          console.log('[TestPlayer] mpegts LOADING_COMPLETE')
        })

        videoEl.oncanplay = () => console.log('[TestPlayer] video canplay event')
        videoEl.onplaying = () => {
          console.log('[TestPlayer] video playing event')
          if (!cancelled) setStatus('playing')
        }
        videoEl.onstalled = () => console.log('[TestPlayer] video stalled event')
        videoEl.onerror = () => {
          console.error('[TestPlayer] video error:', videoEl.error)
          setStatus('error')
          setErrorMsg('Video element error')
        }

        console.log('[TestPlayer] Player created, calling load and play')
        player.load()

        try {
          await player.play()
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') {
            console.log('[TestPlayer] play() aborted, ignoring')
            return
          }
          throw e
        }
      } catch (err) {
        console.error('[TestPlayer] Init failed:', err)
        if (cancelled) return
        setStatus('error')
        const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
        setErrorMsg(`Failed to initialize player. ${detail}`)
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
  }, [navigate])

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">Test Player</h1>
          <p className="text-slate-400 text-base">{channelName}</p>
        </div>

        <div className="flex justify-center mb-6">
          <video
            ref={videoRef}
            controls
            autoPlay
            muted
            className="w-full max-w-3xl aspect-video bg-black rounded-lg"
          />
        </div>

        <div className="text-center mb-8">
          {status === 'loading' && (
            <div className="flex items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Starting playback...</span>
            </div>
          )}
          {status === 'error' && (
            <p className="text-red-400 text-base">{errorMsg}</p>
          )}
          {status === 'playing' && (
            <p className="text-green-400 text-base">Playing</p>
          )}
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate('/home')}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg focus:outline-none focus:ring-4 focus:ring-slate-500/50 min-h-[44px]"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}