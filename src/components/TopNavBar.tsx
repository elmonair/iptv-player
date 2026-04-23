import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Film, Search, User, ChevronDown, ChevronUp, LogOut, Settings, Info, CreditCard } from 'lucide-react'
import { usePlaylistStore } from '../stores/playlistStore'

export function TopNavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)
  const activeSource = getActiveSource()

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Live TV', path: '/live' },
    { label: 'Movies', path: '/movies' },
    { label: 'Series', path: '/series' },
  ]

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav className="sticky top-0 z-50 bg-slate-900 border-b border-slate-700 h-14 sm:h-16 flex items-center justify-between px-4 sm:px-6">
      {/* Left: Logo + Brand */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 rounded"
      >
        <Film className="text-yellow-500" size={24} />
        <span className="text-lg sm:text-xl font-bold text-white hidden sm:block">MishaPlayer</span>
      </button>

      {/* Center: Navigation - Desktop only */}
      <div className="hidden lg:flex items-center gap-6 sm:gap-8">
        {navItems.map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`text-base pb-1 border-b-2 transition-colors focus:outline-none ${
              isActive(item.path)
                ? 'text-yellow-500 border-yellow-500'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
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

          {showUserMenu && (
            <UserDropdownMenu onClose={() => setShowUserMenu(false)} />
          )}
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

  const menuItems = [
    { label: 'Subscription Info', icon: CreditCard, onClick: () => { navigate('/subscription'); onClose() } },
    { label: 'My Playlists', icon: Film, onClick: () => { navigate('/playlists'); onClose() } },
    { label: 'Settings', icon: Settings, onClick: () => { navigate('/settings'); onClose() } },
    { label: 'About MishaPlayer', icon: Info, onClick: () => { onClose() } },
  ]

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div className="absolute right-0 top-full mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
        {/* User info header */}
        <div className="px-4 py-3 border-b border-slate-700">
          <p className="text-white font-medium">{activeSource?.name || 'User'}</p>
          <p className="text-slate-400 text-sm truncate">
            {activeSource?.type === 'xtream' ? activeSource.serverUrl : activeSource?.url || ''}
          </p>
        </div>

        {/* Menu items */}
        <div className="py-1">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50"
            >
              <item.icon size={18} className="text-slate-400" />
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-700 py-1">
          <button
            onClick={() => { navigate('/'); onClose() }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50"
          >
            <LogOut size={18} />
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </div>
    </>
  )
}
