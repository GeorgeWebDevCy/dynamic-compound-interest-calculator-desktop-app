const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow, ipcMain } = require('electron')
const { readConfig, writeConfig } = require('./configStore.cjs')

const isDev = !!process.env.VITE_DEV_SERVER_URL
const DEFAULT_SCHEMA_DIRS = ['/usr/share/glib-2.0/schemas', '/usr/local/share/glib-2.0/schemas']

const applyLinuxWorkarounds = () => {
  if (process.platform !== 'linux') {
    return
  }

  if (!process.env.GSETTINGS_SCHEMA_DIR) {
    const fallbackDir = DEFAULT_SCHEMA_DIRS.find((dir) => {
      try {
        fsSync.accessSync(dir, fsSync.constants.R_OK)
        return true
      } catch {
        return false
      }
    })

    if (fallbackDir) {
      process.env.GSETTINGS_SCHEMA_DIR = fallbackDir
    }
  }

  if (!process.env.XDG_CURRENT_DESKTOP) {
    process.env.XDG_CURRENT_DESKTOP = 'GNOME'
  }

  if (process.env.ELECTRON_ENABLE_HARDWARE_ACCELERATION !== 'true') {
    app.disableHardwareAcceleration()
    app.commandLine.appendSwitch('disable-gpu')
    app.commandLine.appendSwitch('disable-gpu-compositing')
  }

  // Older GNOME installations previously missed the `font-antialiasing` schema key, but
  // the runtime no longer relies on that configuration. Skip the proactive check so the
  // app starts cleanly even when `gsettings` is unavailable.
}

applyLinuxWorkarounds()

let mainWindow

const createWindow = async () => {
  const windowStatePath = path.join(app.getPath('userData'), 'window-state.json')
  const defaultWindowState = {
    width: 1280,
    height: 900,
    isMaximized: false,
  }

  let windowState = { ...defaultWindowState }

  try {
    const raw = await fs.readFile(windowStatePath, 'utf-8')
    const parsed = JSON.parse(raw)
    windowState = { ...defaultWindowState, ...parsed }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to restore window state', error)
    }
  }

  const browserWindowOptions = {
    width: windowState.width,
    height: windowState.height,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: '#0d1117',
    fullscreen: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  }

  if (typeof windowState.x === 'number' && typeof windowState.y === 'number') {
    browserWindowOptions.x = windowState.x
    browserWindowOptions.y = windowState.y
  }

  const win = new BrowserWindow(browserWindowOptions)

  if (windowState.isMaximized) {
    win.maximize()
  }

  win.once('ready-to-show', () => {
    win.show()
  })

  const persistWindowState = async () => {
    if (win.isDestroyed()) {
      return
    }

    const isMaximized = win.isMaximized()
    const isFullScreen = win.isFullScreen()
    const bounds = isMaximized || isFullScreen ? win.getNormalBounds() : win.getBounds()
    const stateToPersist = {
      ...bounds,
      isMaximized,
    }

    try {
      await fs.mkdir(path.dirname(windowStatePath), { recursive: true })
      await fs.writeFile(windowStatePath, JSON.stringify(stateToPersist, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to persist window state', error)
    }
  }

  let saveWindowStateTimeout
  const schedulePersistWindowState = () => {
    if (win.isDestroyed() || win.isMinimized()) {
      return
    }

    if (saveWindowStateTimeout) {
      clearTimeout(saveWindowStateTimeout)
    }

    saveWindowStateTimeout = setTimeout(() => {
      void persistWindowState()
    }, 200)
  }

  win.on('resize', () => {
    if (!win.isMaximized()) {
      schedulePersistWindowState()
    }
  })

  win.on('move', schedulePersistWindowState)

  win.on('maximize', () => {
    schedulePersistWindowState()
  })

  win.on('unmaximize', schedulePersistWindowState)

  win.on('close', () => {
    void persistWindowState()
  })

  win.on('closed', () => {
    if (saveWindowStateTimeout) {
      clearTimeout(saveWindowStateTimeout)
    }
  })

  if (isDev) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL)
    if (process.env.OPEN_DEVTOOLS === 'true') {
      win.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    const rendererEntryPath = path.join(__dirname, '..', 'dist', 'index.html')

    try {
      await fs.access(rendererEntryPath)
    } catch {
      const errorMessage = `Renderer build missing at ${rendererEntryPath}. Run "npm run build" before "npm start" so Electron can load the production bundle.`
      console.error(errorMessage)
      throw new Error(errorMessage)
    }

    await win.loadFile(rendererEntryPath)
  }

  mainWindow = win
}

function registerIpcHandlers() {
  ipcMain.handle('config:load', async () => {
    return readConfig()
  })

  ipcMain.handle('config:save', async (_event, payload) => {
    return writeConfig(payload)
  })
}

app.whenReady().then(async () => {
  registerIpcHandlers()
  await createWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
