import { getHeroMobileUrl, getHeroDesktopUrl, getMascotUrl } from './assets'
 
interface CacheEntry {
  url: string
  expiresAt: number
}
 
// In-memory cache for the duration of the browser SPA session
const clientCache: Record<string, CacheEntry> = {}
 
// Refresh 5 minutes before the 1-hour expiration
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000
const SIGNED_URL_LIFETIME_MS = 60 * 60 * 1000
 
/**
 * Resolves a cached or freshly signed URL for hero-mobile.mp4
 */
export async function getHeroMobileCached(): Promise<string | null> {
  if (typeof window === 'undefined') return null
 
  const now = Date.now()
  const cached = clientCache['hero-mobile']
 
  if (cached && cached.expiresAt - now > REFRESH_THRESHOLD_MS) {
    return cached.url
  }
 
  // Fetch new signed URL
  const url = await getHeroMobileUrl()
  if (url) {
    clientCache['hero-mobile'] = {
      url,
      expiresAt: now + SIGNED_URL_LIFETIME_MS
    }
  }
  return url
}
 
/**
 * Resolves a cached or freshly signed URL for hero-desktop.mp4
 */
export async function getHeroDesktopCached(): Promise<string | null> {
  if (typeof window === 'undefined') return null
 
  const now = Date.now()
  const cached = clientCache['hero-desktop']
 
  if (cached && cached.expiresAt - now > REFRESH_THRESHOLD_MS) {
    return cached.url
  }
 
  const url = await getHeroDesktopUrl()
  if (url) {
    clientCache['hero-desktop'] = {
      url,
      expiresAt: now + SIGNED_URL_LIFETIME_MS
    }
  }
  return url
}
 
/**
 * Resolves a cached or freshly signed URL for a specific mascot image
 */
export async function getMascotCached(mascotName: string): Promise<string | null> {
  if (typeof window === 'undefined') return null
 
  const now = Date.now()
  const cacheKey = `mascot-${mascotName}`
  const cached = clientCache[cacheKey]
 
  if (cached && cached.expiresAt - now > REFRESH_THRESHOLD_MS) {
    return cached.url
  }
 
  const url = await getMascotUrl(mascotName)
  if (url) {
    clientCache[cacheKey] = {
      url,
      expiresAt: now + SIGNED_URL_LIFETIME_MS
    }
  }
  return url
}
 
/**
 * Clears the client-side asset cache (e.g. on user logout)
 */
export function clearAssetCache(): void {
  for (const key in clientCache) {
    delete clientCache[key]
  }
}
