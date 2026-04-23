import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Film, Search, User, ChevronDown, ChevronUp, Shield, Monitor, Eye, EyeOff } from 'lucide-react'
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
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Playlist:</span>
          <span className="text-white font-medium">{activeSource?.name || 'None'}</span>
          {playlistExpDate && (
            <span className="text-slate-500">(exp: {playlistExpDate})</span>
          )}
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
          onClick={() => {}}
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