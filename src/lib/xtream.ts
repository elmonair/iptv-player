import type {
  XtreamCredentials,
  XtreamUserInfo,
  XtreamLiveCategory,
  XtreamLiveStream,
  XtreamVodCategory,
  XtreamVodStream,
  XtreamSeriesCategory,
  XtreamSeries,
  XtreamSeriesInfo,
} from './xtreamTypes'

export type { XtreamCredentials }

const API_TIMEOUT = 30000

function buildApiPath(action: string, extraParams: Record<string, string> = {}): string {
  const params = new URLSearchParams({ action, ...extraParams })
  return `/api/xtream/player_api.php?${params.toString()}`
}

function buildApiUrl(action: string, extraParams: Record<string, string> = {}): string {
  return buildApiPath(action, extraParams)
}

async function fetchWithTimeout(url: string, credentials: XtreamCredentials): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

  try {
    const urlWithCreds = `${url}&username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}`
    const response = await fetch(urlWithCreds, {
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Xtream API error: ${response.status} ${response.statusText}`)
    }

    const text = await response.text()

    if (!text.trim().startsWith('{')) {
      throw new Error('Xtream server returned invalid response (not JSON)')
    }

    return response
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - Xtream server did not respond in 30 seconds')
      }
      throw error
    }
    throw new Error('Unknown error occurred')
  }
}

async function fetchJson<T>(action: string, credentials: XtreamCredentials, extraParams: Record<string, string> = {}): Promise<T> {
  const url = buildApiUrl(action, extraParams)
  console.log(`[Xtream API] Fetching: ${action}`)

  const response = await fetchWithTimeout(url, credentials)
  const text = await response.text()

  if (!text.trim().startsWith('{')) {
    throw new Error('Xtream server returned invalid response (not JSON)')
  }

  const data = JSON.parse(text) as unknown

  console.log(`[Xtream API] ${action}: Response received`)

  return data as T
}

export async function getUserInfo(credentials: XtreamCredentials): Promise<XtreamUserInfo> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await fetchJson<{ user_info: any; auth: number; server_info?: any }>('get_user_info', credentials)

  if (data.auth === 0) {
    throw new Error('Xtream authentication failed - check your credentials')
  }

  if (!data.user_info) {
    throw new Error('Xtream server returned invalid user info')
  }

  return data as unknown as XtreamUserInfo
}

export async function getLiveCategories(credentials: XtreamCredentials): Promise<XtreamLiveCategory[]> {
  return await fetchJson<XtreamLiveCategory[]>('get_live_categories', credentials)
}

export async function getLiveStreams(credentials: XtreamCredentials, categoryId?: string): Promise<XtreamLiveStream[]> {
  const params: Record<string, string> = categoryId ? { category_id: categoryId } : {}
  return await fetchJson<XtreamLiveStream[]>('get_live_streams', credentials, params)
}

export async function getVodCategories(credentials: XtreamCredentials): Promise<XtreamVodCategory[]> {
  return await fetchJson<XtreamVodCategory[]>('get_vod_categories', credentials)
}

export async function getVodStreams(credentials: XtreamCredentials, categoryId?: string): Promise<XtreamVodStream[]> {
  const params: Record<string, string> = categoryId ? { category_id: categoryId } : {}
  return await fetchJson<XtreamVodStream[]>('get_vod_streams', credentials, params)
}

export async function getSeriesCategories(credentials: XtreamCredentials): Promise<XtreamSeriesCategory[]> {
  return await fetchJson<XtreamSeriesCategory[]>('get_series_categories', credentials)
}

export async function getSeriesList(credentials: XtreamCredentials, categoryId?: string): Promise<XtreamSeries[]> {
  const params: Record<string, string> = categoryId ? { category_id: categoryId } : {}
  return await fetchJson<XtreamSeries[]>('get_series', credentials, params)
}

export async function getSeriesInfo(credentials: XtreamCredentials, seriesId: string): Promise<XtreamSeriesInfo> {
  return await fetchJson<XtreamSeriesInfo>('get_series_info', credentials, { series_id: seriesId })
}
