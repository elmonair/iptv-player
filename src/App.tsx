import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Onboarding from './pages/Onboarding'
import Loading from './pages/Loading'
import Home from './pages/Home'
import TestPlayer from './pages/TestPlayer'
import { usePlaylistStore } from './stores/playlistStore'

function AppContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loaded, loadSourcesFromDb } = usePlaylistStore()
  const initialRouteHandled = useRef(false)

  useEffect(() => {
    // Only run the initial routing logic ONCE
    if (initialRouteHandled.current) return
    if (!loaded) {
      // Load sources from DB first
      loadSourcesFromDb().then(() => {
        // Only redirect if we're on the root path (initial load)
        // Respect the user's URL if they deep-linked
        if (location.pathname === '/') {
          const { sources } = usePlaylistStore.getState()
          if (sources.length === 0) {
            // Stay on / (Onboarding)
          }
          // If sources exist, stay on / is fine too — user can manually go to /home
          // Actually, if sources exist and we're on root, go to home
          const hasSources = sources.length > 0
          if (hasSources) {
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
      <Route path="/home" element={<Home />} />
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