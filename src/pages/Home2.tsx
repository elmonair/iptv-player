import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Film, Tv, Clapperboard, Settings, User, Info, Plus, RefreshCw, Trash2, CheckCircle, Clock, Play } from 'lucide-react'
import { TopNavBar } from '../components/TopNavBar'
import { AddPlaylistModal } from '../components/AddPlaylistModal'
import { EditPlaylistModal } from '../components/EditPlaylistModal'
import { usePlaylistStore } from '../stores/playlistStore'
import { useWatchHistoryStore } from '../stores/watchHistoryStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { XtreamSource } from '../stores/playlistStore'

export default function Home2() {
  const navigate = useNavigate()
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const setActiveSource = usePlaylistStore((state) => state.setActiveSource)
  const removeSource = usePlaylistStore((state) => state.removeSource)
  const storeSources = usePlaylistStore((state) => state.sources)
  const loadSourcesFromDb = usePlaylistStore((state) => state.loadSourcesFromDb)
  const [showAddPlaylist, setShowAddPlaylist] = useState(false)
  const [editingSource, setEditingSource] = useState<XtreamSource | null>(null)

  const activeSource = getActiveSource()

  const counts = useLiveQuery(
    async () => {
      if (!activeSource) return null
      const [channels, movies, series] = await Promise.all([
        db.channels.where('sourceId').equals(activeSource.id).count(),
        db.movies.where('sourceId').equals(activeSource.id).count(),
        db.series.where('sourceId').equals(activeSource.id).count(),
      ])
      return { channels, movies, series }
    },
    [activeSource],
  )

  const handleEditSource = async (id: string) => {
    const src = storeSources.find(s => s.id === id && s.type === 'xtream')
    if (!src) {
      await loadSourcesFromDb()
    }
    const updatedSrc = usePlaylistStore.getState().sources.find(s => s.id === id && s.type === 'xtream')
    if (updatedSrc) {
      setEditingSource(updatedSrc as XtreamSource)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <TopNavBar />

      <main className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 space-y-6 sm:space-y-8">

        {/* Welcome Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Welcome Card */}
          <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2">
              Welcome back, {activeSource?.name || 'User'}!
            </h1>
            <p className="text-slate-400 text-sm sm:text-base mb-1">Your playlist: {activeSource?.name}</p>
            <p className="text-slate-500 text-xs sm:text-sm truncate mb-4">
              {activeSource?.type === 'xtream' ? activeSource.serverUrl : activeSource?.url || ''}
            </p>
            <button
              onClick={() => navigate('/settings')}
              className="px-3 sm:px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[44px]"
            >
              Manage Playlists
            </button>
          </div>

          {/* Subscription Card */}
          <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-white">Subscription Info</h2>
              <span className="flex items-center gap-1 text-green-400 text-xs sm:text-sm">
                <CheckCircle size={14} className="sm:size-4" />
                Active
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="text-center p-2 sm:p-3 bg-slate-900 rounded-lg">
                <p className="text-xl sm:text-2xl font-bold text-yellow-500">
                  {counts?.channels?.toLocaleString() ?? '-'}
                </p>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Channels</p>
              </div>
              <div className="text-center p-2 sm:p-3 bg-slate-900 rounded-lg">
                <p className="text-xl sm:text-2xl font-bold text-yellow-500">
                  {counts?.movies?.toLocaleString() ?? '-'}
                </p>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Movies</p>
              </div>
              <div className="text-center p-2 sm:p-3 bg-slate-900 rounded-lg">
                <p className="text-xl sm:text-2xl font-bold text-yellow-500">
                  {counts?.series?.toLocaleString() ?? '-'}
                </p>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Series</p>
              </div>
            </div>
          </div>
        </div>

        {/* Continue Watching */}
        <ContinueWatchingSection navigate={navigate} />

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-white mb-3 sm:mb-4">Quick Actions</h2>
          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4">
            <QuickActionButton
              icon={<Tv size={20} className="sm:size-6" />}
              label="Live TV"
              onClick={() => navigate('/live')}
            />
            <QuickActionButton
              icon={<Film size={20} className="sm:size-6" />}
              label="Movies"
              onClick={() => navigate('/live?tab=movies')}
            />
            <QuickActionButton
              icon={<Clapperboard size={20} className="sm:size-6" />}
              label="Series"
              onClick={() => navigate('/live?tab=series')}
            />
            <QuickActionButton
              icon={<Settings size={20} className="sm:size-6" />}
              label="Settings"
              onClick={() => navigate('/settings')}
            />
            <QuickActionButton
              icon={<User size={20} className="sm:size-6" />}
              label="Profile"
              onClick={() => {}}
            />
            <QuickActionButton
              icon={<Info size={20} className="sm:size-6" />}
              label="About"
              onClick={() => {}}
            />
          </div>
        </div>

        {/* Playlist Management */}
        <div>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-white">Your Playlists</h2>
            <button
              onClick={() => setShowAddPlaylist(true)}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-xs sm:text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 sm:ring-4 focus:ring-yellow-500/50 min-h-[44px]"
            >
              <Plus size={16} className="sm:size-[18px]" />
              <span className="hidden sm:inline">Add New</span>
            </button>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {storeSources.map((source) => {
              const isXtream = source.type === 'xtream'
              return (
                <PlaylistCard
                  key={source.id}
                  name={source.name}
                  type={isXtream ? 'Xtream Codes' : 'M3U URL'}
                  isActive={source.id === activeSource?.id}
                  onEdit={() => isXtream && handleEditSource(source.id)}
                  onDelete={() => removeSource(source.id)}
                  onActivate={() => setActiveSource(source.id)}
                  onResync={() => navigate('/loading')}
                />
              )
            })}
          </div>
        </div>
      </main>

      {showAddPlaylist && (
        <AddPlaylistModal
          onClose={() => setShowAddPlaylist(false)}
          onSuccess={() => navigate('/loading')}
        />
      )}

      {editingSource && (
        <EditPlaylistModal
          source={editingSource}
          onClose={() => setEditingSource(null)}
          onSuccess={() => {}}
        />
      )}
    </div>
  )
}

type QuickActionButtonProps = {
  icon: React.ReactNode
  label: string
  onClick: () => void
}

function QuickActionButton({ icon, label, onClick }: QuickActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 sm:gap-2 p-3 sm:p-4 md:p-6 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[80px] sm:min-h-[90px] md:min-h-[100px]"
    >
      <div className="text-yellow-500">{icon}</div>
      <span className="text-[10px] sm:text-xs md:text-sm font-medium text-white text-center">{label}</span>
    </button>
  )
}

