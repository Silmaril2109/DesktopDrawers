import { useState, useEffect, useRef, useCallback } from 'react'
import Drawer from './components/Drawer.jsx'

function applyOrder(files, order) {
  if (!order || order.length === 0) return files
  const byPath = new Map(files.map(f => [f.path, f]))
  const sorted = order.filter(p => byPath.has(p)).map(p => byPath.get(p))
  const rest   = files.filter(f => !order.includes(f.path))
  return [...sorted, ...rest]
}

const CLOSE_DELAY  = 300
const HANDLE_THICK = 12   // px — must match Drawer.jsx
const DEFAULT_COLOR      = '#3458A8'
const DEFAULT_HOVER_DELAY = 2000

export default function App() {
  const [drawerFiles,  setDrawerFiles]  = useState({ left: [], right: [] })
  const [activeDrawer, setActiveDrawer] = useState(null)
  const [chargingSide, setChargingSide] = useState(null)
  const [drawerColors, setDrawerColors] = useState({ left: DEFAULT_COLOR, right: DEFAULT_COLOR })
  const [hoverDelay,   setHoverDelay]   = useState(DEFAULT_HOVER_DELAY)

  const activeDrawerRef = useRef(null)
  const closeTimerRef   = useRef(null)
  const chargeTimerRef  = useRef(null)
  const lastIgnoreState = useRef(true)
  // ref so the mousemove effect always reads the latest delay without re-subscribing
  const hoverDelayRef   = useRef(DEFAULT_HOVER_DELAY)

  useEffect(() => { hoverDelayRef.current = hoverDelay }, [hoverDelay])

  const screenW = typeof window !== 'undefined' ? window.screen.width : 1920

  useEffect(() => {
    ;(async () => {
      const [leftFiles, rightFiles, config] = await Promise.all([
        window.electron.readDrawer('left'),
        window.electron.readDrawer('right'),
        window.electron.readConfig(),
      ])
      const order  = config.drawerOrder  || {}
      const colors = config.drawerColors || {}
      setDrawerFiles({
        left:  applyOrder(leftFiles,  order.left),
        right: applyOrder(rightFiles, order.right),
      })
      setDrawerColors({
        left:  colors.left  || DEFAULT_COLOR,
        right: colors.right || DEFAULT_COLOR,
      })
      setHoverDelay(config.hoverDelay || DEFAULT_HOVER_DELAY)
    })()
    window.electron.onDrawerChange(({ side, files }) => {
      setDrawerFiles(prev => ({ ...prev, [side]: files }))
    })
    window.electron.onHoverDelayChange((ms) => setHoverDelay(ms))
    return () => {
      window.electron.removeDrawerListener()
      window.electron.removeHoverDelayListener()
    }
  }, [])

  const setIgnoreMouse = useCallback((ignore) => {
    if (lastIgnoreState.current === ignore) return
    lastIgnoreState.current = ignore
    window.electron.setIgnoreMouse(ignore)
  }, [])

  useEffect(() => {
    activeDrawerRef.current = activeDrawer
    setIgnoreMouse(activeDrawer === null)
  }, [activeDrawer, setIgnoreMouse])

  const openDrawer    = useCallback((side) => { clearTimeout(closeTimerRef.current); setIgnoreMouse(false); setActiveDrawer(side) }, [setIgnoreMouse])
  const scheduleClose = useCallback(() => {
    closeTimerRef.current = setTimeout(() => { setActiveDrawer(null); setIgnoreMouse(true) }, CLOSE_DELAY)
  }, [setIgnoreMouse])
  const cancelClose   = useCallback(() => clearTimeout(closeTimerRef.current), [])

  const clearCharge = useCallback(() => {
    clearTimeout(chargeTimerRef.current)
    chargeTimerRef.current = null
    setChargingSide(null)
  }, [])

  // ── Mouse movement: charge timer runs here because mouseenter on the handle
  //    doesn't fire reliably in setIgnoreMouseEvents(true, {forward:true}) mode.
  useEffect(() => {
    const onMouseMove = (e) => {
      const { clientX: x } = e
      const hasDrawer = activeDrawerRef.current !== null

      if (hasDrawer) {
        clearCharge()
        return
      }

      setIgnoreMouse(true)

      const nearLeft  = x <= HANDLE_THICK
      const nearRight = x >= screenW - HANDLE_THICK

      if (nearLeft || nearRight) {
        const side = nearLeft ? 'left' : 'right'
        if (chargeTimerRef.current === null) {
          setChargingSide(side)
          chargeTimerRef.current = setTimeout(() => {
            chargeTimerRef.current = null
            setChargingSide(null)
            openDrawer(side)
          }, hoverDelayRef.current)
        }
      } else {
        if (chargeTimerRef.current !== null) clearCharge()
      }
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [screenW, setIgnoreMouse, openDrawer, clearCharge])

  // ── Window-level drag detection (from Explorer / Desktop) ──
  useEffect(() => {
    const onWindowDragOver = (e) => {
      e.preventDefault()
      setIgnoreMouse(false)
      cancelClose()
      const x = e.clientX
      if (x <= HANDLE_THICK)                openDrawer('left')
      else if (x >= screenW - HANDLE_THICK) openDrawer('right')
    }

    const onWindowDrop = async (e) => {
      e.preventDefault()
      const side = activeDrawerRef.current
      if (!side) return
      const drawerFile = e.dataTransfer.getData('application/x-drawer-file')
      const drawerSrc  = e.dataTransfer.getData('application/x-drawer-side')
      if (drawerFile) {
        if (drawerSrc !== side) await window.electron.moveToDrawer(drawerFile, side)
      } else {
        for (const f of Array.from(e.dataTransfer.files)) {
          const p = window.electron.getPathForFile(f)
          if (p) await window.electron.moveToDrawer(p, side)
        }
      }
    }

    window.addEventListener('dragover', onWindowDragOver)
    window.addEventListener('drop',     onWindowDrop)
    return () => {
      window.removeEventListener('dragover', onWindowDragOver)
      window.removeEventListener('drop',     onWindowDrop)
    }
  }, [screenW, setIgnoreMouse, openDrawer, cancelClose])

  const handleMoveToDesktop      = useCallback(async (p) => window.electron.moveFromDrawer(p), [])
  const handleMoveToDrawer       = useCallback(async (p, side) => window.electron.moveToDrawer(p, side), [])
  const handleMoveBetweenDrawers = useCallback(async (p, toSide) => window.electron.moveToDrawer(p, toSide), [])

  const handleColorChange = useCallback((side, color) => {
    setDrawerColors(prev => {
      const next = { ...prev, [side]: color }
      window.electron.readConfig().then(cfg =>
        window.electron.writeConfig({ ...cfg, drawerColors: next })
      )
      return next
    })
    window.electron.updateTrayColor(color)
  }, [])

  const handleDesktopDrop = useCallback(async (e) => {
    const filePath = e.dataTransfer.getData('application/x-drawer-file')
    if (!filePath) return
    e.preventDefault()
    await window.electron.moveFromDrawer(filePath)
  }, [])

  return (
    <div
      style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'transparent' }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDrop={handleDesktopDrop}
    >
      {['left', 'right'].map(side => (
        <Drawer
          key={side}
          side={side}
          files={drawerFiles[side]}
          isOpen={activeDrawer === side}
          isCharging={chargingSide === side}
          color={drawerColors[side]}
          hoverDelay={hoverDelay}
          onColorChange={(color) => handleColorChange(side, color)}
          onDrawerLeave={scheduleClose}
          onDrawerEnter={cancelClose}
          onMoveToDesktop={handleMoveToDesktop}
          onDropFile={(p) => handleMoveToDrawer(p, side)}
          onMoveBetweenDrawers={(p) => handleMoveBetweenDrawers(p, side)}
        />
      ))}
    </div>
  )
}
