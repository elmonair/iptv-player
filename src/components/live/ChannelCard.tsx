import { useState } from 'react'
import type { ChannelRecord } from '../../lib/db'

type Props = {
  channel: ChannelRecord
  onClick: (channel: ChannelRecord) => void
}

export default function ChannelCard({ channel, onClick }: Props) {
  const [imageError, setImageError] = useState(false)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(channel)
    }
  }

  const initial = channel.name.trim().charAt(0).toUpperCase()

  return (
    <button
      role="button"
      tabIndex={0}
      onClick={() => onClick(channel)}
      onKeyDown={handleKeyDown}
      className="group w-full bg-slate-900 rounded-lg border border-slate-800 hover:border-indigo-500 transition-all duration-150 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 active:scale-100 text-left"
    >
      {/* Logo area */}
      <div className="h-24 bg-slate-950 flex items-center justify-center p-3 rounded-t-lg">
        {!imageError && channel.logoUrl ? (
          <img
            src={channel.logoUrl}
            alt={channel.name}
            loading="lazy"
            onError={() => setImageError(true)}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
            <span className="text-white text-xl font-bold">{initial}</span>
          </div>
        )}
      </div>

      {/* Name area */}
      <div className="p-2">
        <p className="text-white text-sm font-medium leading-tight line-clamp-2" title={channel.name}>
          {channel.name}
        </p>
      </div>
    </button>
  )
}