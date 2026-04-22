import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Onboarding from './pages/Onboarding'
import Loading from './pages/Loading'
import Home from './pages/Home'
import LiveTV from './pages/LiveTV'
import Movies from './pages/Movies'
import Series from './pages/Series'
import TestPlayer from './pages/TestPlayer'
import AppLayout from './components/AppLayout'
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
        if (location.pathname === '/') {
          const { sources } = usePlaylistStore.getState()
          if (sources.length > 0) {
            navigate('/home', { replace: true })
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
      <Route element={<AppLayout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/live" element={<LiveTV />} />
        <Route path="/movies" element={<Movies />} />
        <Route path="/series" element={<Series />} />
      </Route>
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