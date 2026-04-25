import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Film, Tv, Clapperboard, Settings, User, Info, Plus, RefreshCw, Trash2, CheckCircle, Clock, Play } from 'lucide-react'
import { TopNavBar } from '../components/TopNavBar'
import { AddPlaylistModal } from '../components/AddPlaylistModal'
import { EditPlaylistModal } from '../components/EditPlaylistModal'
import { usePlaylistStore } from '../stores/playlistStore'
import { useWatchHistoryStore } from '../stores/watchHistoryStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { XtreamSource } from '../stores/playlistStore'

export default function HomePage() {
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 sm:space-y-10">

        {/* Welcome Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Welcome Card */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Welcome back, {activeSource?.name || 'User'}!
            </h1>
            <p className="text-slate-400 text-base mb-1">Your playlist: {activeSource?.name}</p>
            <p className="text-slate-500 text-sm truncate mb-4">
              {activeSource?.type === 'xtream' ? activeSource.serverUrl : activeSource?.url || ''}
            </p>
            <button
              onClick={() => navigate('/playlists')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              Manage Playlists
            </button>
          </div>

          {/* Subscription Card */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-white">Subscription Info</h2>
              <span className="flex items-center gap-1 text-green-400 text-sm">
                <CheckCircle size={16} />
                Active
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-slate-900 rounded-lg">
                <p className="text-2xl font-bold text-yellow-500">
                  {counts?.channels?.toLocaleString() ?? '-'}
                </p>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">Channels</p>
              </div>
              <div className="text-center p-3 bg-slate-900 rounded-lg">
                <p className="text-2xl font-bold text-yellow-500">
                  {counts?.movies?.toLocaleString() ?? '-'}
                </p>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">Movies</p>
              </div>
              <div className="text-center p-3 bg-slate-900 rounded-lg">
                <p className="text-2xl font-bold text-yellow-500">
                  {counts?.series?.toLocaleString() ?? '-'}
                </p>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">Series</p>
              </div>
            </div>
          </div>
        </div>

        {/* Continue Watching */}
        <ContinueWatchingSection navigate={navigate} />

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <QuickActionButton
              icon={<Tv size={24} />}
              label="Live TV"
              onClick={() => navigate('/live')}
            />
            <QuickActionButton
              icon={<Film size={24} />}
              label="Movies"
              onClick={() => navigate('/live?tab=movies')}
            />
            <QuickActionButton
              icon={<Clapperboard size={24} />}
              label="Series"
              onClick={() => navigate('/live?tab=series')}
            />
            <QuickActionButton
              icon={<Settings size={24} />}
              label="Settings"
              onClick={() => navigate('/settings')}
            />
            <QuickActionButton
              icon={<User size={24} />}
              label="Profile"
              onClick={() => {}}
            />
            <QuickActionButton
              icon={<Info size={24} />}
              label="About"
              onClick={() => {}}
            />
          </div>
        </div>

        {/* Playlist Management */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Your Playlists</h2>
            <button
              onClick={() => setShowAddPlaylist(true)}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-yellow-500/50"
            >
              <Plus size={18} />
              Add New
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
      className="flex flex-col items-center justify-center gap-2 p-4 sm:p-6 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[100px]"
    >
      <div className="text-yellow-500">{icon}</div>
      <span className="text-sm font-medium text-white">{label}</span>
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Clock size={20} className="text-yellow-500" />
          Continue Watching
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
  navigate: (path: string) => void
}

function ContinueWatchingCard({ item, navigate }: ContinueWatchingCardProps) {
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
    if (item.itemType === 'channel') {
      navigate(`/watch/channel/${encodeURIComponent(item.itemId)}`)
    } else if (item.itemType === 'movie') {
      navigate(`/watch/movie/${encodeURIComponent(item.itemId)}`)
    } else if (item.itemType === 'episode' && 'episode' in content) {
      const { episode, series } = content
      const seriesId = series?.externalId || series?.id
      navigate(`/watch/episode/${episode.id}`, {
        state: {
          seriesId,
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
    <button
      onClick={handleClick}
      className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-yellow-500 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 group"
    >
      <div className="relative aspect-video bg-slate-900">
        {imageSrc ? (
          <img src={imageSrc} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-800">
            <Play size={32} className="text-slate-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-white text-sm font-medium truncate mb-1">{title}</p>
          <p className="text-slate-300 text-xs truncate mb-2">{subtitle}</p>
          {item.duration && item.duration > 0 && (
            <>
              <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="text-slate-400 text-xs mt-1">
                {timeRemaining > 0 ? `${timeRemaining} min left` : 'Almost done'}
              </p>
            </>
          )}
        </div>
        <div className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/70 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
          <Play size={14} className="text-white fill-white ml-0.5" />
        </div>
      </div>
    </button>
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
    <div className={`bg-slate-800 rounded-xl p-5 border ${isActive ? 'border-yellow-500' : 'border-slate-700'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-white truncate">{name}</h3>
          <p className="text-sm text-slate-400">{type}</p>
        </div>
        {isActive && (
          <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs font-medium rounded">
            Active
          </span>
        )}
        {justActivated && (
          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded">
            Switched
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!isActive && (
          <button
            onClick={handleActivate}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            Activate
          </button>
        )}
        <button
          onClick={onResync}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        >
          <RefreshCw size={14} />
          Re-sync
        </button>
        <button
          onClick={onEdit}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        >
          <Settings size={18} />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  )
}