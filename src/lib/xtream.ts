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
  XtreamVodInfo,
} from './xtreamTypes'

export type { XtreamCredentials }

const API_TIMEOUT = 30000

function buildApiUrl(serverUrl: string, action: string, extraParams: Record<string, string> = {}): string {
  const params = new URLSearchParams({ action, ...extraParams })
  return `${serverUrl}/player_api.php?${params.toString()}`
}

async function fetchJson<T>(
  serverUrl: string,
  action: string,
  credentials: XtreamCredentials,
  extraParams: Record<string, string> = {},
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

  let response: Response
  try {
    const urlWithCreds = `${buildApiUrl(serverUrl, action, extraParams)}&username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}`
    console.log(`[Xtream API] Fetching: ${action}`)

    response = await fetch(urlWithCreds, {
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timeout - Xtream server did not respond in 30 seconds')
    }
    throw new Error(`Network error: ${err instanceof Error ? err.message : String(err)}`)
  }

  clearTimeout(timeoutId)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const bodyText = await response.text()

  const trimmed = bodyText.trimStart()
  if (trimmed.startsWith('<')) {
    throw new Error('Xtream server returned HTML instead of JSON (check CORS headers or server URL)')
  }

  if (!trimmed) {
    throw new Error('Xtream server returned empty response')
  }

  try {
    const data = JSON.parse(bodyText) as unknown
    console.log(`[Xtream API] ${action}: Response received`)
    return data as T
  } catch {
    throw new Error(`Xtream server returned invalid JSON: ${bodyText.slice(0, 200)}`)
  }
}

export async function getUserInfo(serverUrl: string, credentials: XtreamCredentials): Promise<XtreamUserInfo> {
  const data = await fetchJson<{ user_info: unknown; auth: number; server_info?: unknown }>(
    serverUrl,
    'get_user_info',
    credentials,
  )

  if (data.auth === 0) {
    throw new Error('Xtream authentication failed - check your credentials')
  }

  return data as unknown as XtreamUserInfo
}

export async function getLiveCategories(serverUrl: string, credentials: XtreamCredentials): Promise<XtreamLiveCategory[]> {
  return await fetchJson<XtreamLiveCategory[]>(serverUrl, 'get_live_categories', credentials)
}

export async function getLiveStreams(serverUrl: string, credentials: XtreamCredentials, categoryId?: string): Promise<XtreamLiveStream[]> {
  const params: Record<string, string> = categoryId ? { category_id: categoryId } : {}
  return await fetchJson<XtreamLiveStream[]>(serverUrl, 'get_live_streams', credentials, params)
}

export async function getVodCategories(serverUrl: string, credentials: XtreamCredentials): Promise<XtreamVodCategory[]> {
  return await fetchJson<XtreamVodCategory[]>(serverUrl, 'get_vod_categories', credentials)
}

export async function getVodStreams(serverUrl: string, credentials: XtreamCredentials, categoryId?: string): Promise<XtreamVodStream[]> {
  const params: Record<string, string> = categoryId ? { category_id: categoryId } : {}
  return await fetchJson<XtreamVodStream[]>(serverUrl, 'get_vod_streams', credentials, params)
}

export async function getSeriesCategories(serverUrl: string, credentials: XtreamCredentials): Promise<XtreamSeriesCategory[]> {
  return await fetchJson<XtreamSeriesCategory[]>(serverUrl, 'get_series_categories', credentials)
}

export async function getSeriesList(serverUrl: string, credentials: XtreamCredentials, categoryId?: string): Promise<XtreamSeries[]> {
  const params: Record<string, string> = categoryId ? { category_id: categoryId } : {}
  return await fetchJson<XtreamSeries[]>(serverUrl, 'get_series', credentials, params)
}

export async function getVodInfo(serverUrl: string, credentials: XtreamCredentials, vodId: string): Promise<XtreamVodInfo> {
  return await fetchJson<XtreamVodInfo>(serverUrl, 'get_vod_info', credentials, { vod_id: vodId })
}

export async function getSeriesInfo(serverUrl: string, credentials: XtreamCredentials, seriesId: string): Promise<XtreamSeriesInfo> {
  return await fetchJson<XtreamSeriesInfo>(serverUrl, 'get_series_info', credentials, { series_id: seriesId })
}