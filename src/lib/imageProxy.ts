// Determine if an image URL needs to be proxied in production
export function getProxiedImageUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;

  const safeUrl = String(url ?? '');

  // In production, proxy HTTP images to avoid mixed-content errors
  if (import.meta.env.PROD && safeUrl.startsWith('http://')) {
    return `/proxy/image?url=${encodeURIComponent(safeUrl)}`;
  }

  // In development, or for HTTPS URLs, use original URL
  return safeUrl;
}
