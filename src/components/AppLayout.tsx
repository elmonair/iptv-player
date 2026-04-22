import type { ReactNode } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { Tv, Film, Clapperboard, Search, Settings } from 'lucide-react'

type NavItem = {
  id: string
  label: string
  path: string
  icon: ReactNode
}

const navItems: NavItem[] = [
  { id: 'live', label: 'Live TV', path: '/live', icon: <Tv className="w-5 h-5" /> },
  { id: 'movies', label: 'Movies', path: '/movies', icon: <Film className="w-5 h-5" /> },
  { id: 'series', label: 'Series', path: '/series', icon: <Clapperboard className="w-5 h-5" /> },
]

function isActive(pathname: string, itemPath: string): boolean {
  if (itemPath === '/live') return pathname === '/live' || pathname.startsWith('/live')
  if (itemPath === '/movies') return pathname === '/movies' || pathname.startsWith('/movies')
  if (itemPath === '/series') return pathname === '/series' || pathname.startsWith('/series')
  return false
}

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  const handleNavKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const currentIndex = navItems.findIndex((item) => isActive(location.pathname, item.path))
      let nextIndex: number
      if (e.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + navItems.length) % navItems.length
      } else {
        nextIndex = (currentIndex + 1) % navItems.length
      }
      navigate(navItems[nextIndex].path)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      {/* Header */}
      <header className="h-16 flex-shrink-0 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
        <h1 className="text-2xl font-bold text-white">
          IPTV <span className="text-indigo-400">Player</span>
        </h1>
        <div className="flex gap-2">
          <button
            aria-label="Search"
            className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            aria-label="Settings"
            className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav
          className="w-60 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col py-4"
          aria-label="Main navigation"
        >
          {navItems.map((item) => {
            const active = isActive(location.pathname, item.path)
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                onKeyDown={handleNavKeyDown}
                className={`
                  flex items-center gap-3 mx-3 px-4 py-4 rounded-lg text-base font-medium transition-all
                  focus:outline-none focus:ring-4 focus:ring-indigo-500/50 min-h-[56px]
                  ${active
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }
                `}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}