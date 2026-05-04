import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Film, Monitor, Zap, CheckCircle, XCircle, Star } from 'lucide-react'
import { useTranslation } from '../lib/i18n'
import { useLicenseStore } from '../stores/licenseStore'
import { usePlaylistStore } from '../stores/playlistStore'
import { UserDropdownMenu } from './UserDropdownMenu'

export function TopNavBar() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const deviceId = useLicenseStore((s) => s.deviceId)
  void navigate

  return (
    <nav className="sticky top-0 z-50 bg-slate-900 border-b border-slate-700 h-14 flex items-center justify-between px-4">
      <button
        onClick={() => navigate('/home')}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 rounded"
      >
        <Film className="text-yellow-500" size={22} />
        <span className="text-base font-bold text-white">{t('appName')}</span>
      </button>

      <div className="flex items-center gap-3">
        <DeviceIdBadge deviceId={deviceId} />
        <SubscriptionBadge />
        <UserAvatar />
      </div>
    </nav>
  )
}

function DeviceIdBadge({ deviceId }: { deviceId: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md">
      <Monitor size={12} className="text-gray-500" />
      <span className="font-mono text-[11px] text-gray-500 uppercase">{deviceId || '--------'}</span>
    </div>
  )
}

function SubscriptionBadge() {
  const status = useLicenseStore((s) => s.status)
  const trialDaysLeft = useLicenseStore((s) => s.trialDaysLeft)
  const expiryDate = useLicenseStore((s) => s.expiryDate)

  const formatExpiry = (iso: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  if (status === 'trial') {
    return (
      <div className="flex items-center gap-1.5 bg-yellow-500/15 px-2 py-1 rounded-md">
        <Zap size={12} className="text-yellow-500" />
        <span className="text-[11px] text-yellow-500 font-medium">
          Trial · {trialDaysLeft ?? 14}d
        </span>
      </div>
    )
  }

  if (status === 'active') {
    return (
      <div className="flex items-center gap-1.5 bg-green-500/15 px-2 py-1 rounded-md">
        <CheckCircle size={12} className="text-green-500" />
        <span className="text-[11px] text-green-500 font-medium">
          Active · {formatExpiry(expiryDate)}
        </span>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="flex items-center gap-1.5 bg-red-500/15 px-2 py-1 rounded-md">
        <XCircle size={12} className="text-red-500" />
        <span className="text-[11px] text-red-500 font-medium">Expired</span>
      </div>
    )
  }

  if (status === 'lifetime') {
    return (
      <div className="flex items-center gap-1.5 bg-purple-500/15 px-2 py-1 rounded-md">
        <Star size={12} className="text-purple-500" />
        <span className="text-[11px] text-purple-500 font-medium">Lifetime</span>
      </div>
    )
  }

  return null
}

function UserAvatar() {
  const [showMenu, setShowMenu] = useState(false)
  const sources = usePlaylistStore((s) => s.sources)
  const activeSourceId = usePlaylistStore((s) => s.activeSourceId)
  const activeSource = sources.find((s) => s.id === activeSourceId)
  const name = activeSource?.name || 'U'
  const initial = name.charAt(0).toUpperCase()

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-white text-sm font-medium hover:bg-white/12 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50"
      >
        {initial}
      </button>
      {showMenu && <UserDropdownMenu onClose={() => setShowMenu(false)} />}
    </div>
  )
}