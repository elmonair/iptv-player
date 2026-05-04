import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Eye, EyeOff, Globe, ChevronUp } from 'lucide-react'
import { usePlaylistStore } from '../stores/playlistStore'
import { useTranslation, LANGUAGES, useLanguageStore } from '../lib/i18n'

type Props = {
  onClose: () => void
}

export function UserDropdownMenu({ onClose }: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const sources = usePlaylistStore((s) => s.sources)
  const activeSourceId = usePlaylistStore((s) => s.activeSourceId)
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [showPin, setShowPin] = useState(false)

  const activeSource = sources.find((s) => s.id === activeSourceId)
  const pinCode = activeSource?.type === 'xtream' ? (activeSource as { password?: string }).password ?? '' : ''
  const maskedPin = pinCode ? '\u2022'.repeat(pinCode.length) : ''

  const menuItems = [
    { label: t('settings'), onClick: () => { navigate('/settings'); onClose() } },
  ]

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <p className="text-white font-medium truncate">{activeSource?.name || t('user')}</p>
          <p className="text-slate-400 text-sm truncate">
            {activeSource?.type === 'xtream' ? activeSource.serverUrl : activeSource?.url || ''}
          </p>
        </div>

        {pinCode && (
          <div className="px-4 py-3 border-b border-slate-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{t('pinCode')}</span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-slate-300 text-xs">
                  {showPin ? pinCode : maskedPin}
                </span>
                <button
                  onClick={() => setShowPin(!showPin)}
                  className="p-1 text-slate-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded"
                  aria-label={showPin ? t('hidePin') : t('showPin')}
                >
                  {showPin ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="py-1">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className="w-full text-left px-4 py-2.5 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 text-sm"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="border-t border-slate-700">
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="w-full text-left px-4 py-2.5 flex items-center justify-between text-slate-300 hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 text-sm"
          >
            <span className="flex items-center gap-2">
              <Globe size={16} />
              Language
            </span>
            {showLangMenu ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showLangMenu && (
            <div className="bg-slate-900 border-t border-slate-700 py-1">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    useLanguageStore.getState().setLanguage(lang.code)
                    setShowLangMenu(false)
                  }}
                  className="w-full text-left px-4 py-2 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 text-sm"
                >
                  {lang.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-700 py-1">
          <button
            onClick={() => { navigate('/'); onClose() }}
            className="w-full text-left px-4 py-2.5 text-red-400 hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 text-sm"
          >
            {t('logout')}
          </button>
        </div>
      </div>
    </>
  )
}