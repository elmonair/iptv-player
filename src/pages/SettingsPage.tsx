import { useState } from 'react'
import { Plus, Trash2, Monitor, Zap, CheckCircle, XCircle, Star, ChevronRight } from 'lucide-react'
import { TopNavBar } from '../components/TopNavBar'
import { AddPlaylistModal } from '../components/AddPlaylistModal'
import { EditPlaylistModal } from '../components/EditPlaylistModal'
import { usePlaylistStore } from '../stores/playlistStore'
import { useTranslation } from '../lib/i18n'
import { useLicenseStore } from '../stores/licenseStore'
import type { XtreamSource } from '../stores/playlistStore'

export default function SettingsPage() {
  const { t } = useTranslation()
  const [showAddPlaylist, setShowAddPlaylist] = useState(false)
  const [editingSource, setEditingSource] = useState<XtreamSource | null>(null)
  const sources = usePlaylistStore((s) => s.sources)
  const activeSourceId = usePlaylistStore((s) => s.activeSourceId)
  const setActiveSource = usePlaylistStore((s) => s.setActiveSource)
  const removeSource = usePlaylistStore((s) => s.removeSource)

  const status = useLicenseStore((s) => s.status)
  const trialDaysLeft = useLicenseStore((s) => s.trialDaysLeft)
  const expiryDate = useLicenseStore((s) => s.expiryDate)
  const deviceId = useLicenseStore((s) => s.deviceId)

  const formatExpiry = (iso: string | null) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const handleClearCache = async () => {
    const dbs = await indexedDB.databases()
    await Promise.all(dbs.map((db) => db.name ? indexedDB.deleteDatabase(db.name) : Promise.resolve()))
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <TopNavBar />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-white">{t('settings')}</h1>

        {/* Subscription Info */}
        <section className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-base font-semibold text-white">{t('subscriptionInfo')}</h2>
          </div>
          <div className="p-5 space-y-4">
            {/* Status */}
            <div className="flex items-center gap-3">
              {status === 'trial' && <Zap size={20} className="text-yellow-500" />}
              {status === 'active' && <CheckCircle size={20} className="text-green-500" />}
              {status === 'expired' && <XCircle size={20} className="text-red-500" />}
              {status === 'lifetime' && <Star size={20} className="text-purple-500" />}
              <div>
                <p className="text-white font-medium capitalize">{status}</p>
                {status === 'trial' && trialDaysLeft && (
                  <p className="text-slate-400 text-sm">{trialDaysLeft} days left</p>
                )}
                {status === 'active' && expiryDate && (
                  <p className="text-slate-400 text-sm">Expires {formatExpiry(expiryDate)}</p>
                )}
              </div>
            </div>

            {/* Device ID */}
            <div className="flex items-center gap-3">
              <Monitor size={20} className="text-slate-400" />
              <div>
                <p className="text-slate-400 text-sm">{t('deviceId')}</p>
                <p className="text-white font-mono text-sm uppercase">{deviceId || '--------'}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Your Playlists */}
        <section className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">{t('yourPlaylists')}</h2>
            <button
              onClick={() => setShowAddPlaylist(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
            >
              <Plus size={16} />
              {t('addNew')}
            </button>
          </div>

          {sources.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-400 text-sm">{t('noPlaylistsFound')}</p>
              <button
                onClick={() => setShowAddPlaylist(true)}
                className="mt-3 text-yellow-500 text-sm hover:underline"
              >
                {t('addPlaylist')}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {sources.map((source) => {
                const isActive = source.id === activeSourceId
                return (
                  <div key={source.id} className="px-5 py-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium truncate ${isActive ? 'text-yellow-500' : 'text-white'}`}>
                          {source.name}
                        </p>
                        {isActive && (
                          <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded">
                            {t('active')}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5 truncate">
                        {source.type === 'xtream' ? t('xtreamCodes') : t('m3uUrl')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {!isActive && (
                        <button
                          onClick={() => setActiveSource(source.id)}
                          className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        >
                          {t('activate')}
                        </button>
                      )}
                      {source.type === 'xtream' && (
                        <button
                          onClick={() => setEditingSource(source as XtreamSource)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        >
                          <ChevronRight size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => removeSource(source.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* App Info */}
        <section className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-base font-semibold text-white">{t('about')}</h2>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Version</span>
              <span className="text-white">1.0.0</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Build</span>
              <span className="text-slate-500 font-mono text-xs">2026.04</span>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-slate-900 rounded-xl border border-red-900/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-red-900/50">
            <h2 className="text-base font-semibold text-red-400">Danger Zone</h2>
          </div>
          <div className="p-5">
            <button
              onClick={handleClearCache}
              className="w-full py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/50"
            >
              Clear cache & reload
            </button>
            <p className="text-slate-500 text-xs mt-2 text-center">
              Clears all local data including watch history, favorites, and EPG.
            </p>
          </div>
        </section>
      </main>

      {showAddPlaylist && (
        <AddPlaylistModal
          onClose={() => setShowAddPlaylist(false)}
          onSuccess={() => {}}
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