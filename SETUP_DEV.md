# Development Setup for Xtream Codes API

## Important: Dev-Only Proxy

This project uses a development-only proxy to bypass CORS restrictions when testing Xtream Codes API integration. **This is NOT suitable for production use.**

For production deployment, you will need to set up a proper proxy server on a VPS or use a backend service.

## Setting Up the Dev Proxy

1. Create a `.env.local` file in the project root (this file is already in `.gitignore`)
2. Add your Xtream Codes server URL:

```env
VITE_XTREAM_PROXY_TARGET=http://your-xtream-server.com:port
```

Example:
```env
VITE_XTREAM_PROXY_TARGET=http://example.com:8080
```

3. Restart the development server: `npm run dev`

## How It Works

- The Vite dev server proxies all requests to `/api/xtream/*` to your Xtream server
- This bypasses CORS restrictions in the browser
- The proxy is only active during development (npm run dev)
- Production builds will not have this proxy

## Testing Xtream Codes Integration

1. Set up your `.env.local` file as described above
2. Start the app: `npm run dev`
3. Go to the Onboarding screen
4. Switch to the "Xtream Codes" tab
5. Enter the same username and password you use for your Xtream server
6. Click "Login"
7. The app will authenticate and start syncing your playlist

## Production Deployment

For production, you will need:

1. A VPS or cloud server
2. A proxy service (Nginx, Caddy, or a simple Node.js Express server)
3. The proxy should forward requests from your frontend to any Xtream server URL

Example Nginx configuration:
```nginx
location /api/xtream/ {
    proxy_pass $http_x_target_origin/;
    proxy_set_header Origin $http_x_target_origin;
}
```

## Troubleshooting

**"VITE_XTREAM_PROXY_TARGET not set" warning:**
- Make sure you created `.env.local` in the project root
- Restart the dev server after creating the file

**"Xtream authentication failed" error:**
- Verify your username and password are correct
- Check that your Xtream server is accessible
- Ensure your subscription is active

**CORS errors:**
- Make sure the dev server is running (not a production build)
- Verify the proxy URL in `.env.local` is correct

**Requests timing out:**
- Your Xtream server may be slow or have rate limits
- Try again after a few minutes
