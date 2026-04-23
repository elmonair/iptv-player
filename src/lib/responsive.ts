export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  tv: 1920,
}

export function isMobile(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < BREAKPOINTS.tablet
}

export function isTablet(): boolean {
  return typeof window !== 'undefined' && window.innerWidth >= BREAKPOINTS.tablet && window.innerWidth < BREAKPOINTS.desktop
}

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && window.innerWidth >= BREAKPOINTS.desktop && window.innerWidth < BREAKPOINTS.tv
}

export function isTV(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return (
    ua.includes('tv') ||
    ua.includes('smarttv') ||
    ua.includes('silk') ||
    window.innerWidth >= BREAKPOINTS.tv
  )
}

export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' | 'tv' {
  if (isTV()) return 'tv'
  if (isMobile()) return 'mobile'
  if (isTablet()) return 'tablet'
  return 'desktop'
}

export function useDeviceType(): 'mobile' | 'tablet' | 'desktop' | 'tv' {
  return getDeviceType()
}
