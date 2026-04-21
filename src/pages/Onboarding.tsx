import { useState } from 'react'
import { Link, File, KeyRound } from 'lucide-react'

type TabType = 'm3u-url' | 'm3u-file' | 'xtream'

export default function Onboarding() {
  const [activeTab, setActiveTab] = useState<TabType>('m3u-url')

  // Form states
  const [m3uUrl, setM3uUrl] = useState('')
  const [m3uUrlName, setM3uUrlName] = useState('')
  const [m3uFileName, setM3uFileName] = useState('')
  const [m3uFileFile, setM3uFileFile] = useState<File | null>(null)
  const [xtreamUrl, setXtreamUrl] = useState('')
  const [xtreamUsername, setXtreamUsername] = useState('')
  const [xtreamPassword, setXtreamPassword] = useState('')
  const [xtreamName, setXtreamName] = useState('')

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'm3u-url', label: 'M3U URL', icon: <Link className="w-5 h-5" /> },
    { id: 'm3u-file', label: 'M3U File', icon: <File className="w-5 h-5" /> },
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

  const handleM3uUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('M3U URL form submitted:', { url: m3uUrl, name: m3uUrlName })
  }

  const handleM3uFileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('M3U File form submitted:', { file: m3uFileFile, name: m3uFileName })
  }

  const handleXtreamSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Xtream Codes form submitted:', {
      url: xtreamUrl,
      username: xtreamUsername,
      password: xtreamPassword,
      name: xtreamName,
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setM3uFileFile(file)
      setM3uFileName(file.name)
    }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setM3uFileFile(file)
      setM3uFileName(file.name)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        {/* Title and subtitle */}
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">IPTV Player</h1>
          <p className="text-lg text-slate-400">Add your playlist to get started</p>
        </div>

        {/* Tabs */}
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

        {/* Tab content */}
        <div className="bg-slate-900 rounded-xl p-6 sm:p-8 border border-slate-800">
          {/* Tab 1: M3U URL */}
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
                  onChange={(e) => setM3uUrl(e.target.value)}
                  placeholder="https://example.com/playlist.m3u"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 focus:border-indigo-500 text-base"
                  required
                />
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

          {/* Tab 2: M3U File */}
          {activeTab === 'm3u-file' && (
            <form onSubmit={handleM3uFileSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Select File</label>
                <div
                  className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 hover:bg-slate-800/50 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 transition-all"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <File className="w-12 h-12 mx-auto mb-3 text-slate-500" />
                  <p className="text-slate-400 text-sm mb-2">
                    {m3uFileName || 'Click to select or drag & drop your M3U file'}
                  </p>
                  <p className="text-slate-500 text-xs">Accepts .m3u and .m3u8 files</p>
                  <input
                    id="file-input"
                    type="file"
                    accept=".m3u,.m3u8"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="playlist-name-file" className="block text-sm font-medium text-slate-300 mb-2">
                  Playlist Name (optional)
                </label>
                <input
                  id="playlist-name-file"
                  type="text"
                  value={m3uFileName}
                  onChange={(e) => setM3uFileName(e.target.value)}
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

          {/* Tab 3: Xtream Codes */}
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
                  onChange={(e) => setXtreamUrl(e.target.value)}
                  placeholder="http://example.com:8080"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 focus:border-indigo-500 text-base"
                  required
                />
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={xtreamUsername}
                  onChange={(e) => setXtreamUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 focus:border-indigo-500 text-base"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={xtreamPassword}
                  onChange={(e) => setXtreamPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 focus:border-indigo-500 text-base"
                  required
                />
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
