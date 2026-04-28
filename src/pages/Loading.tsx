import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { usePlaylistStore } from '../stores/playlistStore'
import { useBrowseStore } from '../stores/browseStore'
import { syncXtreamPlaylist, type SyncProgress } from '../lib/xtreamSync'

const syncsInFlight = new Set<string>()

export default function Loading() {
  const navigate = useNavigate()
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const source = usePlaylistStore.getState().getActiveSource()
    if (!source) {
      navigate('/')
      return
    }

    if (source.type === 'm3u-url') {
      setError('M3U URL support is not yet available. Please use Xtream Codes.')
      return
    }

    if (syncsInFlight.has(source.id)) {
      console.log('[Loading] Sync already in flight for this source, skipping duplicate')
      return
    }
    syncsInFlight.add(source.id)

    let cancelled = false

    syncXtreamPlaylist(source, (update) => {
      if (cancelled) return
      setProgress(update)
      if (update.phase === 'complete') {
        // Invalidate browse cache so fresh data is loaded from Dexie
        useBrowseStore.getState().invalidateCache()
        setTimeout(() => {
          if (!cancelled) navigate('/home')
        }, 400)
      }
    }).catch((err: unknown) => {
      if (cancelled) return
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    }).finally(() => {
      syncsInFlight.delete(source.id)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRetry = () => {
    setError(null)
    setProgress(null)
    window.location.reload()
  }

  const handleBack = () => {
    navigate('/')
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Sync Failed</h2>
            <p className="text-red-400 text-sm break-words">{error}</p>
          </div>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50 min-h-[44px]"
            >
              Try Again
            </button>
            <button
              onClick={handleBack}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg focus:outline-none focus:ring-4 focus:ring-slate-500/50 min-h-[44px]"
            >
              Back to Onboarding
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Loader2 className="w-16 h-16 mx-auto mb-6 text-indigo-500 animate-spin" />
          <h2 className="text-3xl font-bold text-white mb-3">Loading playlist...</h2>
          {progress && <p className="text-slate-400 text-base">{progress.message}</p>}
        </div>

        {progress && progress.phase !== 'complete' && (
          <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
            <div className="w-full bg-slate-800 rounded-full h-3 mb-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{progress.phase.replace(/-/g, ' ')}</span>
              <span className="text-slate-400">{Math.round(progress.percent)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
