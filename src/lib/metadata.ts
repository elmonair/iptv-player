export type ParsedMetadata = {
  cleanTitle: string
  year: string | null
  quality: string | null
  language: string | null
  provider: string | null
}

export function parseTitle(rawTitle: string): ParsedMetadata {
  let title = rawTitle
  const qualityMatch = title.match(/\b(4K|UHD|3840P|2160P|FHD|1080P?|HD|720P|SD|480P)\b/i)
  const rawQuality = qualityMatch ? qualityMatch[1].toUpperCase() : null
  const quality = rawQuality === '3840P' || rawQuality === '2160P' ? '4K'
    : rawQuality === '1080' || rawQuality === '1080P' ? 'FHD'
    : rawQuality === '720P' ? 'HD'
    : rawQuality
  const langMatch = title.match(/\b(EN|DE|RU|AR|BG|FR|ES|IT|PT|US|UK|NL|PL|TR|IN|JP|KR|CN)\b/i)
  const language = langMatch ? langMatch[1].toUpperCase() : null
  const providerMatch = title.match(/\b(ATV\+?|NETFLIX|HBO|DISNEY\+?|PRIME|D\+|APPLE|HULU|PEACOCK|PARAMOUNT)\b/i)
  const provider = providerMatch ? providerMatch[1].toUpperCase() : null
  const yearMatch = title.match(/[\[(]?(\d{4})[\])]?/)
  const year = yearMatch ? yearMatch[1] : null
  let cleanTitle = title
    .replace(/^\s*(?:\d{3,4}P|4K|UHD|FHD|HD|SD)?\s*[-_]?\s*(?:EN|DE|RU|AR|BG|FR|ES|IT|PT|US|UK|NL|PL|TR|IN|JP|KR|CN)?\s*[:\-–]\s*/i, '')
    .replace(/\s*[\[(]\s*(?:4K|UHD|FHD|HD|SD|\d{3,4}P|EN|DE|RU|AR|BG|FR|ES|IT|PT|US|UK|NL|PL|TR|IN|JP|KR|CN)\s*[\])]/gi, '')
    .replace(/\s*[\[(]\s*\d{4}\s*[\])]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { cleanTitle, year, quality, language, provider }
}

export function getCleanTitleForComparison(rawTitle: string): string {
  const { cleanTitle } = parseTitle(rawTitle)
  return cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function formatRating(rating: unknown, fallback = 'N/A'): string {
  if (rating === null || rating === undefined || rating === '') {
    return fallback
  }

  const value =
    typeof rating === 'number'
      ? rating
      : Number(String(rating).replace(',', '.'))

  if (!Number.isFinite(value)) {
    return fallback
  }

  return value.toFixed(1)
}

export function formatYear(year: number | string | null | undefined, parsedYear: string | null): string | null {
  if (parsedYear) return parsedYear
  if (typeof year === 'number') return String(year)
  if (year) return String(year)
  return null
}

export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds) return null
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`
}

export function formatReleaseDate(releaseDate: number | string | null | undefined): string | null {
  if (!releaseDate) return null
  const date = typeof releaseDate === 'number' ? new Date(releaseDate * 1000) : new Date(releaseDate)
  return date.toLocaleDateString()
}
