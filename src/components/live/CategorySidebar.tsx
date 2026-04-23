import { useMemo, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'


type Props = {
  selectedCategoryId: string | null
  onSelectCategory: (categoryId: string | null) => void
  sourceId: string
}

export default function CategorySidebar({ selectedCategoryId, onSelectCategory, sourceId }: Props) {
  const categories = useLiveQuery(
    async () => {
      const cats = await db.categories
        .where('sourceId')
        .equals(sourceId)
        .and((c) => c.type === 'live')
        .toArray()
      return cats.sort((a, b) => a.name.localeCompare(b.name))
    },
    [sourceId],
  )

  const channelCounts = useLiveQuery(
    async () => {
      const channels = await db.channels.where('sourceId').equals(sourceId).toArray()
      const countMap = new Map<string, number>()
      channels.forEach((ch) => {
        countMap.set(ch.categoryId, (countMap.get(ch.categoryId) ?? 0) + 1)
      })
      return countMap
    },
    [sourceId],
  )

  const totalCount = useMemo(() => {
    if (!channelCounts) return 0
    let total = 0
    channelCounts.forEach((count) => { total += count })
    return total
  }, [channelCounts])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, _targetCategoryId: string | null, index: number) => {
    if (!categories) return
    const allItems = [{ id: null, name: 'All Channels' }, ...categories]
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
      const allItems = [{ id: null }, ...(categories ?? [])]
      onSelectCategory(allItems[nextIndex].id)
    }
  }, [categories, onSelectCategory])

  if (categories === undefined) {
    return (
      <div className="w-64 sm:w-72 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-3 sm:p-4 border-b border-slate-800">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Categories</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-400 text-sm">Loading categories...</p>
        </div>
      </div>
    )
  }

  const allItems = [{ id: null, name: 'All Channels', count: totalCount }, ...(categories ?? []).map(c => ({ id: c.id, name: c.name, count: channelCounts?.get(c.id) ?? 0 }))]

  return (
    <div className="w-64 sm:w-72 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
      <div className="p-3 sm:p-4 border-b border-slate-800">
        <h2 className="text-xs sm:text-sm font-semibold text-slate-400 uppercase tracking-wide">Categories</h2>
      </div>

      <nav className="flex-1 overflow-y-auto py-2" aria-label="Channel categories">
        {categories.length === 0 ? (
          <div className="px-4 py-2 text-slate-400 text-sm">No categories found</div>
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
                  w-full flex items-center justify-between px-3 sm:px-4 py-3 min-h-[48px] sm:min-h-[56px] text-left transition-colors
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset
                  ${isSelected
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }
                `}
              >
                <span className="text-sm font-medium truncate pr-2">{item.name}</span>
                <span className={`
                  text-xs px-2 py-0.5 rounded-full flex-shrink-0
                  ${isSelected ? 'bg-indigo-800 text-indigo-200' : 'bg-slate-700 text-slate-400'}
                `}>
                  {item.count}
                </span>
              </button>
            )
          })
        )}
      </nav>
    </div>
  )
}