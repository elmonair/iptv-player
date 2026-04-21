import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link, KeyRound } from 'lucide-react'
import { usePlaylistStore } from '../stores/playlistStore'

type TabType = 'm3u-url' | 'xtream'

export default function Onboarding() {
  const navigate = useNavigate()
  const addSource = usePlaylistStore((state) => state.addSource)
  const setActiveSource = usePlaylistStore((state) => state.setActiveSource)

  const [activeTab, setActiveTab] = useState<TabType>('m3u-url')

  const [m3uUrl, setM3uUrl] = useState('')
  const [m3uUrlName, setM3uUrlName] = useState('')
  const [m3uUrlError, setM3uUrlError] = useState('')

  const [xtreamUrl, setXtreamUrl] = useState('')
  const [xtreamUsername, setXtreamUsername] = useState('')
  const [xtreamPassword, setXtreamPassword] = useState('')
  const [xtreamName, setXtreamName] = useState('')
  const [xtreamUrlError, setXtreamUrlError] = useState('')
  const [xtreamUsernameError, setXtreamUsernameError] = useState('')
  const [xtreamPasswordError, setXtreamPasswordError] = useState('')

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'm3u-url', label: 'M3U URL', icon: <Link className="w-5 h-5" /> },
    { id: 'xtream', label: 'Xtream Codes', icon: <KeyRound className="w-5 h-5" /> },
  ]

  const handleTabKeyDown = (e: React.KeyboardEvent, tabIndex: number) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const direction = e.key === 'ArrowLeft' ? -1 : 1
      const newIndex = (tabIndex + direction + tabs.length) % tabs.length
      setActiveTab(tabs[newIndex].id)
    }
  }

  const isValidUrl = (url: string): boolean => {
    return url.startsWith('http://') || url.startsWith('https://')
  }

  const extractHostname = (url: string): string => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname
    } catch {
      return url
    }
  }

  const handleM3uUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!m3uUrl.trim()) {
      setM3uUrlError('Playlist URL is required')
      return
    }

    if (!isValidUrl(m3uUrl)) {
      setM3uUrlError('Please enter a valid URL starting with http:// or https://')
      return
    }

    const name = m3uUrlName.trim() || extractHostname(m3uUrl)
    const id = addSource({
      type: 'm3u-url',
      name,
      url: m3uUrl.trim(),
    })

    setActiveSource(id)
    navigate('/loading')
  }

  const handleXtreamSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    let hasError = false

    if (!xtreamUrl.trim()) {
      setXtreamUrlError('Server URL is required')
      hasError = true
    } else if (!isValidUrl(xtreamUrl)) {
      setXtreamUrlError('Please enter a valid URL starting with http:// or https://')
      hasError = true
    }

    if (!xtreamUsername.trim()) {
      setXtreamUsernameError('Username is required')
      hasError = true
    }

    if (!xtreamPassword.trim()) {
      setXtreamPasswordError('Password is required')
      hasError = true
    }

    if (hasError) return

    const name = xtreamName.trim() || extractHostname(xtreamUrl)
    const id = addSource({
      type: 'xtream',
      name,
      serverUrl: xtreamUrl.trim(),
      username: xtreamUsername.trim(),
      password: xtreamPassword.trim(),
    })

    setActiveSource(id)
    navigate('/loading')
  }

  const clearM3uUrlError = () => setM3uUrlError('')
  const clearXtreamUrlError = () => setXtreamUrlError('')
  const clearXtreamUsernameError = () => setXtreamUsernameError('')
  const clearXtreamPasswordError = () => setXtreamPasswordError('')

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">IPTV Player</h1>
          <p className="text-lg text-slate-400">Add your playlist to get started</p>
        </div>

        <div className="flex gap-2 mb-8" role="tablist">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
              className={`
                flex items-center gap-2 px-4 sm:px-6 py-3 rounded-lg text-base font-medium transition-all
                focus:outline-none focus:ring-4 focus:ring-indigo-500/50
                ${activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }
              `}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="bg-slate-900 rounded-xl p-6 sm:p-8 border border-slate-800">
          {activeTab === 'm3u-url' && (
            <form onSubmit={handleM3uUrlSubmit} className="space-y-6">
              <div>
                <label htmlFor="playlist-url" className="block text-sm font-medium text-slate-300 mb-2">
                  Playlist URL
                </label>
                <input
                  id="playlist-url"
                  type="url"
                  value={m3uUrl}
                  onChange={(e) => {
                    setM3uUrl(e.target.value)
                    clearM3uUrlError()
                  }}
                  placeholder="https://example.com/playlist.m3u"
                  className={`w-full px-4 py-3 bg-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:border-indigo-500 text-base ${
                    m3uUrlError
                      ? 'border-red-500 focus:ring-red-500/50'
                      : 'border-slate-700 focus:ring-indigo-500/50'
                  }`}
                />
                {m3uUrlError && <p className="mt-2 text-sm text-red-500">{m3uUrlError}</p>}
              </div>

              <div>
                <label htmlFor="playlist-name-url" className="block text-sm font-medium text-slate-300 mb-2">
                  Playlist Name (optional)
                </label>
                <input
                  id="playlist-name-url"
                  type="text"
                  value={m3uUrlName}
                  onChange={(e) => setM3uUrlName(e.target.value)}
                  placeholder="My Playlist"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 focus:border-indigo-500 text-base"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-base focus:outline-none focus:ring-4 focus:ring-indigo-500/50 transition-colors min-h-[44px]"
              >
                Load Playlist
              </button>
            </form>
          )}

          {activeTab === 'xtream' && (
            <form onSubmit={handleXtreamSubmit} className="space-y-6">
              <div>
                <label htmlFor="server-url" className="block text-sm font-medium text-slate-300 mb-2">
                  Server URL
                </label>
                <input
                  id="server-url"
                  type="url"
                  value={xtreamUrl}
                  onChange={(e) => {
                    setXtreamUrl(e.target.value)
                    clearXtreamUrlError()
                  }}
                  placeholder="http://example.com:8080"
                  className={`w-full px-4 py-3 bg-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:border-indigo-500 text-base ${
                    xtreamUrlError
                      ? 'border-red-500 focus:ring-red-500/50'
                      : 'border-slate-700 focus:ring-indigo-500/50'
                  }`}
                />
                {xtreamUrlError && <p className="mt-2 text-sm text-red-500">{xtreamUrlError}</p>}
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={xtreamUsername}
                  onChange={(e) => {
                    setXtreamUsername(e.target.value)
                    clearXtreamUsernameError()
                  }}
                  className={`w-full px-4 py-3 bg-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:border-indigo-500 text-base ${
                    xtreamUsernameError
                      ? 'border-red-500 focus:ring-red-500/50'
                      : 'border-slate-700 focus:ring-indigo-500/50'
                  }`}
                />
                {xtreamUsernameError && <p className="mt-2 text-sm text-red-500">{xtreamUsernameError}</p>}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={xtreamPassword}
                  onChange={(e) => {
                    setXtreamPassword(e.target.value)
                    clearXtreamPasswordError()
                  }}
                  className={`w-full px-4 py-3 bg-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:border-indigo-500 text-base ${
                    xtreamPasswordError
                      ? 'border-red-500 focus:ring-red-500/50'
                      : 'border-slate-700 focus:ring-indigo-500/50'
                  }`}
                />
                {xtreamPasswordError && <p className="mt-2 text-sm text-red-500">{xtreamPasswordError}</p>}
              </div>

              <div>
                <label htmlFor="playlist-name-xtream" className="block text-sm font-medium text-slate-300 mb-2">
                  Playlist Name (optional)
                </label>
                <input
                  id="playlist-name-xtream"
                  type="text"
                  value={xtreamName}
                  onChange={(e) => setXtreamName(e.target.value)}
                  placeholder="My Playlist"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 focus:border-indigo-500 text-base"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-base focus:outline-none focus:ring-4 focus:ring-indigo-500/50 transition-colors min-h-[44px]"
              >
                Login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
