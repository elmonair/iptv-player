import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  MediaPlayer,
  MediaProvider,
  Track,
} from '@vidstack/react'
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from '@vidstack/react/player/layouts/default'
import { usePlaylistStore } from '../stores/playlistStore'

import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'

type SubtitleTrack = {
  src: string
  lang: string
  label: string
  index: number
}

export default function VidstackTest() {
  const { movieId } = useParams<{ movieId: string }>()
  const [streamUrl, setStreamUrl] = useState('')
  const [tracks, setTracks] = useState<SubtitleTrack[]>([])
  const [audioInfo, setAudioInfo] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const setup = async () => {
      const source = usePlaylistStore.getState().getActiveSource()
      if (!source || source.type !== 'xtream') {
        setError('No active Xtream source - set up a playlist first')
        return
      }
      if (!movieId) {
        setError('No movieId in URL')
        return
      }

      const ext = 'mkv'

      const transcodeParams = new URLSearchParams({
        serverUrl: source.serverUrl,
        username: source.username,
        password: source.password,
        ext,
      })
      setStreamUrl(`/transcode/movie/${movieId}?${transcodeParams}`)

      try {
        const probeParams = new URLSearchParams({
          serverUrl: source.serverUrl,
          username: source.username,
          password: source.password,
          ext,
        })
        const res = await fetch(`/probe/movie/${movieId}?${probeParams}`)
        if (!res.ok) return
        const data = await res.json()

        if (data.audio_tracks?.length) {
          const lines = data.audio_tracks.map((t: any, i: number) =>
            `${i}: ${(t.language || 'und').toUpperCase()} ` +
            `${t.codec?.toUpperCase()} ${t.channel_layout || ''} ` +
            `${t.title || ''} ${t.browser_compatible ? '' : '(needs transcode)'}`
          )
          setAudioInfo(lines.join('\n'))
        }

        if (data.subtitle_tracks?.length) {
          const subTracks = data.subtitle_tracks
            .filter((t: any) => t.extractable && !t.is_bitmap)
            .map((t: any) => {
              const subParams = new URLSearchParams({
                serverUrl: source.serverUrl,
                username: source.username,
                password: source.password,
                ext,
              })
              return {
                src: `/subtitles/movie/${movieId}/${t.index}.vtt?${subParams}`,
                lang: t.language || 'und',
                label: t.title || (t.language || 'und').toUpperCase(),
                index: t.index,
              }
            })
          setTracks(subTracks)
        }
      } catch (err) {
        console.error('[VidstackTest] probe error:', err)
      }
    }

    setup()
  }, [movieId])

  if (error) {
    return (
      <div className="p-8 text-white bg-slate-900 min-h-screen">
        <h1 className="text-2xl mb-4">Vidstack Test - Error</h1>
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  if (!streamUrl) {
    return (
      <div className="p-8 text-white bg-slate-900 min-h-screen">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <h1 className="text-xl mb-4">Vidstack Test - Movie ID: {movieId}</h1>
      <div className="max-w-5xl mx-auto">
        <MediaPlayer
          title={`Movie ${movieId}`}
          src={streamUrl}
          crossOrigin
          playsInline
          className="w-full aspect-video bg-black"
        >
          <MediaProvider>
            {tracks.map((track) => (
              <Track
                key={String(track.index)}
                src={track.src}
                kind="subtitles"
                label={track.label}
                lang={track.lang}
                default={track.index === tracks[0]?.index}
              />
            ))}
          </MediaProvider>
          <DefaultVideoLayout icons={defaultLayoutIcons} />
        </MediaPlayer>

        {audioInfo && (
          <div className="mt-4 p-4 bg-slate-800 rounded">
            <h3 className="font-bold mb-2">Audio Tracks (read-only):</h3>
            <pre className="text-sm whitespace-pre-wrap">{audioInfo}</pre>
          </div>
        )}

        <div className="mt-4 p-4 bg-slate-800 rounded text-xs">
          <p>Stream URL: <code>{streamUrl}</code></p>
          <p>Subtitle tracks loaded: {tracks.length}</p>
        </div>
      </div>
    </div>
  )
}
