const { app, BrowserWindow, ipcMain, shell, screen, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const { exec, execFile } = require('child_process')

const isDev = process.env.NODE_ENV === 'development'

let mainWindow = null
let desktopWatcher = null

function readDesktopFiles() {
  const desktopPath = app.getPath('desktop')
  try {
    const entries = fs.readdirSync(desktopPath)
    return entries
      .map(name => {
        const filePath = path.join(desktopPath, name)
        try {
          const stat = fs.statSync(filePath)
          return {
            name,
            path: filePath,
            isDirectory: stat.isDirectory(),
            size: stat.size,
            modified: stat.mtime.getTime(),
          }
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .filter(f => !f.name.startsWith('.') && f.name !== 'desktop.ini')
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
  } catch (err) {
    console.error('Error reading desktop:', err)
    return []
  }
}

function watchDesktop() {
  const desktopPath = app.getPath('desktop')
  let debounceTimer = null
  try {
    desktopWatcher = fs.watch(desktopPath, { persistent: false }, () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('desktop-changed', readDesktopFiles())
        }
      }, 500)
    })
  } catch (err) {
    console.error('Error watching desktop:', err)
  }
}

function toggleDesktopIcons(hide) {
  const regVal = hide ? 1 : 0
  const swCmd  = hide ? 0 : 5  // SW_HIDE=0, SW_SHOW=5

  // 1. Set registry via reg.exe — reliable, no PowerShell needed
  exec(
    `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v HideIcons /t REG_DWORD /d ${regVal} /f`,
    { windowsHide: true },
    (err) => { if (err) console.error('reg.exe err:', err.message) }
  )

  // 2. Immediately show/hide the SysListView32 via PowerShell P/Invoke
  //    Use array-join so the here-string closing "@ is always at column 0
  const psLines = [
    '$ErrorActionPreference = "SilentlyContinue"',
    'try {',
    'Add-Type -TypeDefinition @"',
    'using System;using System.Runtime.InteropServices;',
    'public class DD{',
    '[DllImport("user32.dll")]public static extern IntPtr FindWindow(string c,string w);',
    '[DllImport("user32.dll")]public static extern IntPtr FindWindowEx(IntPtr p,IntPtr a,string c,string w);',
    '[DllImport("user32.dll")]public static extern bool ShowWindow(IntPtr h,int n);',
    '}',
    '"@',
    '} catch {}',
    `$cmd=${swCmd}`,
    '$p=[DD]::FindWindow("Progman",$null)',
    '$v=[DD]::FindWindowEx($p,[IntPtr]::Zero,"SHELLDLL_DefView",$null)',
    'if(!$v){$w=[DD]::FindWindowEx([IntPtr]::Zero,[IntPtr]::Zero,"WorkerW",$null);while($w){$d=[DD]::FindWindowEx($w,[IntPtr]::Zero,"SHELLDLL_DefView",$null);if($d){$v=$d;break};$w=[DD]::FindWindowEx([IntPtr]::Zero,$w,"WorkerW",$null)}}',
    'if($v){$l=[DD]::FindWindowEx($v,[IntPtr]::Zero,"SysListView32",$null);if($l){[DD]::ShowWindow($l,$cmd)|Out-Null}}',
  ]

  const tmpPath = path.join(app.getPath('temp'), `ddi${Date.now()}.ps1`)
  try {
    fs.writeFileSync(tmpPath, psLines.join('\r\n'), 'utf8')
    execFile(
      'powershell.exe',
      ['-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmpPath],
      { windowsHide: true },
      (err, _out, stderr) => {
        try { fs.unlinkSync(tmpPath) } catch {}
        if (err) console.error('icons PS err:', err.message)
        if (stderr) console.error('icons PS stderr:', stderr)
      }
    )
  } catch (e) {
    console.error('toggleDesktopIcons err:', e)
  }
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'drawer-config.json')
}

function readConfig() {
  try {
    const p = getConfigPath()
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {}
  return { version: 1, iconsHidden: false }
}

function writeConfig(config) {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2))
    return true
  } catch {
    return false
  }
}

function createWindow() {
  const primary = screen.getPrimaryDisplay()
  const { x, y, width, height } = primary.bounds

  mainWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    transparent: true,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    focusable: false,   // never steal focus from user's active window
    hasShadow: false,
    type: 'toolbar',    // WS_EX_TOOLWINDOW — removes from Alt+Tab and taskbar grouping
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })

  // If something does manage to minimize us (e.g. Aero Peek edge cases), restore immediately
  mainWindow.on('minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.restore()
  })

  // Start click-through; mousemove is still forwarded to renderer with forward:true
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    if (desktopWatcher) { desktopWatcher.close(); desktopWatcher = null }
  })

  // Restore config state on startup
  const config = readConfig()
  if (config.iconsHidden) {
    mainWindow.webContents.once('did-finish-load', () => {
      toggleDesktopIcons(true)
    })
  }
}

app.whenReady().then(() => {
  createWindow()
  watchDesktop()
})

app.on('window-all-closed', () => app.quit())

// ─── IPC ────────────────────────────────────────────────────────────────────

ipcMain.handle('read-desktop', () => readDesktopFiles())

ipcMain.handle('open-file', async (_, filePath) => {
  const result = await shell.openPath(filePath)
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.blur()
  return result
})

ipcMain.handle('get-file-icon', async (_, filePath) => {
  try {
    const icon = await app.getFileIcon(filePath, { size: 'normal' })
    return icon.toDataURL()
  } catch {
    return null
  }
})

ipcMain.handle('toggle-desktop-icons', (_, hide) => {
  toggleDesktopIcons(hide)
  return true
})

// Fire-and-forget for low-latency mouse event toggling
ipcMain.on('set-ignore-mouse', (_, ignore) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (ignore) {
      mainWindow.setIgnoreMouseEvents(true, { forward: true })
    } else {
      mainWindow.setIgnoreMouseEvents(false)
    }
  }
})

ipcMain.handle('move-file', (_, { src, dest }) => {
  try {
    fs.renameSync(src, dest)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('read-config', () => readConfig())
ipcMain.handle('write-config', (_, config) => writeConfig(config))

ipcMain.on('start-drag', async (event, filePath) => {
  try {
    const icon = await app.getFileIcon(filePath, { size: 'small' })
    event.sender.startDrag({ file: filePath, icon })
  } catch (err) {
    console.error('startDrag error:', err)
  }
})
