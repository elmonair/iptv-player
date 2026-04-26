import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, ArrowLeft, Loader2, Tv2, Film, Monitor, X } from 'lucide-react'
import { usePlaylistStore } from '../stores/playlistStore'
import { useBrowseStore } from '../stores/browseStore'
import { db } from '../lib/db'
import { TopNavBar } from '../components/TopNavBar'
import { formatRating } from '../lib/metadata'
import type { ChannelRecord, MovieRecord, SeriesRecord } from '../lib/db'

type SearchResult = {
  channels: ChannelRecord[]
  movies: MovieRecord[]
  series: SeriesRecord[]
}

type SearchFilters = {
  channels: boolean
  movies: boolean
  series: boolean
}

// Safe string helper
function safeString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

// Safe name getter for any item
function getItemName(item: unknown): string {
  if (!item || typeof item !== 'object') return ''
  const obj = item as Record<string, unknown>
  return safeString(
    obj?.name ??
    obj?.title ??
    obj?.category_name ??
    obj?.stream_name ??
    obj?.series_name ??
    ''
  )
}

// Check if item matches query
function matchesQuery(item: unknown, query: string): boolean {
  const q = safeString(query).toLowerCase().trim()
  if (!q) return false

  const obj = item as Record<string, unknown>
  const searchableText = [
    obj?.name,
    obj?.title,
    obj?.stream_name,
    obj?.series_name,
    obj?.category_name,
    obj?.genre,
    obj?.plot,
    obj?.year,
  ]
    .map(safeString)
    .join(' ')
    .toLowerCase()

  return searchableText.includes(q)
}

