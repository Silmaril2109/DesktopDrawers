const { app, BrowserWindow, ipcMain, shell, screen, nativeImage, Tray, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { exec, execFile } = require('child_process')
const { promisify } = require('util')
const execFileAsync = promisify(execFile)

// Prevent 0xC0000005 GPU-process crashes on Windows with transparent composited windows
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('no-sandbox')

// Single-instance guard — second launch focuses existing instance instead of spawning
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

const isDev = process.env.NODE_ENV === 'development'

let mainWindow = null
let tray       = null
let desktopWatcher = null
const iconCache = new Map()

// ─── Tray icon (generated inline — no external assets required) ───────────────
function makeTrayIcon() {
  const zlib = require('zlib')

  // CRC32 for PNG chunks
  const crcTable = (() => {
    const t = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
      t[i] = c
    }
    return t
  })()
  function crc32(buf) {
    let c = 0xFFFFFFFF
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
    return (c ^ 0xFFFFFFFF) >>> 0
  }
  function pngChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii')
    const lenBuf  = Buffer.allocUnsafe(4); lenBuf.writeUInt32BE(data.length, 0)
    const crcBuf  = Buffer.allocUnsafe(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
  }

  const W = 16, H = 16
  const raw = []
  for (let y = 0; y < H; y++) {
    raw.push(0) // filter = None per row
    for (let x = 0; x < W; x++) {
      const dx = x - 7.5, dy = y - 7.5, d = Math.sqrt(dx*dx + dy*dy)
      if (d < 5.5) {
        const t = Math.max(0, 1 - d / 5.5)
        raw.push(30 + Math.round(t*70), 70 + Math.round(t*110), 180 + Math.round(t*75), 240)
      } else if (d < 7) {
        raw.push(18, 28, 62, 160)
      } else {
        raw.push(0, 0, 0, 0)
      }
    }
  }

  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.from(raw))),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
  return nativeImage.createFromBuffer(png)
}

function createTray() {
  tray = new Tray(makeTrayIcon())
  tray.setToolTip('DesktopDrawer')

  const buildMenu = () => {
    const loginItem = app.getLoginItemSettings()
    return Menu.buildFromTemplate([
      {
        label: 'Reload Overlay',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload()
        },
      },
      {
        label: 'Restart App',
        click: () => { app.relaunch(); app.exit(0) },
      },
      { type: 'separator' },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        checked: loginItem.openAtLogin,
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked })
          tray.setContextMenu(buildMenu())
        },
      },
      { type: 'separator' },
      { label: 'Quit DesktopDrawer', role: 'quit' },
    ])
  }

  tray.setContextMenu(buildMenu())
  // Left-click also opens the menu (Windows convention)
  tray.on('click', () => tray.popUpContextMenu())
}

// ─── Drawer storage ──────────────────────────────────────────────────────────
const DRAWER_ROOT = path.join(os.homedir(), 'Documents', 'DesktopDrawer')
const DRAWER_DIRS = {
  left:  path.join(DRAWER_ROOT, 'Left'),
  right: path.join(DRAWER_ROOT, 'Right'),
  top:   path.join(DRAWER_ROOT, 'Top'),
}
const drawerWatchers = {}

function ensureDrawerFolders() {
  for (const dir of Object.values(DRAWER_DIRS)) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }
}

function readDrawerFiles(side) {
  const dir = DRAWER_DIRS[side]
  if (!dir) return []
  try {
    const entries = fs.readdirSync(dir)
    return entries
      .map(name => {
        const filePath = path.join(dir, name)
        try {
          const stat = fs.statSync(filePath)
          return { name, path: filePath, isDirectory: stat.isDirectory(), size: stat.size, modified: stat.mtime.getTime() }
        } catch { return null }
      })
      .filter(Boolean)
      .filter(f => !f.name.startsWith('.') && f.name !== 'desktop.ini')
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
  } catch { return [] }
}

function watchDrawers() {
  for (const [side, dir] of Object.entries(DRAWER_DIRS)) {
    let timer = null
    try {
      drawerWatchers[side] = fs.watch(dir, { persistent: false }, () => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('drawer-changed', { side, files: readDrawerFiles(side) })
          }
        }, 400)
      })
    } catch (e) {
      console.error(`watch drawer ${side}:`, e)
    }
  }
}

