import { useState, useEffect, useRef, useCallback } from 'react'
import Drawer from './components/Drawer.jsx'

const EDGE_THRESHOLD = 14
const CLOSE_DELAY = 300
const DRAWER_W = 340  // must match Drawer.jsx

export default function App() {
  const [drawerFiles, setDrawerFiles] = useState({ left: [], right: [] })
  const [activeDrawer, setActiveDrawer] = useState(null)

  const activeDrawerRef = useRef(null)
  const closeTimerRef   = useRef(null)
  const lastIgnoreState = useRef(true)

  const screenW = typeof window !== 'undefined' ? window.screen.width : 1920

  useEffect(() => {
    ;(async () => {
      const [leftFiles, rightFiles] = await Promise.all([
        window.electron.readDrawer('left'),
        window.electron.readDrawer('right'),
      ])
      setDrawerFiles({ left: leftFiles, right: rightFiles })
    })()
    window.electron.onDrawerChange(({ side, files }) => {
      setDrawerFiles(prev => ({ ...prev, [side]: files }))
    })
    return () => window.electron.removeDrawerListener()
  }, [])

  useEffect(() => { activeDrawerRef.current = activeDrawer }, [activeDrawer])

  const setIgnoreMouse = useCallback((ignore) => {
    if (lastIgnoreState.current !== ignore) {
      lastIgnoreState.current = ignore
      window.electron.setIgnoreMouse(ignore)
    }
  }, [])

  // ── Normal mouse movement tracking (hover-to-open handles) ──
  useEffect(() => {
    const onMouseMove = (e) => {
      const { clientX: x } = e
      const nearLeft  = x <= EDGE_THRESHOLD
      const nearRight = x >= screenW - EDGE_THRESHOLD
      const hasDrawer = activeDrawerRef.current !== null
      if (nearLeft || nearRight || hasDrawer) setIgnoreMouse(false)
      else setIgnoreMouse(true)
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [screenW, setIgnoreMouse])

  const openDrawer    = useCallback((side) => { clearTimeout(closeTimerRef.current); setActiveDrawer(side) }, [])
  const scheduleClose = useCallback(() => {
    closeTimerRef.current = setTimeout(() => { setActiveDrawer(null); setIgnoreMouse(true) }, CLOSE_DELAY)
  }, [setIgnoreMouse])
  const cancelClose   = useCallback(() => clearTimeout(closeTimerRef.current), [])

  // ── Window-level drag detection ──
  // OS drags (from Explorer/Desktop) don't fire mousemove, so the drawer can close
  // before the user drags back. These handlers keep the overlay alive and open the
  // correct drawer as soon as a drag approaches an edge.
  useEffect(() => {
    const onWindowDragOver = (e) => {
      e.preventDefault()                  // required so 'drop' fires
      setIgnoreMouse(false)
      cancelClose()                       // keep current drawer open
      const x = e.clientX
      if (x <= EDGE_THRESHOLD)             openDrawer('left')
      else if (x >= screenW - EDGE_THRESHOLD) openDrawer('right')
    }

    const onWindowDrop = async (e) => {
      e.preventDefault()
      const side = activeDrawerRef.current
      if (!side) return

      const drawerFile = e.dataTransfer.getData('application/x-drawer-file')
      const drawerSrc  = e.dataTransfer.getData('application/x-drawer-side')

      if (drawerFile) {
        // Inter-drawer drag
        if (drawerSrc !== side) await window.electron.moveToDrawer(drawerFile, side)
      } else {
        // External files from Explorer / Desktop
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

  const handleMoveToDesktop = useCallback(async (filePath) => {
    await window.electron.moveFromDrawer(filePath)
  }, [])

  const handleMoveToDrawer = useCallback(async (filePath, side) => {
    await window.electron.moveToDrawer(filePath, side)
  }, [])

  const handleMoveBetweenDrawers = useCallback(async (filePath, toSide) => {
    await window.electron.moveToDrawer(filePath, toSide)
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
          onHandleClick={() => openDrawer(side)}
          onDrawerLeave={scheduleClose}
          onDrawerEnter={cancelClose}
          onMoveToDesktop={handleMoveToDesktop}
          onDropFile={(filePath) => handleMoveToDrawer(filePath, side)}
          onMoveBetweenDrawers={(filePath) => handleMoveBetweenDrawers(filePath, side)}
        />
      ))}
    </div>
  )
}
