import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Onboarding from './pages/Onboarding'
import Loading from './pages/Loading'
import HomePage from './pages/HomePage'
import ChannelCategories from './pages/ChannelCategories'
import CategoryChannelList from './pages/CategoryChannelList'
import Movies from './pages/Movies'
import Series from './pages/Series'
import TestPlayer from './pages/TestPlayer'
import Watch from './pages/Watch'
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
      <Route path="/movies" element={<Movies />} />
      <Route path="/series" element={<Series />} />
      <Route path="/watch/:channelId" element={<Watch />} />
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