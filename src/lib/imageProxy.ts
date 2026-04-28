// Determine if an image URL needs to be proxied in production
export function getProxiedImageUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;

  // In production, proxy HTTP images to avoid mixed-content errors
  if (import.meta.env.PROD && url.startsWith('http://')) {
    return `/proxy/image?url=${encodeURIComponent(url)}`;
  }

  // In development, or for HTTPS URLs, use original URL
  return url;
}
