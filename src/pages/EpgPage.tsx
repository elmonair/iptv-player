import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Tv2, ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import { usePlaylistStore } from '../stores/playlistStore'
import { parseAndStoreXmltv, clearEpgForSource, getEpgForChannel } from '../lib/epgParser'
import { db } from '../lib/db'
import { TopNavBar } from '../components/TopNavBar'
import { useTranslation } from '../lib/i18n'
import type { ChannelRecord } from '../lib/db'

type EpgProgram = {
  id: string
  title: string
  description?: string
  startTimestamp: number
  endTimestamp: number
  startTime: string
  endTime: string
  isCurrent: boolean
  isNext: boolean
}

type ChannelEpg = {
  channel: ChannelRecord
  currentProgram: EpgProgram | null
  nextProgram: EpgProgram | null
  loading: boolean
  error?: string
}

const formatTime = (ts: number) => {
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default function EpgPage() {
  const navigate = useNavigate()
  const { getActiveSource } = usePlaylistStore()
  const activeSource = getActiveSource()
  const { t } = useTranslation()

  const formatTimeAgo = (ts: number): string => {
    const seconds = Math.floor((Date.now() - ts) / 1000)
    if (seconds < 60) return t('justNow')
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return t('minutesAgo', { count: minutes })
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t('hoursAgo', { count: hours })
    const days = Math.floor(hours / 24)
    return t('daysAgo', { count: days })
  }

  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')
  const [channels, setChannels] = useState<ChannelEpg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<number | null>(null)
  const [lastEpgSync, setLastEpgSync] = useState<number | null>(null)
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null)
  const [schedulePrograms, setSchedulePrograms] = useState<EpgProgram[]>([])

  const refreshTime = useCallback(() => {
    setCurrentTime(new Date())
  }, [])

  useEffect(() => {
    const interval = setInterval(refreshTime, 60000)
    return () => clearInterval(interval)
  }, [refreshTime])

  const loadCategories = useCallback(async () => {
    if (!activeSource || activeSource.type !== 'xtream') return

    try {
      const allCategories = await db.categories.where('sourceId').equals(activeSource.id).toArray()
      setCategories(allCategories.map(c => ({ id: c.id, name: c.name })))
    } catch (err) {
      console.error('[EpgPage] Failed to load categories:', err)
    }
  }, [activeSource])

  const loadChannels = useCallback(async () => {
    if (!activeSource || activeSource.type !== 'xtream') {
      navigate('/home')
      return
    }

    setLoading(true)
    setError(null)

    try {
      let channelList: ChannelRecord[]
      if (selectedCategoryId === 'all') {
        channelList = await db.channels.where('sourceId').equals(activeSource.id).toArray()
      } else {
        channelList = await db.channels
          .where('sourceId').equals(activeSource.id)
          .and(c => c.categoryId === selectedCategoryId)
          .toArray()
      }

      const now = Math.floor(Date.now() / 1000)

      const channelsWithEpg: ChannelEpg[] = channelList.map((channel) => ({
        channel,
        currentProgram: null,
        nextProgram: null,
        loading: true,
      }))
      setChannels(channelsWithEpg)

      await Promise.all(
        channelList.map(async (channel) => {
          if (!channel.epgChannelId) {
            setChannels(prev => prev.map(ch =>
              ch.channel.id === channel.id
                ? { ...ch, loading: false, error: channel.epgChannelId ? undefined : 'No EPG' }
                : ch
            ))
            return
          }

          const result = await getEpgForChannel(channel.epgChannelId, activeSource.id, now)

          const currentProgram = result.current ? {
            id: result.current.id,
            title: result.current.title,
            description: result.current.description,
            startTimestamp: result.current.startTimestamp,
            endTimestamp: result.current.endTimestamp,
            startTime: '',
            endTime: '',
            isCurrent: true,
            isNext: false,
          } : null

          const nextProgram = result.next ? {
            id: result.next.id,
            title: result.next.title,
            description: result.next.description,
            startTimestamp: result.next.startTimestamp,
            endTimestamp: result.next.endTimestamp,
            startTime: '',
            endTime: '',
            isCurrent: false,
            isNext: true,
          } : null

          setChannels(prev => prev.map(ch =>
            ch.channel.id === channel.id
              ? { ...ch, currentProgram, nextProgram, loading: false }
              : ch
          ))
        })
      )
    } catch (err) {
      console.error('[EpgPage] Failed to load channels:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [activeSource, selectedCategoryId, navigate])

  const loadLastEpgSync = useCallback(async () => {
    if (!activeSource) return
    const meta = await db.syncMetadata.where('sourceId').equals(activeSource.id).first()
    setLastEpgSync(meta?.lastEpgSyncAt ?? null)
  }, [activeSource])

  const handleSyncEpg = async () => {
    if (!activeSource || activeSource.type !== 'xtream') return

    setIsSyncing(true)
    setSyncProgress(0)
    setError(null)

    try {
      await clearEpgForSource(activeSource.id)

      await parseAndStoreXmltv(
        activeSource.serverUrl,
        activeSource.username,
        activeSource.password,
        activeSource.id,
        (loaded) => setSyncProgress(loaded)
      )

      await loadChannels()
      await loadLastEpgSync()
    } catch (err) {
      console.error('[EpgPage] Failed to sync EPG:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSyncing(false)
      setSyncProgress(null)
    }
  }

  const handleChannelClick = async (channelId: string) => {
    if (expandedChannelId === channelId) {
      setExpandedChannelId(null)
      setSchedulePrograms([])
      return
    }

    const channel = channels.find(ch => ch.channel.id === channelId)?.channel
    if (!channel?.epgChannelId) {
      setExpandedChannelId(channelId)
      setSchedulePrograms([])
      return
    }

    const now = Math.floor(Date.now() / 1000)
    const twelveHoursLater = now + 12 * 3600

    const programs = await db.epg
      .where('[channelId+start]')
      .between([channel.epgChannelId, now], [channel.epgChannelId, twelveHoursLater])
      .toArray()

    const formatted: EpgProgram[] = programs.map(p => ({
      id: String(p.id),
      title: p.title,
      description: p.description,
      startTimestamp: p.start,
      endTimestamp: p.stop,
      startTime: formatTime(p.start),
      endTime: formatTime(p.stop),
      isCurrent: p.start <= now && p.stop > now,
      isNext: false,
    }))

    setExpandedChannelId(channelId)
    setSchedulePrograms(formatted)
  }

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  useEffect(() => {
    loadLastEpgSync()
  }, [loadLastEpgSync])

  useEffect(() => {
    loadChannels()
  }, [loadChannels])

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategoryId(categoryId)
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden">
      <TopNavBar />

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-800 overflow-y-auto">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-white mb-1">{t('categoriesTab')}</h2>
            <p className="text-xs text-slate-400">{t('selectToViewGuide')}</p>
          </div>
          <nav className="p-2">
            <button
              onClick={() => handleCategoryClick('all')}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[48px] flex items-center gap-2 ${
                selectedCategoryId === 'all'
                  ? 'bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500 font-medium'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Tv2 className="w-4 h-4" />
              <span className="flex-1">{t('allChannels')}</span>
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[48px] ${
                  selectedCategoryId === cat.id
                    ? 'bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500 font-medium'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="truncate block">{cat.name}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="flex-shrink-0 h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-4">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-white">{t('tvGuide')}</h1>
              <div className="flex items-center gap-1 text-slate-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
              </div>
              {lastEpgSync && (
                <span className="text-xs text-slate-500">
                  {t('lastSync')} {formatTimeAgo(lastEpgSync)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeSource && activeSource.type === 'xtream' && (
                <button
                  onClick={handleSyncEpg}
                  disabled={isSyncing}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[44px]"
                >
                  {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {isSyncing ? `${t('syncing')}${syncProgress !== null ? ` (${syncProgress})` : ''}` : t('syncEpg')}
                </button>
              )}
              {loading && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            {error && (
              <div className="p-4 text-center">
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {!loading && channels.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-400">{t('noChannelsInThisCategory')}</p>
              </div>
            )}

            <div className="divide-y divide-slate-800">
              {channels.map((channelEpg) => (
                <div key={channelEpg.channel.id}>
                  <div
                    className={`flex items-start p-3 cursor-pointer transition-colors ${expandedChannelId === channelEpg.channel.id ? 'bg-slate-800/50' : 'hover:bg-slate-900/50'}`}
                    onClick={() => handleChannelClick(channelEpg.channel.id)}
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded bg-slate-800 flex items-center justify-center mr-3">
                      {channelEpg.channel.logoUrl ? (
                        <img
                          src={channelEpg.channel.logoUrl}
                          alt={channelEpg.channel.name}
                          className="w-8 h-8 object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <Tv2 className="w-5 h-5 text-slate-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-medium truncate">{channelEpg.channel.name}</h3>
                      </div>

                      {channelEpg.loading ? (
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>{t('loading')}</span>
                        </div>
                      ) : channelEpg.error === 'No EPG' ? (
                        <p className="text-slate-500 text-xs italic">{t('noEpg')}</p>
                      ) : channelEpg.currentProgram || channelEpg.nextProgram ? (
                        <div className="space-y-1">
                          {channelEpg.currentProgram && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-indigo-400 font-medium min-w-[35px]">{t('now')}</span>
                              <span className="text-slate-300 truncate">{channelEpg.currentProgram.title}</span>
                              <span className="text-slate-500 flex-shrink-0">
                                {formatTime(channelEpg.currentProgram.startTimestamp)} - {formatTime(channelEpg.currentProgram.endTimestamp)}
                              </span>
                            </div>
                          )}
                          {channelEpg.nextProgram && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-400 font-medium min-w-[35px]">{t('next')}</span>
                              <span className="text-slate-400 truncate">{channelEpg.nextProgram.title}</span>
                              <span className="text-slate-500 flex-shrink-0">
                                {formatTime(channelEpg.nextProgram.startTimestamp)} - {formatTime(channelEpg.nextProgram.endTimestamp)}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-xs italic">{t('noEpg')}</p>
                      )}
                    </div>

                    <ChevronRight className={`w-5 h-5 text-slate-600 flex-shrink-0 ml-2 transition-transform ${expandedChannelId === channelEpg.channel.id ? 'rotate-90' : ''}`} />
                  </div>

                  {expandedChannelId === channelEpg.channel.id && (
                    <div className="px-4 pb-3 bg-slate-900/30 border-t border-slate-800/50">
                      <div className="pt-3 space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-slate-300">{t('scheduleNext12Hours')}</h4>
                          <span className="text-xs text-slate-500">{schedulePrograms.length} programs</span>
                        </div>
                        {schedulePrograms.length > 0 ? (
                          <div className="space-y-1 max-h-64 overflow-y-auto">
                            {schedulePrograms.map((prog) => (
                              <div
                                key={prog.id}
                                className={`flex items-start gap-3 p-2 rounded text-xs ${prog.isCurrent ? 'bg-indigo-600/20' : 'bg-slate-800/30'}`}
                              >
                                <div className="flex-shrink-0 text-slate-400 w-20">
                                  {formatTime(prog.startTimestamp)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`font-medium truncate ${prog.isCurrent ? 'text-indigo-300' : 'text-slate-200'}`}>
                                    {prog.isCurrent && <span className="mr-1">▶</span>}
                                    {prog.title}
                                  </p>
                                  {prog.description && (
                                    <p className="text-slate-500 truncate mt-0.5">{prog.description}</p>
                                  )}
                                </div>
                                <div className="flex-shrink-0 text-slate-500 text-right">
                                  {formatTime(prog.endTimestamp)}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-500 text-xs italic">
                            {channelEpg.channel.epgChannelId
                              ? t('noProgramsScheduled')
                              : t('noEpgChannelIdConfigured')}
                          </p>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/watch/live/${encodeURIComponent(channelEpg.channel.id)}`)
                          }}
                          className="mt-2 w-full py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[44px]"
                        >
                          {t('watchNow')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
