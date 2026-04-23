import { Search, Settings, MoreVertical } from 'lucide-react'

export default function Movies() {
  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <header className="h-14 sm:h-16 flex-shrink-0 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4">
        <h1 className="text-lg sm:text-xl font-bold text-white">
          IPTV <span className="text-yellow-500">Player</span>
        </h1>
        <div className="flex items-center gap-1 sm:gap-2">
          <button className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
            <Search size={20} />
          </button>
          <button className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
            <Settings size={20} />
          </button>
          <button className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-4 sm:gap-6 px-4 bg-slate-900 border-b border-slate-700 flex-shrink-0">
        <button className="h-12 text-base font-medium border-b-2 text-slate-400 border-transparent">
          Channels
        </button>
        <button className="h-12 text-base font-medium border-b-2 text-yellow-500 border-yellow-500">
          Movies
        </button>
        <button className="h-12 text-base font-medium border-b-2 text-slate-400 border-transparent">
          Series
        </button>
      </div>

      {/* Placeholder */}
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400 text-base">Movies browser — coming in Step 12</p>
      </div>
    </div>
  )
}