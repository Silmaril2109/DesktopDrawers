const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  readDesktop: () => ipcRenderer.invoke('read-desktop'),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  getFileIcon: (filePath) => ipcRenderer.invoke('get-file-icon', filePath),
  toggleDesktopIcons: (hide) => ipcRenderer.invoke('toggle-desktop-icons', hide),
  // send (not invoke) for minimal latency on hot path
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  startDrag: (filePath) => ipcRenderer.send('start-drag', filePath),
  moveFile: (src, dest) => ipcRenderer.invoke('move-file', { src, dest }),
  readConfig: () => ipcRenderer.invoke('read-config'),
  writeConfig: (config) => ipcRenderer.invoke('write-config', config),
  onDesktopChange: (cb) => ipcRenderer.on('desktop-changed', (_, files) => cb(files)),
  removeDesktopListener: () => ipcRenderer.removeAllListeners('desktop-changed'),
})
