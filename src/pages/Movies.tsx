import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X, Film } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { usePlaylistStore } from '../stores/playlistStore'
import { db } from '../lib/db'
import MovieCategories from '../components/movies/MovieCategories'
import MovieGrid from '../components/movies/MovieGrid'
import type { MovieRecord } from '../lib/db'

export default function Movies() {
  const navigate = useNavigate()
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const activeSource = getActiveSource()
  const selectedCategoryId = usePlaylistStore((state) => state.selectedMovieCategoryId)
  const setSelectedCategoryId = usePlaylistStore((state) => state.setSelectedMovieCategoryId)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const categoryName = useLiveQuery(
    async () => {
      if (!selectedCategoryId) return null
      const cat = await db.categories.get(selectedCategoryId)
      return cat?.name ?? null
    },
    [selectedCategoryId],
  )

  if (!activeSource) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400 text-base">No playlist active. Add one from settings.</p>
      </div>
    )
  }

  const handleMovieClick = (movie: MovieRecord) => {
    console.log('[Movies] Movie clicked:', { name: movie.name, streamId: movie.streamId })
    navigate(`/movie/${encodeURIComponent(movie.id)}`)
  }

  const handleBackToCategories = () => {
    setSelectedCategoryId(null)
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Category sidebar - Sticky on desktop */}
      <aside
        className={`
          hidden md:sticky md:top-0 md:h-screen md:w-64 md:flex-shrink-0 md:border-r md:border-slate-700 md:bg-slate-900 md:flex md:flex-col
          fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 z-50"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
        <MovieCategories
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={(id) => {
            setSelectedCategoryId(id)
            setSidebarOpen(false)
          }}
          sourceId={activeSource.id}
        />
      </aside>

      {/* Desktop toggle button */}
      <button
        onClick={() => setSidebarOpen((v) => !v)}
        className="hidden md:flex w-6 h-full flex-shrink-0 bg-slate-900 border-r border-slate-800 items-center justify-center hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        aria-label={sidebarOpen ? 'Hide categories' : 'Show categories'}
      >
        {sidebarOpen ? (
          <ChevronLeft className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {/* Mobile category toggle button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="md:hidden fixed bottom-6 left-4 w-12 h-12 bg-violet-600 hover:bg-violet-500 rounded-full shadow-lg flex items-center justify-center text-white transition-colors focus:outline-none focus:ring-4 focus:ring-violet-500/50 z-20"
        aria-label="Show categories"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex-1 h-full overflow-y-auto flex flex-col min-h-0">
        {/* Content header */}
        <div className="flex-shrink-0 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-3">
          <Film className="w-5 h-5 text-violet-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-semibold text-base truncate">
              {categoryName ?? 'All Movies'}
            </h1>
          </div>
        </div>

        <MovieGrid
          sourceId={activeSource.id}
          selectedCategoryId={selectedCategoryId}
          onMovieClick={handleMovieClick}
          onBackToCategories={handleBackToCategories}
          categoryName={categoryName ?? undefined}
        />
      </div>
    </div>
  )
}