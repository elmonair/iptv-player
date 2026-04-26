type SavedBrowseState = {
  tab: 'channels' | 'movies' | 'series'
  selectedCategoryId: string | null
  sidebarScrollTop: number
  contentScrollTop: number
}

const STORAGE_KEY = 'iptv:browseState'

export function saveBrowseState(state: SavedBrowseState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch { /* ignore */ }
}

export function readBrowseState(): SavedBrowseState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SavedBrowseState
  } catch { return null }
}

export function clearBrowseState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}