import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import mpegts from 'mpegts.js'
import { db } from '../lib/db'
import { usePlaylistStore } from '../stores/playlistStore'
import { decryptString } from '../lib/crypto'

export default function TestPlayer() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<ReturnType<typeof mpegts.createPlayer> | null>(null)
  const initRef = useRef(false)

  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [channelName, setChannelName] = useState<string>('')

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const init = async () => {
      const source = usePlaylistStore.getState().getActiveSource()
      if (!source || source.type !== 'xtream') {
        navigate('/home')
        return
      }

      console.log('[TestPlayer] Source found, type:', source.type)

      try {
        const serverUrl = await decryptString(source.serverUrl)
        const username = await decryptString(source.username)
        const password = await decryptString(source.password)

        console.log('[TestPlayer] Credentials decrypted. Server:', serverUrl.replace(/\/\/.*@/, '//[REDACTED]@'))

        const channel = await db.channels.where('sourceId').equals(source.id).first()
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
          throw new Error('Browser does not support MSE live playback (mpegts.js requires it)')
        }

        const player = mpegts.createPlayer({
          type: 'mpegts',
          url: streamUrl,
          isLive: true,
        })

        playerRef.current = player

        if (videoRef.current) {
          player.attachMediaElement(videoRef.current)

          player.on(mpegts.Events.ERROR, (_type, _detail, info) => {
            setStatus('error')
            setErrorMsg(info?.message ?? 'Player error occurred')
          })

          player.on(mpegts.Events.LOADING_COMPLETE, () => {
            console.log('[TestPlayer] mpegts LOADING_COMPLETE event')
          })

          player.on(mpegts.Events.RECOVERED_EARLY_EOF, () => {
            console.log('[TestPlayer] mpegts RECOVERED_EARLY_EOF event')
          })

          videoRef.current.onerror = () => {
            setStatus('error')
            setErrorMsg('Video element error occurred')
          }

          videoRef.current.oncanplay = () => console.log('[TestPlayer] video canplay event')
          videoRef.current.onplaying = () => console.log('[TestPlayer] video playing event')
          videoRef.current.onstalled = () => console.log('[TestPlayer] video stalled event')

          player.load()
          console.log('[TestPlayer] Player created, calling load and play')
          player.play()
          setStatus('playing')
          console.log('[TestPlayer] Status set to playing')
        }
      } catch (err) {
        console.error('[TestPlayer] Init failed:', err)
        setStatus('error')
        const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
        setErrorMsg(`Failed to initialize player. ${detail}`)
      }
    }

    init()

    return () => {
      const player = playerRef.current
      if (player) {
        player.pause()
        player.unload()
        player.detachMediaElement()
        player.destroy()
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