import { useMemo, useCallback, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, X, ChevronRight } from 'lucide-react'
import { db } from '../../lib/db'

type Props = {
  selectedCategoryId: string | null
  onSelectCategory: (categoryId: string | null) => void
  sourceId: string
}

export default function MovieCategories({ selectedCategoryId, onSelectCategory, sourceId }: Props) {
  const [filter, setFilter] = useState('')

  const categories = useLiveQuery(
    async () => {
      const cats = await db.categories
        .where('sourceId')
        .equals(sourceId)
        .and((c) => c.type === 'movie')
        .toArray()
      return cats.sort((a, b) => a.name.localeCompare(b.name))
    },
    [sourceId],
  )

  const movieCounts = useLiveQuery(
    async () => {
      const movies = await db.movies.where('sourceId').equals(sourceId).toArray()
      const countMap = new Map<string, number>()
      movies.forEach((m) => {
        countMap.set(m.categoryId, (countMap.get(m.categoryId) ?? 0) + 1)
      })
      return countMap
    },
    [sourceId],
  )

  const totalCount = useMemo(() => {
    if (!movieCounts) return 0
    let total = 0
    movieCounts.forEach((count) => { total += count })
    return total
  }, [movieCounts])

  const filteredCategories = useMemo(() => {
    if (!categories) return []
    if (!filter.trim()) return categories
    const q = filter.toLowerCase().trim()
    return categories.filter((c) => c.name.toLowerCase().includes(q))
  }, [categories, filter])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, _targetCategoryId: string | null, index: number) => {
    const allItems = [{ id: null, name: 'All Movies' }, ...filteredCategories]
    let nextIndex = index

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      nextIndex = Math.min(index + 1, allItems.length - 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      nextIndex = Math.max(index - 1, 0)
    } else if (e.key === 'Home') {
      e.preventDefault()
      nextIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      nextIndex = allItems.length - 1
    } else {
      return
    }

    if (nextIndex !== index) {
      onSelectCategory(allItems[nextIndex].id)
    }
  }, [filteredCategories, onSelectCategory])

  if (categories === undefined) {
    return (
      <div className="w-full h-full bg-slate-900 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Categories</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  const allItems = [
    { id: null, name: 'All Movies', count: totalCount },
    ...filteredCategories.map((c) => ({ id: c.id, name: c.name, count: movieCounts?.get(c.id) ?? 0 })),
  ]

  return (
    <div className="w-full h-full bg-slate-900 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex-shrink-0">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Categories</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter..."
            className="w-full bg-slate-800 text-white placeholder-slate-500 pl-9 pr-8 py-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto min-h-0" aria-label="Movie categories">
        {filteredCategories.length === 0 && categories.length > 0 ? (
          <div className="px-4 py-6 text-center text-slate-500 text-sm">No matches found</div>
        ) : filteredCategories.length === 0 ? (
          <div className="px-4 py-6 text-center text-slate-500 text-sm">No categories found</div>
        ) : (
          allItems.map((item, index) => {
            const isSelected = item.id === selectedCategoryId
            return (
              <button
                key={item.id ?? '__all__'}
                role="button"
                tabIndex={0}
                onClick={() => onSelectCategory(item.id)}
                onKeyDown={(e) => handleKeyDown(e, item.id, index)}
                className={`
                  w-full flex items-center gap-2 px-4 py-3 min-h-[52px] text-left transition-colors border-l-[3px]
                  focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-500
                  ${isSelected
                    ? 'bg-violet-600/20 border-violet-500 text-white'
                    : 'border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
                  }
                `}
              >
                <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
                <span className={`
                  text-xs px-2 py-0.5 rounded-full flex-shrink-0
                  ${isSelected ? 'bg-violet-600/40 text-violet-300' : 'bg-slate-700 text-slate-400'}
                `}>
                  {item.count}
                </span>
                <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform ${isSelected ? 'rotate-90 text-violet-400' : 'text-slate-600'}`} />
              </button>
            )
          })
        )}
      </nav>
    </div>
  )
}