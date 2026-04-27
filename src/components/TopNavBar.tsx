import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Film, Search, Calendar, User, ChevronDown, ChevronUp, Shield, Monitor, Eye, EyeOff } from 'lucide-react'
import { usePlaylistStore } from '../stores/playlistStore'

function getDeviceId(): string {
  let deviceId = localStorage.getItem('mishaplayer_device_id')
  if (!deviceId) {
    deviceId = crypto.randomUUID().split('-')[0].toUpperCase()
    localStorage.setItem('mishaplayer_device_id', deviceId)
  }
  return deviceId
}

export function TopNavBar() {
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false)
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const activeSource = getActiveSource()

  const deviceId = getDeviceId()

  const formatExpDate = (expDate: number | null): string => {
    if (!expDate || expDate === 0) return ''
    const date = new Date(expDate * 1000)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const playlistExpDate = activeSource?.type === 'xtream' && activeSource.expDate ? formatExpDate(activeSource.expDate) : ''

  return (
    <nav className="sticky top-0 z-50 bg-slate-900 border-b border-slate-700 h-14 sm:h-16 flex items-center justify-between px-4 sm:px-6">
      {/* Left: Logo - goes to Home */}
      <button
        onClick={() => navigate('/home')}
        className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 rounded"
      >
        <Film className="text-yellow-500" size={24} />
        <span className="text-lg sm:text-xl font-bold text-white">MishaPlayer</span>
      </button>

      {/* Center: Status info - Desktop only */}
      <div className="hidden xl:flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <Shield size={14} className="text-yellow-500" />
          <span className="text-slate-400">Membership:</span>
          <span className="font-medium text-green-500">Active (12 months)</span>
        </div>
        <div className="h-4 w-px bg-slate-700" />
        <div className="relative">
          <button
            onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}
            className="flex items-center gap-1.5 hover:bg-slate-800 px-2 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50"
          >
            <span className="text-slate-400">Playlist:</span>
            <span className="text-white font-medium max-w-[120px] truncate">{activeSource?.name || 'None'}</span>
            {playlistExpDate && <span className="text-slate-500 text-xs">({playlistExpDate})</span>}
            {showPlaylistMenu ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showPlaylistMenu && <PlaylistDropdown onClose={() => setShowPlaylistMenu(false)} />}
        </div>
        <div className="h-4 w-px bg-slate-700" />
        <div className="flex items-center gap-1.5">
          <Monitor size={14} className="text-slate-400" />
          <span className="text-slate-400">Device ID:</span>
          <span className="font-mono text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">{deviceId}</span>
        </div>
      </div>

      {/* Right: Search + User */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => navigate('/epg')}
          className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          aria-label="TV Guide"
          title="TV Guide"
        >
          <Calendar size={20} />
        </button>
        <button
          onClick={() => navigate('/search')}
          className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          aria-label="Search"
        >
          <Search size={20} />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-1 sm:gap-2 hover:bg-slate-800 px-2 sm:px-3 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-300"
          >
            <User size={18} className="sm:w-5 sm:h-5" />
            <span className="hidden sm:block text-sm font-medium truncate max-w-[100px]">
              {activeSource?.name || 'User'}
            </span>
            {showUserMenu ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showUserMenu && <UserDropdownMenu onClose={() => setShowUserMenu(false)} />}
        </div>
      </div>
    </nav>
  )
}

type UserDropdownMenuProps = {
  onClose: () => void
}

