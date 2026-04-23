import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev proxy note:
// The Xtream API is called DIRECTLY from the browser using the server URL provided at login.
// This requires the Xtream server to have CORS headers enabled for the app's origin.
//
// To enable CORS on your Xtream server (admin panel):
//   - Go to Settings -> API/CORS
//   - Add your app's URL to allowed origins (e.g., http://localhost:5173 for dev)
//   - Or set wildcard: *
//
// For production deployment, a server-side proxy is still recommended to avoid CORS altogether.

export default defineConfig({
  plugins: [react()],
})