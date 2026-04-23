import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Film, Tv, Clapperboard, Settings, User, Info, Plus, RefreshCw, Trash2, CheckCircle } from 'lucide-react'
import { TopNavBar } from '../components/TopNavBar'
import { AddPlaylistModal } from '../components/AddPlaylistModal'
import { usePlaylistStore } from '../stores/playlistStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'

export default function HomePage() {
  const navigate = useNavigate()
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const activeSource = getActiveSource()
  const [showAddPlaylist, setShowAddPlaylist] = useState(false)

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
              onClick={() => navigate('/movies')}
            />
            <QuickActionButton
              icon={<Clapperboard size={24} />}
              label="Series"
              onClick={() => navigate('/series')}
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
            {/* Active Playlist Card */}
            <PlaylistCard
              name={activeSource?.name || 'No Playlist'}
              type={activeSource?.type === 'xtream' ? 'Xtream Codes' : 'M3U URL'}
              isActive
              onEdit={() => {}}
              onDelete={() => {}}
              onResync={() => navigate('/loading')}
            />
          </div>
        </div>
      </main>

      {showAddPlaylist && (
        <AddPlaylistModal
          onClose={() => setShowAddPlaylist(false)}
          onSuccess={() => navigate('/loading')}
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

type PlaylistCardProps = {
  name: string
  type: string
  isActive?: boolean
  onEdit: () => void
  onDelete: () => void
  onResync: () => void
}

function PlaylistCard({ name, type, isActive, onEdit, onDelete, onResync }: PlaylistCardProps) {
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
      </div>
      <div className="flex items-center gap-2">
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
