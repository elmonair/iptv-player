import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef } from 'react'

interface SeasonSelectorProps {
  seasons: number[]
  selectedSeason: number
  onSelectSeason: (season: number) => void
}

export default function SeasonSelector({
  seasons,
  selectedSeason,
  onSelectSeason,
}: SeasonSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 150
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
    }
  }

  if (seasons.length === 0) return null

  return (
    <div className="flex items-center gap-2 px-4 py-2 sm:py-3 border-b border-slate-800 bg-slate-900/50">
      <span className="text-slate-400 text-xs sm:text-sm font-medium whitespace-nowrap">Season:</span>
      
      {/* Scroll left button */}
      <button
        onClick={() => scroll('left')}
        className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        aria-label="Scroll seasons left"
      >
        <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      {/* Season tabs - horizontal scrollable chips */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-center gap-2 overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {seasons.map((season) => {
          const isSelected = season === selectedSeason
          return (
            <button
              key={season}
              onClick={() => onSelectSeason(season)}
              className={`flex-shrink-0 whitespace-nowrap px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 min-h-[36px] sm:min-h-[40px] ${
                isSelected
                  ? 'bg-violet-600 text-white border border-violet-400'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-transparent'
              }`}
            >
              Season {season}
            </button>
          )
        })}
      </div>

      {/* Scroll right button */}
      <button
        onClick={() => scroll('right')}
        className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        aria-label="Scroll seasons right"
      >
        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>
    </div>
  )
}