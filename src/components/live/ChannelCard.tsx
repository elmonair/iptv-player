import { useState } from 'react'
import { Heart } from 'lucide-react'
import { usePlaylistStore } from '../../stores/playlistStore'
import { useFavoritesStore } from '../../stores/favoritesStore'
import type { ChannelRecord } from '../../lib/db'

type Props = {
  channel: ChannelRecord
  onClick: (channel: ChannelRecord) => void
  cardWidth?: number
}

export default function ChannelCard({ channel, onClick, cardWidth = 180 }: Props) {
  const [imageError, setImageError] = useState(false)
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite)
  const isFavorite = useFavoritesStore((state) => state.isFavorite)
  const getActiveSource = usePlaylistStore((state) => state.getActiveSource)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(channel)
    }
  }

  const initial = channel.name.trim().charAt(0).toUpperCase()
  const logoSize = cardWidth < 180 ? 'w-10 h-10' : 'w-14 h-14'
  const fontSize = cardWidth < 180 ? 'text-lg' : 'text-xl'

  const activeSource = getActiveSource()
  const favorite = activeSource ? isFavorite('channel', channel.id) : false

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (activeSource) {
      console.log('[ChannelCard favorite]', channel.name, channel.id)
      toggleFavorite('channel', channel.id, activeSource.id)
    }
  }

  return (
    <button
      role="button"
      tabIndex={0}
      onClick={() => onClick(channel)}
      onKeyDown={handleKeyDown}
      className="group w-full bg-slate-900 rounded-lg border border-slate-800 hover:border-indigo-500 transition-all duration-150 hover:scale-105 focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-slate-950 active:scale-100 text-left relative"
      style={{ minHeight: '80px' }}
    >
      {/* Favorite button */}
      <button
        onClick={handleFavoriteClick}
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-black/50 hover:bg-black/70 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 backdrop-blur-sm z-10"
        aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Heart className={`w-3.5 h-3.5 transition-colors ${favorite ? 'text-red-500 fill-red-500' : 'text-white'}`} />
      </button>

      {/* Logo area */}
      <div className="h-20 sm:h-24 bg-slate-950 flex items-center justify-center p-3 rounded-t-lg">
        {!imageError && channel.logoUrl ? (
          <img
            src={channel.logoUrl}
            alt={channel.name}
            loading="lazy"
            onError={() => setImageError(true)}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className={`${logoSize} rounded-full bg-slate-700 flex items-center justify-center`}>
            <span className={`text-white ${fontSize} font-bold`}>{initial}</span>
          </div>
        )}
      </div>

      {/* Name area */}
      <div className="p-2 sm:p-3">
        <p className="text-white text-sm sm:text-base font-medium leading-tight line-clamp-2" title={channel.name}>
          {channel.name}
        </p>
      </div>
    </button>
  )
}