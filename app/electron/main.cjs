const path = require('node:path')
const { app, BrowserWindow, ipcMain } = require('electron')
const { readConfig, writeConfig } = require('./configStore.cjs')

const isDev = !!process.env.VITE_DEV_SERVER_URL

let mainWindow

const createWindow = async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.once('ready-to-show', () => win.show())

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
