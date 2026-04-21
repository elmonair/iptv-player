import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlaylistStore } from '../stores/playlistStore'

export default function Home() {
  const navigate = useNavigate()
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const clearAllData = usePlaylistStore((state) => state.clearAllData)

  const source = getActiveSource()
  const [isClearing, setIsClearing] = useState(false)

  const handleClearData = async () => {
    if (!confirm('Are you sure? This will delete all playlists and encryption keys.')) {
      return
    }

    setIsClearing(true)
    await clearAllData()
    navigate('/')
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

        <div className="text-center">
          <p className="text-slate-600 text-sm mb-4">Channel list, movies, and series will appear here in the next step.</p>
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
