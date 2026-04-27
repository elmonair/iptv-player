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
import MovieDetail from './pages/MovieDetail'
import WatchLegacyRedirect from './pages/WatchLegacyRedirect'
import SearchPage from './pages/SearchPage'
import EpgPage from './pages/EpgPage'
import ErrorBoundary from './components/ErrorBoundary'
import { usePlaylistStore } from './stores/playlistStore'
import { useFavoritesStore } from './stores/favoritesStore'
import { useWatchHistoryStore } from './stores/watchHistoryStore'
import { db } from './lib/db'
import { parseAndStoreXmltv, clearEpgForSource } from './lib/epgParser'

function AppContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loaded, loadSourcesFromDb, getActiveSource, activeSourceId } = usePlaylistStore()
  const loadFavorites = useFavoritesStore((state) => state.loadFavorites)
  const loadWatchHistory = useWatchHistoryStore((state) => state.loadWatchHistory)
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

          const activeSource = getActiveSource()
          if (activeSource) {
            loadFavorites(activeSource.id).catch(console.error)
            loadWatchHistory(activeSource.id).catch(console.error)

            if (activeSource.type === 'xtream') {
              const now = Date.now()
              const oneDayMs = 24 * 60 * 60 * 1000
              db.syncMetadata.where('sourceId').equals(activeSource.id).first().then((meta) => {
                if (!meta?.lastEpgSyncAt || now - meta.lastEpgSyncAt > oneDayMs) {
                  console.log('[App] Auto-syncing EPG (last sync was > 24h ago or never)')
                  clearEpgForSource(activeSource.id).catch(() => {})
                  parseAndStoreXmltv(
                    activeSource.serverUrl,
                    activeSource.username,
                    activeSource.password,
                    activeSource.id
                  ).catch((err) => console.warn('[App] Auto EPG sync failed:', err))
                }
              })
            }
          }
        }
        initialRouteHandled.current = true
      })
    } else {
      const activeSource = getActiveSource()
      if (activeSource) {
        loadFavorites(activeSource.id).catch(console.error)
        loadWatchHistory(activeSource.id).catch(console.error)
      }
      initialRouteHandled.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (activeSourceId) {
      loadFavorites(activeSourceId).catch(console.error)
      loadWatchHistory(activeSourceId).catch(console.error)
    }
  }, [activeSourceId, loadFavorites, loadWatchHistory])

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
      <Route path="/movie/:movieId" element={<MovieDetail />} />
      <Route path="/watch/live/:id" element={<Watch />} />
      <Route path="/watch/movie/:id" element={<Watch />} />
      <Route path="/watch/episode/:episodeId" element={<Watch />} />
      <Route path="/watch/:id" element={<WatchLegacyRedirect />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/epg" element={<EpgPage />} />
      <Route path="/test-player" element={<TestPlayer />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </BrowserRouter>
  )
}

export default App