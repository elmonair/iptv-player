import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlaylistStore } from '../stores/playlistStore'

export default function M3uUrlForm() {
  const navigate = useNavigate()
  const addSource = usePlaylistStore((state) => state.addSource)

  const [urlValue, setUrlValue] = useState('')
  const [nameValue, setNameValue] = useState('')
  const [urlError, setUrlError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isValidUrl = (url: string): boolean => {
    return url.startsWith('http://') || url.startsWith('https://')
  }

  const extractHostname = (url: string): string => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname
    } catch {
      return url
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')

    if (!urlValue.trim()) {
      setUrlError('Playlist URL is required')
      return
    }

    if (!isValidUrl(urlValue)) {
      setUrlError('Please enter a valid URL starting with http:// or https://')
      return
    }

    setIsSubmitting(true)
    try {
      const name = nameValue.trim() || extractHostname(urlValue)
      await addSource({
        type: 'm3u-url',
        name,
        url: urlValue.trim(),
      })
      navigate('/home')
    } catch (error) {
      setSubmitError('Failed to save playlist. Please try again.')
      console.error('Failed to save playlist:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const clearUrlError = () => setUrlError('')

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="playlist-url" className="block text-sm font-medium text-slate-300 mb-2">
          Playlist URL
        </label>
        <input
          id="playlist-url"
          type="url"
          value={urlValue}
          onChange={(e) => {
            setUrlValue(e.target.value)
            clearUrlError()
          }}
          placeholder="https://example.com/playlist.m3u"
          className={`w-full px-4 py-3 bg-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:border-indigo-500 text-base ${
            urlError
              ? 'border-red-500 focus:ring-red-500/50'
              : 'border-slate-700 focus:ring-indigo-500/50'
          }`}
        />
        {urlError && <p className="mt-2 text-sm text-red-500">{urlError}</p>}
      </div>

      <div>
        <label htmlFor="playlist-name-url" className="block text-sm font-medium text-slate-300 mb-2">
          Playlist Name (optional)
        </label>
        <input
          id="playlist-name-url"
          type="text"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          placeholder="My Playlist"
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 focus:border-indigo-500 text-base"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white font-semibold rounded-lg text-base focus:outline-none focus:ring-4 focus:ring-indigo-500/50 transition-colors min-h-[44px] disabled:opacity-70"
      >
        {isSubmitting ? 'Loading...' : 'Load Playlist'}
      </button>

      {submitError && <p className="text-sm text-red-500">{submitError}</p>}
    </form>
  )
}
