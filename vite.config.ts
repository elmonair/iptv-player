import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { ProxyOptions } from 'vite'

// DEV-ONLY PROXY for Xtream Codes API
// =====================================
// This proxy allows development without CORS issues.
// The target server URL is read from VITE_XTREAM_PROXY_TARGET in .env.local
//
// IMPORTANT: This is a dev-only solution!
// For production, deploy a proper proxy server (e.g., on a VPS)
// that can forward requests to any Xtream server dynamically.
//
// To use:
// 1. Create .env.local in project root
// 2. Add: VITE_XTREAM_PROXY_TARGET=http://your-xtream-server.com:port
// 3. Restart dev server
//
// Client then fetches from /api/xtream/* instead of the direct server URL

export default defineConfig(({ mode }) => {
  const config = {
    plugins: [react()],
  }

  if (mode === 'development') {
    const proxyTarget = process.env.VITE_XTREAM_PROXY_TARGET

    if (proxyTarget) {
      const proxyConfig = {
        target: proxyTarget,
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/xtream/, ''),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        configure: (proxy: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          proxy.on('proxyReq', (proxyReq: any) => {
            proxyReq.setHeader('Origin', proxyTarget)
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          proxy.on('proxyRes', (proxyRes: any) => {
            proxyRes.headers['Access-Control-Allow-Origin'] = '*'
          })
        },
      } as ProxyOptions

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(config as any).server = {
        proxy: {
          '/api/xtream': proxyConfig,
        },
      }
    } else {
      console.warn(
        '\n⚠️  WARNING: VITE_XTREAM_PROXY_TARGET not set in .env.local\n' +
        '   Xtream API requests will fail. See SETUP_DEV.md for instructions.\n',
      )
    }
  }

  return config
})
