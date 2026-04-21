import { useState } from 'react'
import { Link, KeyRound } from 'lucide-react'
import M3uUrlForm from '../components/M3uUrlForm'
import XtreamCodesForm from '../components/XtreamCodesForm'

type TabType = 'm3u-url' | 'xtream'

export default function Onboarding() {
  const [activeTab, setActiveTab] = useState<TabType>('m3u-url')

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'm3u-url', label: 'M3U URL', icon: <Link className="w-5 h-5" /> },
    { id: 'xtream', label: 'Xtream Codes', icon: <KeyRound className="w-5 h-5" /> },
  ]

  const handleTabKeyDown = (e: React.KeyboardEvent, tabIndex: number) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const direction = e.key === 'ArrowLeft' ? -1 : 1
      const newIndex = (tabIndex + direction + tabs.length) % tabs.length
      setActiveTab(tabs[newIndex].id)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">IPTV Player</h1>
          <p className="text-lg text-slate-400">Add your playlist to get started</p>
        </div>

        <div className="flex gap-2 mb-8" role="tablist">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
              className={`
                flex items-center gap-2 px-4 sm:px-6 py-3 rounded-lg text-base font-medium transition-all
                focus:outline-none focus:ring-4 focus:ring-indigo-500/50
                ${activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }
              `}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="bg-slate-900 rounded-xl p-6 sm:p-8 border border-slate-800">
          {activeTab === 'm3u-url' && <M3uUrlForm />}
          {activeTab === 'xtream' && <XtreamCodesForm />}
        </div>
      </div>
    </div>
  )
}
