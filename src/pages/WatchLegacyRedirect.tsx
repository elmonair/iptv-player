import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export default function WatchLegacyRedirect() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    if (!id) {
      navigate('/home', { replace: true })
      return
    }

    const decoded = id.includes('%') ? decodeURIComponent(id) : id

    if (decoded.includes(':movie-')) {
      navigate(`/watch/movie/${id}`, { replace: true })
    } else if (decoded.includes(':live-')) {
      navigate(`/watch/live/${id}`, { replace: true })
    } else if (decoded.includes(':episode-') || decoded.includes(':series-')) {
      navigate(`/watch/episode/${id}`, { replace: true })
    } else {
      console.warn('[WatchLegacyRedirect] Unknown ID format:', decoded)
      navigate('/home', { replace: true })
    }
  }, [id, navigate])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-slate-400">Redirecting...</div>
    </div>
  )
}