function UserDropdownMenu({ onClose }: UserDropdownMenuProps) {
  const navigate = useNavigate()
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const activeSource = getActiveSource()
  const deviceId = getDeviceId()
  const [showPin, setShowPin] = useState(false)

  const formatExpDate = (expDate: number | null): string => {
    if (!expDate || expDate === 0) return ''
    const date = new Date(expDate * 1000)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const playlistExpDate = activeSource?.type === 'xtream' && activeSource.expDate ? formatExpDate(activeSource.expDate) : ''

  const pinCode = activeSource?.type === 'xtream' ? activeSource.password : ''
  const maskedPin = pinCode ? '\u2022'.repeat(pinCode.length) : ''

  const menuItems = [
    { label: 'Subscription Info', onClick: () => { navigate('/subscription'); onClose() } },
    { label: 'My Playlists', onClick: () => { navigate('/playlists'); onClose() } },
    { label: 'Settings', onClick: () => { navigate('/settings'); onClose() } },
    { label: 'About MishaPlayer', onClick: () => { onClose() } },
  ]

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <p className="text-white font-medium">{activeSource?.name || 'User'}</p>
          <p className="text-slate-400 text-sm truncate">
            {activeSource?.type === 'xtream' ? activeSource.serverUrl : activeSource?.url || ''}
          </p>
        </div>

        <div className="px-4 py-3 border-b border-slate-700 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Membership</span>
            <span className="font-medium text-green-500">Active (12 months)</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Playlist</span>
            <span className="text-slate-300">
              {activeSource?.name || 'None'}
              {playlistExpDate && <span className="text-slate-500"> (exp: {playlistExpDate})</span>}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Device ID</span>
            <span className="font-mono text-slate-300 bg-slate-900 px-2 py-0.5 rounded">{deviceId}</span>
          </div>
          {pinCode && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">PIN Code</span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-slate-300">
                  {showPin ? pinCode : maskedPin}
                </span>
                <button
                  onClick={() => setShowPin(!showPin)}
                  className="p-1 text-slate-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded"
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="py-1">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className="w-full text-left px-4 py-2.5 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 text-sm"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="border-t border-slate-700 py-1">
          <button
            onClick={() => { navigate('/'); onClose() }}
            className="w-full text-left px-4 py-2.5 text-red-400 hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 text-sm"
          >
            Logout
          </button>
        </div>
      </div>
    </>
  )
}

type PlaylistDropdownProps = {
  onClose: () => void
}

function PlaylistDropdown({ onClose }: PlaylistDropdownProps) {
  const navigate = useNavigate()
  const sources = usePlaylistStore((state) => state.sources)
  const activeSourceId = usePlaylistStore((state) => state.activeSourceId)
  const setActiveSource = usePlaylistStore((state) => state.setActiveSource)
  const [justSwitched, setJustSwitched] = useState<string | null>(null)

  const formatExpDate = (exp: number | null) => {
    if (!exp || exp === 0) return null
    return new Date(exp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const handleSwitch = (id: string) => {
    if (id === activeSourceId) { onClose(); return }
    setActiveSource(id)
    setJustSwitched(id)
    setTimeout(() => { setJustSwitched(null); onClose() }, 1500)
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onKeyDown={(e) => e.key === 'Escape' && onClose()} />
      <div className="absolute left-0 top-full mt-2 w-72 max-h-80 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
        <div className="px-3 py-2 border-b border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Switch Playlist</p>
        </div>
        {sources.length === 0 && (
          <div className="px-3 py-4 text-center">
            <p className="text-slate-400 text-sm">No playlists found</p>
            <button onClick={() => { navigate('/'); onClose() }} className="mt-2 text-yellow-500 text-sm hover:underline">Add Playlist</button>
          </div>
        )}
        {sources.map((s) => {
          const isActive = s.id === activeSourceId
          const isJustSwitched = s.id === justSwitched
          return (
            <button
              key={s.id}
              onClick={() => handleSwitch(s.id)}
              className={`w-full text-left px-3 py-2.5 flex flex-col gap-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 ${isActive ? 'bg-slate-700/50' : 'hover:bg-slate-700'}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm truncate ${isActive ? 'text-yellow-500 font-medium' : 'text-white'}`}>{s.name}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isJustSwitched && <span className="text-xs text-green-400 font-medium">Switched</span>}
                  {isActive && <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded">Active</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{s.type === 'xtream' ? 'Xtream Codes' : 'M3U URL'}</span>
                {s.type === 'xtream' && s.expDate && (
                  <span>exp: {formatExpDate(s.expDate)}</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}