// Highlight matching text
function highlightMatch(text: string, query: string): React.ReactNode {
  const value = safeString(text)
  const q = safeString(query).trim()

  if (!q || !value) return value || <span className="text-slate-500">Untitled</span>

  try {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escaped})`, 'ig')
    const parts = value.split(regex)
    
    return parts.map((part, index) => {
      if (part.toLowerCase() === q.toLowerCase()) {
        return <span key={index} className="bg-indigo-500/30 text-indigo-300">{part}</span>
      }
      return <span key={index}>{part}</span>
    })
  } catch (e) {
    return value
  }
}

export default function SearchPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult>({ channels: [], movies: [], series: [] })
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({ channels: true, movies: true, series: true })
  const inputRef = useRef<HTMLInputElement>(null)

  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const activeSource = getActiveSource()
  const { setSection, setSelectedSeries, setFocusedItem } = useBrowseStore()

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !activeSource) {
      setResults({ channels: [], movies: [], series: [] })
      return
    }

    setLoading(true)

    try {
      console.log('[Search] Searching for:', searchQuery)

      const searchResults: SearchResult = {
        channels: [],
        movies: [],
        series: [],
      }

      if (filters.channels) {
        const allChannels = await db.channels.where('sourceId').equals(activeSource.id).toArray()
        const channels = Array.isArray(allChannels) ? allChannels : []
        console.log('[Search] Total channels:', channels.length)
        searchResults.channels = channels.filter(c => matchesQuery(c, searchQuery)).slice(0, 20)
        console.log('[Search] Channel matches:', searchResults.channels.length)
      }

      if (filters.movies) {
        const allMovies = await db.movies.where('sourceId').equals(activeSource.id).toArray()
        const movies = Array.isArray(allMovies) ? allMovies : []
        console.log('[Search] Total movies:', movies.length)
        searchResults.movies = movies.filter(m => matchesQuery(m, searchQuery)).slice(0, 20)
        console.log('[Search] Movie matches:', searchResults.movies.length)
      }

      if (filters.series) {
        const allSeries = await db.series.where('sourceId').equals(activeSource.id).toArray()
        const series = Array.isArray(allSeries) ? allSeries : []
        console.log('[Search] Total series:', series.length)
        searchResults.series = series.filter(s => matchesQuery(s, searchQuery)).slice(0, 20)
        console.log('[Search] Series matches:', searchResults.series.length)
      }

      console.log('[Search] Total results:', {
        channels: searchResults.channels.length,
        movies: searchResults.movies.length,
        series: searchResults.series.length,
      })

      setResults(searchResults)
    } catch (err) {
      console.error('[Search] Search failed:', err)
      setResults({ channels: [], movies: [], series: [] })
    } finally {
      setLoading(false)
    }
  }, [activeSource, filters])

  // Debounce effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(query)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, performSearch])

  const handleClear = () => {
    setQuery('')
    setResults({ channels: [], movies: [], series: [] })
    inputRef.current?.focus()
  }

  const handleChannelClick = (channel: ChannelRecord) => {
    const from = location.pathname + location.search

    console.log('[SearchPage] Open channel:', {
      current: from,
      channelId: channel.id,
      channelName: channel.name,
      state: { from, tab: 'channels' }
    })

    navigate(`/watch/live/${encodeURIComponent(channel.id)}`, {
      state: { from, tab: 'channels', scrollY: 0 }
    })
  }

  const handleMovieClick = (movie: MovieRecord) => {
    const from = location.pathname + location.search

    console.log('[SearchPage] Open movie:', {
      current: from,
      movieId: movie.id,
      movieName: movie.name,
      state: { from, tab: 'movies' }
    })

    navigate(`/watch/movie/${encodeURIComponent(movie.id)}`, {
      state: { from, tab: 'movies', scrollY: 0 }
    })
  }

  const handleSeriesClick = (series: SeriesRecord) => {
    setSection('series')
    setSelectedSeries(series.externalId)
    setFocusedItem(series.id)
    navigate(`/series/${encodeURIComponent(series.externalId)}`)
  }

  const totalResults = results.channels.length + results.movies.length + results.series.length

  const toggleFilter = (key: keyof SearchFilters) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (!activeSource) {
    return (
      <div className="h-screen bg-slate-900 flex flex-col">
        <TopNavBar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-400">No playlist active</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      <TopNavBar />

      {/* Search Header */}
      <div className="flex-shrink-0 bg-slate-800 border-b border-slate-700 p-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/live')}
            className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline font-medium">Back</span>
          </button>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search channels, movies, series..."
              className="w-full bg-slate-900 text-white placeholder-slate-500 pl-10 pr-10 py-3 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-base"
            />
            {query && (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                aria-label="Clear search"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-400 text-sm mr-2">Search in:</span>
          <FilterButton
            active={filters.channels}
            onClick={() => toggleFilter('channels')}
            icon={<Tv2 className="w-4 h-4" />}
            label="Channels"
          />
          <FilterButton
            active={filters.movies}
            onClick={() => toggleFilter('movies')}
            icon={<Film className="w-4 h-4" />}
            label="Movies"
          />
          <FilterButton
            active={filters.series}
            onClick={() => toggleFilter('series')}
            icon={<Monitor className="w-4 h-4" />}
            label="Series"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        )}

        {!loading && query.trim() && totalResults === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400 text-lg">No results found for &quot;{query}&quot;</p>
            <p className="text-slate-500 text-sm mt-2">Try a different search term</p>
          </div>
        )}

        {!loading && !query.trim() && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">Start typing to search</p>
            <p className="text-slate-500 text-sm mt-2">Search across all your content</p>
          </div>
        )}

        {/* Channels Section */}
        {results.channels.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Tv2 className="w-5 h-5 text-indigo-400" />
              Channels ({results.channels.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {results.channels.map(channel => (
                <ChannelResultCard
                  key={channel.id}
                  channel={channel}
                  onClick={() => handleChannelClick(channel)}
                  highlight={query}
                />
              ))}
            </div>
          </section>
        )}

        {/* Movies Section */}
        {results.movies.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Film className="w-5 h-5 text-indigo-400" />
              Movies ({results.movies.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {results.movies.map(movie => (
                <MovieResultCard
                  key={movie.id}
                  movie={movie}
                  onClick={() => handleMovieClick(movie)}
                  highlight={query}
                />
              ))}
            </div>
          </section>
        )}

        {/* Series Section */}
        {results.series.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Monitor className="w-5 h-5 text-indigo-400" />
              Series ({results.series.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {results.series.map(series => (
                <SeriesResultCard
                  key={series.id}
                  series={series}
                  onClick={() => handleSeriesClick(series)}
                  highlight={query}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

// Filter Button Component
type FilterButtonProps = {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}

function FilterButton({ active, onClick, icon, label }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
        active
          ? 'bg-indigo-600 text-white'
          : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

// Channel Result Card
type ChannelResultCardProps = {
  channel: ChannelRecord
  onClick: () => void
  highlight: string
}

function ChannelResultCard({ channel, onClick, highlight }: ChannelResultCardProps) {
  const [imageError, setImageError] = useState(false)
  const name = getItemName(channel)
  const initial = (name.charAt(0) || '?').toUpperCase()

  return (
    <button
      onClick={onClick}
      className="group bg-slate-800 rounded-lg overflow-hidden border border-slate-700 hover:border-indigo-500 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-left"
    >
      <div className="relative aspect-video bg-slate-900 flex items-center justify-center p-3">
        {!imageError && channel.logoUrl ? (
          <img
            src={channel.logoUrl}
            alt={name || 'Channel'}
            className="w-full h-full object-contain"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
            <span className="text-white text-xl font-bold">{initial}</span>
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-white text-sm font-medium truncate" title={name || undefined}>
          {name ? highlightMatch(name, highlight) : <span className="text-slate-500">Untitled</span>}
        </p>
      </div>
    </button>
  )
}

// Movie Result Card
type MovieResultCardProps = {
  movie: MovieRecord
  onClick: () => void
  highlight: string
}

function MovieResultCard({ movie, onClick, highlight }: MovieResultCardProps) {
  const [imageError, setImageError] = useState(false)
  const name = getItemName(movie)
  const initial = (name.charAt(0) || '?').toUpperCase()
  const year = safeString(movie.year)
  const genre = safeString(movie.genre)

  return (
    <button
      onClick={onClick}
      className="group bg-slate-800 rounded-lg overflow-hidden border border-slate-700 hover:border-indigo-500 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-left"
    >
      <div className="relative aspect-[2/3] bg-slate-900 flex items-center justify-center">
        {!imageError && movie.logoUrl ? (
          <img
            src={movie.logoUrl}
            alt={name || 'Movie'}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">{initial}</span>
          </div>
        )}
        {year && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
            {year}
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-white text-sm font-medium truncate" title={name || undefined}>
          {name ? highlightMatch(name, highlight) : <span className="text-slate-500">Untitled</span>}
        </p>
        {genre && (
          <p className="text-slate-500 text-xs truncate">{genre}</p>
        )}
      </div>
    </button>
  )
}

// Series Result Card
type SeriesResultCardProps = {
  series: SeriesRecord
  onClick: () => void
  highlight: string
}

function SeriesResultCard({ series, onClick, highlight }: SeriesResultCardProps) {
  const [imageError, setImageError] = useState(false)
  const name = getItemName(series)
  const initial = (name.charAt(0) || '?').toUpperCase()
  const genre = safeString(series.genre)
  const rating = formatRating(series.rating)

  return (
    <button
      onClick={onClick}
      className="group bg-slate-800 rounded-lg overflow-hidden border border-slate-700 hover:border-indigo-500 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-left"
    >
      <div className="relative aspect-[2/3] bg-slate-900 flex items-center justify-center">
        {!imageError && (series.backdropUrl || series.logoUrl) ? (
          <img
            src={series.backdropUrl || series.logoUrl}
            alt={name || 'Series'}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">{initial}</span>
          </div>
        )}
        {rating && rating !== 'N/A' && (
          <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded">
            {rating}
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-white text-sm font-medium truncate" title={name || undefined}>
          {name ? highlightMatch(name, highlight) : <span className="text-slate-500">Untitled</span>}
        </p>
        {genre && (
          <p className="text-slate-500 text-xs truncate">{genre}</p>
        )}
      </div>
    </button>
  )
}