import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlaylistStore } from '../stores/playlistStore'
import { db } from '../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'

export default function Home() {
  const navigate = useNavigate()
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const clearAllData = usePlaylistStore((state) => state.clearAllData)

  const source = getActiveSource()
  const [isClearing, setIsClearing] = useState(false)

  const counts = useLiveQuery(
    async () => {
      if (!source) return null

      const [channels, movies, series] = await Promise.all([
        db.channels.where('sourceId').equals(source.id).count(),
        db.movies.where('sourceId').equals(source.id).count(),
        db.series.where('sourceId').equals(source.id).count(),
      ])

      return { channels, movies, series }
    },
    [source],
  )

  const handleClearData = async () => {
    if (!confirm('Are you sure? This will delete all playlists and encryption keys.')) {
      return
    }

    setIsClearing(true)
    await clearAllData()
    navigate('/')
  }

  const handleResync = () => {
    navigate('/loading')
  }

  if (!source) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6">
        <p className="text-slate-400 text-lg">No playlist found</p>
      </div>
    )
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">Welcome back</h1>
          <p className="text-lg text-slate-400">Your playlist: {source.name}</p>
          <p className="text-base text-slate-500 mt-2">Type: {source.type === 'm3u-url' ? 'M3U URL' : 'Xtream Codes'}</p>
          <p className="text-base text-slate-500 mt-1">Created: {formatDate(source.createdAt)}</p>
        </div>

        {counts === undefined && (
          <div className="text-center mb-6">
            <p className="text-slate-500 text-sm">Loading catalog info...</p>
          </div>
        )}

        {counts !== undefined && !counts && (
          <div className="text-center mb-6">
            <p className="text-slate-500 text-sm">No catalog data available. Sync your playlist to see content.</p>
          </div>
        )}

        {counts && (counts.channels > 0 || counts.movies > 0 || counts.series > 0) && (
          <div className="bg-slate-900 rounded-xl p-6 mb-6 border border-slate-800">
            <h2 className="text-xl font-semibold text-white mb-4">Catalog Summary</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-400 mb-1">{counts.channels.toLocaleString()}</div>
                <div className="text-sm text-slate-400">Live Channels</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-400 mb-1">{counts.movies.toLocaleString()}</div>
                <div className="text-sm text-slate-400">Movies</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-400 mb-1">{counts.series.toLocaleString()}</div>
                <div className="text-sm text-slate-400">Series</div>
              </div>
            </div>
          </div>
        )}

        {counts && !(counts.channels > 0 || counts.movies > 0 || counts.series > 0) && (
          <div className="text-center mb-6">
            <p className="text-slate-500 text-sm">No catalog data available. Sync your playlist to see content.</p>
          </div>
        )}

        <div className="flex gap-4 justify-center mb-4">
          {source.type === 'xtream' && (
            <button
              onClick={handleResync}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50 min-h-[44px]"
            >
              Re-sync Playlist
            </button>
          )}
          {source.type === 'm3u-url' && (
            <p className="text-slate-500 text-sm py-3">M3U URL sync coming in Step 9B</p>
          )}
        </div>

        <button
          onClick={handleClearData}
          disabled={isClearing}
          className="fixed top-4 right-4 text-red-500 text-sm hover:text-red-400 focus:outline-none focus:underline disabled:opacity-50"
        >
          {isClearing ? 'Clearing...' : 'Clear all data (dev only)'}
        </button>
      </div>
    </div>
  )
}
