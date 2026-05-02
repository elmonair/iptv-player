const { app, BrowserWindow, session } = require('electron')
const path = require('path')
const http = require('http')
const https = require('https')
const url = require('url')
const fs = require('fs')

// Startup flags
app.commandLine.appendSwitch('disable-web-security')
app.commandLine.appendSwitch('allow-running-insecure-content')
app.commandLine.appendSwitch('ignore-certificate-errors')
app.commandLine.appendSwitch('ignore-ssl-errors')
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('disable-dev-shm-usage')

// Set temp user data dir
const tempDir = path.join('C:', 'temp', 'electron')
fs.mkdirSync(tempDir, { recursive: true })
app.setPath('userData', tempDir)

console.log('[Electron] Version:', process.versions.electron)
console.log('[Electron] Chrome:', process.versions.chrome)
console.log('[Electron] Node:', process.versions.node)

let mainWindow = null

function createWindow() {
  console.log('[Window] Creating...')

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      partition: 'nopersist',
    },
  })

  mainWindow.once('ready-to-show', () => {
    console.log('[Window] Ready to show')
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.webContents.openDevTools()

  const appUrl = 'http://localhost:4444'
  console.log('[Loading]', appUrl)

  const loadResult = mainWindow.loadURL(appUrl)
  console.log('[Load Result]', loadResult)

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[App] Finished loading')
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[Load Failed]', errorCode, errorDescription)
  })

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log('[Console]', level, message)
  })

  mainWindow.on('closed', () => {
    console.log('[Window] Closed')
    mainWindow = null
  })

  mainWindow.on('unresponsive', () => {
    console.log('[Window] Unresponsive')
  })

  mainWindow.on('responsive', () => {
    console.log('[Window] Responsive again')
  })

  // Intercept API requests
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const reqUrl = details.url
    if (reqUrl.includes('/api/') || reqUrl.includes('/transcode') || reqUrl.includes('/proxy/')) {
      console.log('[Request]', reqUrl.substring(0, 100))
    }
    callback({})
  })
}

// Proxy server on port 4444
const distPath = path.join('C:', 'iptv-player-github-review', 'dist')
const proxyServer = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url)

  if (parsedUrl.pathname.startsWith('/proxy/')) {
    const params = new URL(parsedUrl.path, 'http://localhost').searchParams
    const serverUrl = params.get('serverUrl')
    const username = params.get('username')
    const password = params.get('password')

    if (!serverUrl || !username || !password) {
      console.error('[Direct] Missing params:', { serverUrl: !!serverUrl, username: !!username, password: !!password })
      res.writeHead(400)
      res.end('Missing serverUrl/username/password')
      return
    }

    const parts = parsedUrl.pathname.replace('/proxy/', '').split('/')
    // App sends: /proxy/{type}/{sourceId}/{streamId}.{ext}
    // Xtream wants: {serverUrl}/{type}/{username}/{password}/{streamId}.{ext}
    const type = parts[0]
    const file = parts.slice(2).join('/')
    const directUrl = `${serverUrl}/${type}/${username}/${password}/${file}`
    console.log('[Direct]', directUrl.substring(0, 120))

    const client = directUrl.startsWith('https') ? https : http

    const doRequest = (reqUrl, redirects) => {
      if (redirects > 5) {
        res.writeHead(502)
        res.end('Too many redirects')
        return
      }
      const c = reqUrl.startsWith('https') ? https : http
      c.get(reqUrl, { rejectUnauthorized: false }, (proxyRes) => {
        if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
          console.log('[Direct Redirect]', proxyRes.statusCode, '->', proxyRes.headers.location.substring(0, 80))
          doRequest(proxyRes.headers.location, redirects + 1)
          return
        }
        console.log('[Direct Response]', proxyRes.statusCode)
        res.writeHead(proxyRes.statusCode, proxyRes.headers)
        proxyRes.pipe(res)
      }).on('error', (e) => {
        console.error('[Direct Error]', e.message)
        res.writeHead(502)
        res.end('Direct proxy error: ' + e.message)
      })
    }

    console.log('[Direct]', directUrl.substring(0, 120))
    doRequest(directUrl, 0)
    return
  }

  if (parsedUrl.pathname.startsWith('/api/') || parsedUrl.pathname.startsWith('/transcode')) {
    const targetUrl = 'https://m2player.ru' + parsedUrl.path
    console.log('[VPS Proxy]', parsedUrl.pathname)

    https.get(targetUrl, { rejectUnauthorized: false }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
      proxyRes.pipe(res)
    }).on('error', (e) => {
      console.error('[VPS Proxy Error]', e.message)
      res.writeHead(502)
      res.end('Proxy error')
    })
    return
  }

  let filePath = path.join(distPath, parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname)
  if (!fs.existsSync(filePath)) {
    filePath = path.join(distPath, 'assets', parsedUrl.pathname.split('/').pop())
  }

  const ext = path.extname(filePath)
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.map': 'application/json',
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: React Router routes like /loading should return index.html.
      fs.readFile(path.join(distPath, 'index.html'), (indexErr, indexData) => {
        if (indexErr) {
          console.log('[404]', parsedUrl.pathname)
          res.writeHead(404)
          res.end('Not found')
          return
        }
        console.log('[SPA fallback]', parsedUrl.pathname)
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(indexData)
      })
      return
    }
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' })
    res.end(data)
  })
})

proxyServer.listen(4444, () => {
  console.log('[Proxy Server] Running on http://localhost:4444')
})

app.whenReady().then(() => {
  console.log('[App] Ready')
  createWindow()
})

app.on('window-all-closed', () => {
  console.log('[App] All windows closed')
  proxyServer.close()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  console.log('[App] Activate')
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('before-quit', () => {
  console.log('[App] Before quit')
})

console.log('[Electron] Starting main process...')
