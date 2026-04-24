import { useRef, useEffect, useState } from 'react'
import Hls from 'hls.js'
import mpegts from 'mpegts.js'

interface VideoPlayerProps {
  src: string
  type?: 'channel' | 'movie' | 'series'
  isLive?: boolean
  onError?: (error: string) => void
  onStatus?: (status: 'loading' | 'playing' | 'error' | 'ready-click-to-play') => void
  onVideoInfo?: (info: { width: number; height: number; fps: number }) => void
}

export function VideoPlayer({ src, type = 'channel', isLive = false, onError, onStatus, onVideoInfo }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const mpegtsRef = useRef<ReturnType<typeof mpegts.createPlayer> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!videoRef.current || !src) return

    const video = videoRef.current
    setError(null)
    onStatus?.('loading')

    const isHLS = src.includes('.m3u8')
    const isTS = src.includes('.ts')

    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      if (mpegtsRef.current) {
        try { mpegtsRef.current.pause() } catch { /* ignore */ }
        try { mpegtsRef.current.unload() } catch { /* ignore */ }
        try { mpegtsRef.current.detachMediaElement() } catch { /* ignore */ }
        try { mpegtsRef.current.destroy() } catch { /* ignore */ }
        mpegtsRef.current = null
      }
    }

    cleanup()

    if (isHLS) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: isLive,
        })
        hls.loadSource(src)
        hls.attachMedia(video)
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            const msg = `HLS error: ${data.type}`
            console.error('[VideoPlayer] HLS fatal error:', data)
            setError(msg)
            onError?.(msg)
            onStatus?.('error')
          }
        })
        hlsRef.current = hls
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src
      } else {
        setError('HLS streams not supported in this browser')
        onStatus?.('error')
        return
      }
    } else if (isTS || type === 'channel') {
      if (mpegts.isSupported()) {
        const player = mpegts.createPlayer({
          type: 'mpegts',
          url: src,
          isLive,
        })
        mpegtsRef.current = player

        player.on(mpegts.Events.ERROR, (_t: string, _d: string, info: { message?: string }) => {
          console.error('[VideoPlayer] mpegts ERROR:', info)
          setError(info?.message ?? 'Stream error')
          onError?.(info?.message ?? 'Stream error')
          onStatus?.('error')
        })

        player.on(mpegts.Events.MEDIA_INFO, (info: { width?: number; height?: number; frame_rate?: number }) => {
          if (info.width && info.height) {
            onVideoInfo?.({
              width: info.width as number,
              height: info.height as number,
              fps: info.frame_rate ?? 0,
            })
          }
        })

        player.attachMediaElement(video)
        player.load()
      } else {
        video.src = src
      }
    } else {
      video.src = src
    }

    video.oncanplay = () => {
      if (video.videoWidth && video.videoHeight) {
        onVideoInfo?.({
          width: video.videoWidth,
          height: video.videoHeight,
          fps: 0,
        })
      }
    }

    video.onplaying = () => {
      onStatus?.('playing')
    }

    video.onerror = () => {
      const errCode = video.error?.code ?? 0
      let msg = 'Unable to play this video.'

      if (errCode === 4) {
        msg = 'Video format not supported. The codec may be MKV, HEVC, or unsupported.'
      } else if (errCode === 3) {
        msg = 'Video playback error. The file may be corrupted.'
      } else if (errCode === 2) {
        msg = 'Network error. Check your connection.'
      }

      console.error('[VideoPlayer] Video error:', errCode, video.error)
      setError(msg)
      onError?.(msg)
      onStatus?.('error')
    }

    video.onstalled = () => {
      console.log('[VideoPlayer] Video stalled')
    }

    return cleanup
  }, [src, type, isLive, onError, onStatus, onVideoInfo])

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(src).catch(() => {})
  }

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        autoPlay
        playsInline
      />

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
          <div className="max-w-md text-center">
            <div className="text-red-500 text-lg font-medium mb-3">
              Playback Error
            </div>
            <p className="text-slate-300 text-sm mb-4">
              {error}
            </p>
            <div className="text-slate-400 text-xs space-y-1 mb-4">
              <p>Suggestions:</p>
              <p>• Try a different movie</p>
              <p>• Some formats (MKV, AVI) need external players</p>
              <p>• Copy URL and open in VLC Media Player</p>
            </div>
            <button
              onClick={handleCopyUrl}
              className="px-4 py-2 bg-yellow-500 text-black text-sm font-medium rounded hover:bg-yellow-400 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
            >
              Copy URL for VLC
            </button>
          </div>
        </div>
      )}
    </div>
  )
}