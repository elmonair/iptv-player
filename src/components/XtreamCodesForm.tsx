import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlaylistStore } from '../stores/playlistStore'

const isSecureContext = typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'

export default function XtreamCodesForm() {
  const navigate = useNavigate()
  const addSource = usePlaylistStore((state) => state.addSource)

  const [urlValue, setUrlValue] = useState('')
  const [usernameValue, setUsernameValue] = useState('')
  const [passwordValue, setPasswordValue] = useState('')
  const [nameValue, setNameValue] = useState('')
  const [urlError, setUrlError] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [passwordError, setPasswordError] = useState('')
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

    let hasError = false

    if (!urlValue.trim()) {
      setUrlError('Server URL is required')
      hasError = true
    } else if (!isValidUrl(urlValue)) {
      setUrlError('Please enter a valid URL starting with http:// or https://')
      hasError = true
    }

    if (!usernameValue.trim()) {
      setUsernameError('Username is required')
      hasError = true
    }

    if (!passwordValue.trim()) {
      setPasswordError('Password is required')
      hasError = true
    }

    if (hasError) return

    setIsSubmitting(true)
    try {
      const name = nameValue.trim() || extractHostname(urlValue)
      await addSource({
        type: 'xtream',
        name,
        serverUrl: urlValue.trim(),
        username: usernameValue.trim(),
        password: passwordValue.trim(),
      })
      navigate('/loading')
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[XtreamCodesForm] addSource failed:', error)
      setSubmitError(`Failed to save playlist: ${detail}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const clearUrlError = () => setUrlError('')
  const clearUsernameError = () => setUsernameError('')
  const clearPasswordError = () => setPasswordError('')

  if (!isSecureContext) {
    return (
      <div className="space-y-4">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <p className="text-amber-400 font-semibold mb-2">Secure connection required</p>
          <p className="text-slate-400 text-sm">
            Xtream Codes credentials must be encrypted, which requires a secure context (HTTPS or localhost).
            Please access this app at <span className="text-white font-mono">http://localhost:5173/</span> or via HTTPS.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="server-url" className="block text-sm font-medium text-slate-300 mb-2">
          Server URL
        </label>
        <input
          id="server-url"
          type="url"
          value={urlValue}
          onChange={(e) => {
            setUrlValue(e.target.value)
            clearUrlError()
          }}
          placeholder="http://example.com:8080"
          className={`w-full px-4 py-3 bg-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:border-indigo-500 text-base ${
            urlError
              ? 'border-red-500 focus:ring-red-500/50'
              : 'border-slate-700 focus:ring-indigo-500/50'
          }`}
        />
        {urlError && <p className="mt-2 text-sm text-red-500">{urlError}</p>}
      </div>

      <div>
        <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
          Username
        </label>
        <input
          id="username"
          type="text"
          value={usernameValue}
          onChange={(e) => {
            setUsernameValue(e.target.value)
            clearUsernameError()
          }}
          className={`w-full px-4 py-3 bg-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:border-indigo-500 text-base ${
            usernameError
              ? 'border-red-500 focus:ring-red-500/50'
              : 'border-slate-700 focus:ring-indigo-500/50'
          }`}
        />
        {usernameError && <p className="mt-2 text-sm text-red-500">{usernameError}</p>}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={passwordValue}
          onChange={(e) => {
            setPasswordValue(e.target.value)
            clearPasswordError()
          }}
          className={`w-full px-4 py-3 bg-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:border-indigo-500 text-base ${
            passwordError
              ? 'border-red-500 focus:ring-red-500/50'
              : 'border-slate-700 focus:ring-indigo-500/50'
          }`}
        />
        {passwordError && <p className="mt-2 text-sm text-red-500">{passwordError}</p>}
      </div>

      <div>
        <label htmlFor="playlist-name-xtream" className="block text-sm font-medium text-slate-300 mb-2">
          Playlist Name (optional)
        </label>
        <input
          id="playlist-name-xtream"
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
        {isSubmitting ? 'Loading...' : 'Login'}
      </button>

      {submitError && <p className="text-sm text-red-500">{submitError}</p>}
    </form>
  )
}