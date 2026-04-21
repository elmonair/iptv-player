import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import Onboarding from './pages/Onboarding'
import Loading from './pages/Loading'
import Home from './pages/Home'
import { usePlaylistStore } from './stores/playlistStore'

function AppContent() {
  const navigate = useNavigate()
  const { loaded, loadSourcesFromDb } = usePlaylistStore()

  useEffect(() => {
    loadSourcesFromDb().then(() => {
      const { sources } = usePlaylistStore.getState()
      if (sources.length > 0) {
        navigate('/home')
      } else {
        navigate('/')
      }
    })
  }, [navigate, loadSourcesFromDb])

  if (!loaded) {
    return <Loading />
  }

  return (
    <Routes>
      <Route path="/" element={<Onboarding />} />
      <Route path="/loading" element={<Loading />} />
      <Route path="/home" element={<Home />} />
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
