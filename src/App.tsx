import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import Onboarding from './pages/Onboarding'
import Loading from './pages/Loading'
import HomePage from './pages/HomePage'
import ChannelCategories from './pages/ChannelCategories'
import CategoryChannelList from './pages/CategoryChannelList'
import TestPlayer from './pages/TestPlayer'
import Watch from './pages/Watch'
import SeriesDetail from './pages/SeriesDetail'
import SearchPage from './pages/SearchPage'
import { usePlaylistStore } from './stores/playlistStore'

function AppContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loaded, loadSourcesFromDb } = usePlaylistStore()
  const initialRouteHandled = useRef(false)

  useEffect(() => {
    if (initialRouteHandled.current) return
    if (!loaded) {
      loadSourcesFromDb().then(() => {
        const { sources } = usePlaylistStore.getState()
        const pathname = location.pathname

        if (sources.length === 0) {
          if (pathname !== '/') {
            navigate('/', { replace: true })
          }
        } else {
          if (pathname === '/' || pathname === '/loading') {
            navigate('/live', { replace: true })
          }
        }
        initialRouteHandled.current = true
      })
    } else {
      initialRouteHandled.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!loaded) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Onboarding />} />
      <Route path="/loading" element={<Loading />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/live" element={<ChannelCategories />} />
      <Route path="/live/:categoryId" element={<CategoryChannelList />} />
      <Route path="/movies" element={<Navigate to="/live?tab=movies" replace />} />
      <Route path="/series" element={<Navigate to="/live?tab=series" replace />} />
      <Route path="/series/:seriesId" element={<SeriesDetail />} />
      <Route path="/watch/:channelId" element={<Watch />} />
      <Route path="/watch/episode/:episodeId" element={<Watch />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/test-player" element={<TestPlayer />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App