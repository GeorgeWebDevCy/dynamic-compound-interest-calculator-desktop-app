const fs = require('node:fs/promises')
const path = require('node:path')
const { app, BrowserWindow, ipcMain } = require('electron')
const { readConfig, writeConfig } = require('./configStore.cjs')

const isDev = !!process.env.VITE_DEV_SERVER_URL

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
    await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
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