type ContinueWatchingSectionProps = {
  navigate: (path: string) => void
}

function ContinueWatchingSection({ navigate }: ContinueWatchingSectionProps) {
  const getContinueWatching = useWatchHistoryStore((state) => state.getContinueWatching)
  const continueWatching = getContinueWatching()

  if (continueWatching.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
          <Clock size={18} className="sm:size-5 text-yellow-500" />
          Continue Watching
        </h2>
      </div>
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
        {continueWatching.slice(0, 6).map((item) => (
          <ContinueWatchingCard key={item.id} item={item} navigate={navigate} />
        ))}
      </div>
    </div>
  )
}

type ContinueWatchingCardProps = {
  item: {
    itemType: 'channel' | 'movie' | 'episode'
    itemId: string
    position: number
    duration: number | null
  }
  navigate: (path: string, state?: object) => void
}

function ContinueWatchingCard({ item, navigate }: ContinueWatchingCardProps) {
  const location = useLocation()
  const content = useLiveQuery(
    async () => {
      if (item.itemType === 'channel') {
        return db.channels.where('id').equals(item.itemId).first()
      } else if (item.itemType === 'movie') {
        return db.movies.where('id').equals(item.itemId).first()
      } else if (item.itemType === 'episode') {
        const episode = await db.episodes.where('id').equals(item.itemId).first()
        if (episode) {
          const series = await db.series.where('id').equals(episode.seriesId).first()
          return { episode, series }
        }
      }
      return null
    },
    [item.itemId, item.itemType],
  )

  if (!content) return null

  const handleClick = () => {
    const from = location.pathname + location.search

    if (item.itemType === 'channel') {
      navigate(`/watch/live/${encodeURIComponent(item.itemId)}`, {
        state: { from, tab: 'channels', scrollY: 0 }
      })
    } else if (item.itemType === 'movie') {
      navigate(`/watch/movie/${encodeURIComponent(item.itemId)}`, {
        state: { from, tab: 'movies', scrollY: 0 }
      })
    } else if (item.itemType === 'episode' && 'episode' in content) {
      const { episode, series } = content
      const seriesId = series?.externalId || series?.id
      navigate(`/watch/episode/${episode.id}`, {
        state: {
          from,
          tab: 'series',
          seriesId,
          seasonId: episode.seasonNumber,
          seriesName: series?.name || 'Unknown',
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          episodeTitle: episode.title || `Episode ${episode.episodeNumber}`,
          containerExtension: episode.containerExtension,
          streamId: episode.streamId,
        },
      })
    }
  }

  const progressPercent = item.duration && item.duration > 0 ? (item.position / item.duration) * 100 : 0
  const timeRemaining = item.duration && item.duration > 0 ? Math.floor((item.duration - item.position) / 60) : 0

  let title = ''
  let subtitle = ''
  let imageSrc = ''

  if (item.itemType === 'channel') {
    const channel = content as { name: string; logoUrl?: string }
    title = channel.name
    subtitle = 'Live Channel'
    imageSrc = channel.logoUrl || ''
  } else if (item.itemType === 'movie') {
    const movie = content as { name: string; logoUrl?: string; backdropUrl?: string }
    title = movie.name
    subtitle = 'Movie'
    imageSrc = movie.backdropUrl || movie.logoUrl || ''
  } else if (item.itemType === 'episode' && 'episode' in content) {
    const { episode, series } = content
    title = episode.title || `Episode ${episode.episodeNumber}`
    subtitle = `${series?.name || 'Unknown'} - S${episode.seasonNumber}E${episode.episodeNumber}`
    imageSrc = series?.backdropUrl || series?.logoUrl || ''
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-yellow-500 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 group cursor-pointer"
    >
      <div className="relative aspect-video bg-slate-900">
        {imageSrc ? (
          <img src={imageSrc} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-800">
            <Play size={24} className="sm:size-8 md:size-12 lg:size-16 text-slate-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3">
          <p className="text-white text-xs sm:text-sm font-medium truncate mb-0.5 sm:mb-1">{title}</p>
          <p className="text-slate-300 text-[10px] sm:text-xs truncate mb-1 sm:mb-2">{subtitle}</p>
          {item.duration && item.duration > 0 && (
            <>
              <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="text-slate-400 text-[10px] sm:text-xs mt-1">
                {timeRemaining > 0 ? `${timeRemaining} min left` : 'Almost done'}
              </p>
            </>
          )}
        </div>
        <div className="absolute top-2 right-2 w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center bg-black/50 hover:bg-black/70 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
          <Play size={12} className="sm:size-3.5 text-white fill-white ml-0.5" />
        </div>
      </div>
    </div>
  )
}

type PlaylistCardProps = {
  name: string
  type: string
  isActive?: boolean
  onEdit: () => void
  onDelete: () => void
  onActivate: () => void
  onResync: () => void
}

function PlaylistCard({ name, type, isActive, onEdit, onDelete, onActivate, onResync }: PlaylistCardProps) {
  const [justActivated, setJustActivated] = useState(false)

  const handleActivate = () => {
    onActivate()
    setJustActivated(true)
    setTimeout(() => setJustActivated(false), 2000)
  }

  return (
    <div className={`bg-slate-800 rounded-xl p-3 sm:p-4 md:p-5 border ${isActive ? 'border-yellow-500' : 'border-slate-700'}`}>
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm sm:text-base font-semibold text-white truncate">{name}</h3>
          <p className="text-xs sm:text-sm text-slate-400">{type}</p>
        </div>
        {isActive && (
          <span className="px-1.5 sm:px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-[10px] sm:text-xs font-medium rounded ml-2">
            Active
          </span>
        )}
        {justActivated && (
          <span className="px-1.5 sm:px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] sm:text-xs font-medium rounded ml-2">
            Switched
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        {!isActive && (
          <button
            onClick={handleActivate}
            className="flex-1 flex items-center justify-center gap-1 px-2 sm:px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] sm:text-xs md:text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[36px] sm:min-h-[40px]"
          >
            Activate
          </button>
        )}
        <button
          onClick={onResync}
          className="flex-1 flex items-center justify-center gap-1 px-2 sm:px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-[10px] sm:text-xs md:text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[36px] sm:min-h-[40px]"
        >
          <RefreshCw size={12} className="sm:size-3.5 md:size-4" />
          <span className="hidden xs:inline">Re-sync</span>
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        >
          <Settings size={14} className="sm:size-[18px]" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 sm:p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        >
          <Trash2 size={14} className="sm:size-[18px]" />
        </button>
      </div>
    </div>
  )
}
