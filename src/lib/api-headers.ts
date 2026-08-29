import { NextResponse } from 'next/server';

/**
 * Standard HTTP headers for private, user-specific, non-cacheable API responses.
 * Enforces strict cache bypassing across browsers, CDN layers, and intermediate proxies.
 */
export const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store'
} as const;

/**
 * Convenience helper to return a JSON response with strict no-store headers.
 */
export function jsonNoStore<T>(data: T, init?: ResponseInit): NextResponse<T> {
  const headers = new Headers(init?.headers);
  for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
    headers.set(key, value);
  }
  return NextResponse.json(data, {
    ...init,
    headers
  });
}
