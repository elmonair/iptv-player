import { Play, Clock, Heart } from 'lucide-react'
import type { XtreamSeriesInfo } from '../../lib/xtreamTypes'
import { usePlaylistStore } from '../../stores/playlistStore'
import { useFavoritesStore } from '../../stores/favoritesStore'
import { db } from '../../lib/db'
import { generateId } from '../../lib/uuid'

type Episode = XtreamSeriesInfo['episodes'][string][number]

interface EpisodeListProps {
  episodes: Episode[]
  focusedEpisodeId?: string | null
  onEpisodeClick: (episode: Episode) => void
  seriesId?: string
}

export default function EpisodeList({
  episodes,
  focusedEpisodeId,
  onEpisodeClick,
  seriesId,
}: EpisodeListProps) {
  const formatDuration = (secs?: number) => {
    if (!secs || secs <= 0) return null
    const mins = Math.floor(secs / 60)
    return `${mins} min`
  }

  const isFavorite = useFavoritesStore((state) => state.isFavorite)
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)

  const activeSource = getActiveSource()

  const handleEpisodeFavoriteClick = async (e: React.MouseEvent, episode: Episode) => {
    e.stopPropagation()
    if (!activeSource || !seriesId) return

    const episodeId = String(episode.id)
    const favorite = isFavorite('episode', episodeId)

    if (favorite) {
      const existing = await db.favorites
        .where('sourceId')
        .equals(activeSource.id)
        .and(f => f.itemType === 'episode' && f.itemId === episodeId)
        .first()
      if (existing) {
        await db.favorites.delete(existing.id)
        console.log('[EpisodeList] Removed episode favorite:', episodeId)
      }
    } else {
      const newFavorite = {
        id: generateId(),
        itemType: 'episode' as const,
        itemId: episodeId,
        sourceId: activeSource.id,
        addedAt: Date.now(),
      }
      await db.favorites.add(newFavorite)
      console.log('[EpisodeList] Added episode favorite:', episodeId)
    }

    if (activeSource) {
      const { loadFavorites } = useFavoritesStore.getState()
      loadFavorites(activeSource.id).catch(console.error)
    }
  }

  const getEpisodeFavoriteStatus = (episodeId: number) => {
    if (!activeSource) return false
    return isFavorite('episode', String(episodeId))
  }

  if (episodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <p className="text-slate-400 text-base mb-4">No episodes found</p>
        <p className="text-slate-500 text-sm">This season has no episodes available.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 sm:gap-1 p-2 sm:p-2">
      {episodes.map((episode) => {
        const isFocused = focusedEpisodeId === String(episode.id)
        const duration = formatDuration(episode.info?.duration_secs)

        return (
          <button
            key={episode.id}
            onClick={() => onEpisodeClick(episode)}
            className={`w-full flex items-center gap-2.5 sm:gap-3 px-2.5 sm:px-3 py-3 sm:py-3 text-left rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 min-h-[68px] sm:min-h-[64px] ${
              isFocused
                ? 'bg-violet-600/20 border-l-4 border-violet-500'
                : 'hover:bg-slate-800/50 border-l-4 border-transparent'
            }`}
          >
            {/* Episode Number Badge - slightly smaller on mobile */}
            <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 bg-slate-700 text-white rounded-md sm:rounded-lg flex items-center justify-center">
              <span className="text-xs sm:text-sm font-semibold">{episode.episode_num}</span>
            </div>

            {/* Episode Info */}
            <div className="flex-1 min-w-0" dir="auto">
              <p className="text-white text-sm font-medium line-clamp-2 sm:line-clamp-1">
                {episode.title || `Episode ${episode.episode_num}`}
              </p>
              {/* Duration inline with title on mobile */}
              <div className="flex items-center gap-2 mt-0.5">
                {duration && (
                  <span className="flex items-center gap-1 text-slate-500 text-xs">
                    <Clock className="w-3 h-3" />
                    {duration}
                  </span>
                )}
                {episode.info?.plot && (
                  <span className="text-slate-500 text-xs line-clamp-1 sm:hidden">
                    {episode.info.plot}
                  </span>
                )}
              </div>
              {episode.info?.plot && (
                <p className="text-slate-500 text-xs mt-0.5 line-clamp-1 hidden sm:block">
                  {episode.info.plot}
                </p>
              )}
            </div>

            {/* Favorite Button */}
            <button
              onClick={(e) => handleEpisodeFavoriteClick(e, episode)}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              aria-label={getEpisodeFavoriteStatus(episode.id) ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart className={`w-4 h-4 transition-colors ${getEpisodeFavoriteStatus(episode.id) ? 'text-red-500 fill-red-500' : ''}`} />
            </button>

            {/* Play Button */}
            <div
              onClick={(e) => {
                e.stopPropagation()
                onEpisodeClick(episode)
              }}
              className="flex-shrink-0 w-9 h-9 bg-violet-600 hover:bg-violet-500 text-white rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`Play episode ${episode.episode_num}`}
            >
              <Play className="w-4 h-4 ml-0.5 fill-current" />
            </div>
          </button>
        )
      })}
    </div>
  )
}