// Resolve the target path of a Windows .lnk shortcut via PowerShell COM
async function resolveShortcutTarget(lnkPath) {
  const escaped = lnkPath.replace(/'/g, "''")
  const ps = `try{$sh=New-Object -ComObject WScript.Shell;$sc=$sh.CreateShortcut('${escaped}');if($sc.TargetPath){Write-Output $sc.TargetPath}}catch{}`
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { windowsHide: true, timeout: 4000 }
    )
    return stdout.trim() || null
  } catch {
    return null
  }
}

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

  // Elevate to screen-saver level so drawers sit above all normal windows on Windows
  mainWindow.setAlwaysOnTop(true, 'screen-saver')

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
    for (const w of Object.values(drawerWatchers)) { try { w.close() } catch {} }
  })

  // Auto-recover if the renderer process crashes
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('Renderer gone:', details.reason)
    if (mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => mainWindow.webContents.reload(), 1000)
    }
  })

  // Restore config state on startup
  const config = readConfig()
  if (config.iconsHidden) {
    mainWindow.webContents.once('did-finish-load', () => {
      toggleDesktopIcons(true)
    })
  }
}

app.on('second-instance', () => {
  // Second launch attempt — just focus existing window (already handled by lock above,
  // but this fires if the lock owner is still alive)
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus()
})

app.whenReady().then(() => {
  ensureDrawerFolders()
  createWindow()
  watchDesktop()
  watchDrawers()
  createTray()
})

// Keep process alive via tray; quit only through tray → Quit
app.on('window-all-closed', () => { /* intentionally empty */ })

// ─── IPC ────────────────────────────────────────────────────────────────────

ipcMain.handle('read-desktop', () => readDesktopFiles())

ipcMain.handle('open-file', async (_, filePath) => {
  const result = await shell.openPath(filePath)
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.blur()
  return result
})

ipcMain.handle('get-file-icon', async (_, filePath) => {
  if (iconCache.has(filePath)) return iconCache.get(filePath)
  try {
    let iconPath = filePath
    // For .lnk shortcuts Electron returns the generic shortcut icon — resolve the real target
    if (filePath.toLowerCase().endsWith('.lnk')) {
      const target = await resolveShortcutTarget(filePath)
      if (target && fs.existsSync(target)) iconPath = target
    }
    const icon = await app.getFileIcon(iconPath, { size: 'large' })
    const result = icon.isEmpty() ? null : icon.toDataURL()
    iconCache.set(filePath, result)
    return result
  } catch {
    iconCache.set(filePath, null)
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

ipcMain.handle('save-drawer-order', (_, { side, paths }) => {
  const config = readConfig()
  if (!config.drawerOrder) config.drawerOrder = {}
  config.drawerOrder[side] = paths
  return writeConfig(config)
})

ipcMain.on('start-drag', async (event, filePath) => {
  try {
    let iconPath = filePath
    if (filePath.toLowerCase().endsWith('.lnk')) {
      const target = await resolveShortcutTarget(filePath)
      if (target && fs.existsSync(target)) iconPath = target
    }
    const icon = await app.getFileIcon(iconPath, { size: 'normal' })
    event.sender.startDrag({ file: filePath, icon: icon.isEmpty() ? nativeImage.createEmpty() : icon })
  } catch (err) {
    console.error('startDrag error:', err)
  }
})

// ─── Drawer storage IPC ──────────────────────────────────────────────────────

ipcMain.handle('read-drawer', (_, side) => readDrawerFiles(side))

ipcMain.handle('move-to-drawer', (_, { src, side }) => {
  try {
    const dir = DRAWER_DIRS[side]
    if (!dir) return { success: false, error: 'unknown side' }
    const dest = path.join(dir, path.basename(src))
    if (path.resolve(dest) === path.resolve(src)) return { success: true, dest }
    try {
      fs.renameSync(src, dest)
    } catch {
      // Cross-drive fallback
      fs.copyFileSync(src, dest)
      fs.unlinkSync(src)
    }
    return { success: true, dest }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('move-from-drawer', (_, { src }) => {
  try {
    const desktopPath = app.getPath('desktop')
    const dest = path.join(desktopPath, path.basename(src))
    try {
      fs.renameSync(src, dest)
    } catch {
      fs.copyFileSync(src, dest)
      fs.unlinkSync(src)
    }
    return { success: true, dest }
  } catch (err) {
    return { success: false, error: err.message }
  }
})
