const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('configAPI', {
  load: () => ipcRenderer.invoke('config:load'),
  save: (payload) => ipcRenderer.invoke('config:save', payload),
})
