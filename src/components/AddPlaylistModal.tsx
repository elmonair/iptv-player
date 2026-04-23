import { useState } from 'react'
import { X, Link, Server, Loader2 } from 'lucide-react'
import { usePlaylistStore } from '../stores/playlistStore'

type Tab = 'xtream' | 'm3u'

type Props = {
  onClose: () => void
  onSuccess?: () => void
}

export function AddPlaylistModal({ onClose, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('xtream')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const addSource = usePlaylistStore((state) => state.addSource)

  // Xtream fields
  const [serverUrl, setServerUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [playlistName, setPlaylistName] = useState('')

  // M3U fields
  const [m3uUrl, setM3uUrl] = useState('')
  const [m3uName, setM3uName] = useState('')

  const handleXtreamSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!serverUrl.trim()) {
      setError('Server URL is required')
      return
    }
    if (!username.trim()) {
      setError('Username is required')
      return
    }
    if (!password.trim()) {
      setError('Password is required')
      return
    }

    setIsSubmitting(true)
    try {
      await addSource({
        type: 'xtream',
        name: playlistName.trim() || new URL(serverUrl).hostname,
        serverUrl: serverUrl.trim(),
        username: username.trim(),
        password: password.trim(),
      })
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add playlist')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleM3uSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!m3uUrl.trim()) {
      setError('M3U URL is required')
      return
    }

    setIsSubmitting(true)
    try {
      await addSource({
        type: 'm3u-url',
        name: m3uName.trim() || 'M3U Playlist',
        url: m3uUrl.trim(),
      })
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add playlist')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md pointer-events-auto overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Add Playlist</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-700">
            <button
              onClick={() => setActiveTab('xtream')}
              className={`flex-1 h-12 flex items-center justify-center gap-2 text-base font-medium border-b-2 transition-colors focus:outline-none ${
                activeTab === 'xtream'
                  ? 'text-yellow-500 border-yellow-500'
                  : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              <Server size={18} />
              Xtream Codes
            </button>
            <button
              onClick={() => setActiveTab('m3u')}
              className={`flex-1 h-12 flex items-center justify-center gap-2 text-base font-medium border-b-2 transition-colors focus:outline-none ${
                activeTab === 'm3u'
                  ? 'text-yellow-500 border-yellow-500'
                  : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              <Link size={18} />
              M3U URL
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'xtream' ? (
              <form onSubmit={handleXtreamSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Server URL
                  </label>
                  <input
                    type="url"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="http://example.com:8080"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your username"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Playlist Name (optional)
                  </label>
                  <input
                    type="text"
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    placeholder="My Playlist"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-base"
                  />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 disabled:bg-slate-600 text-black font-semibold rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-yellow-500/50 min-h-[48px] flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                  {isSubmitting ? 'Connecting...' : 'Connect'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleM3uSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    M3U URL
                  </label>
                  <input
                    type="url"
                    value={m3uUrl}
                    onChange={(e) => setM3uUrl(e.target.value)}
                    placeholder="http://example.com/playlist.m3u"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Playlist Name (optional)
                  </label>
                  <input
                    type="text"
                    value={m3uName}
                    onChange={(e) => setM3uName(e.target.value)}
                    placeholder="My Playlist"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-base"
                  />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 disabled:bg-slate-600 text-black font-semibold rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-yellow-500/50 min-h-[48px] flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                  {isSubmitting ? 'Adding...' : 'Add Playlist'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
