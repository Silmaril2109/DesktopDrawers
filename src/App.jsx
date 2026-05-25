import { useState, useEffect, useRef, useCallback } from 'react'
import Drawer from './components/Drawer.jsx'

const CLOSE_DELAY = 300

export default function App() {
  const [files, setFiles]           = useState([])
  const [fileOrders, setFileOrders] = useState({ left: [], right: [] })
  const [hidden, setHidden]         = useState([])   // paths excluded from drawers (file untouched on disk)
  const [activeDrawer, setActiveDrawer] = useState(null)

  const activeDrawerRef  = useRef(null)
  const closeTimerRef    = useRef(null)
  const lastIgnoreState  = useRef(true)
  // Refs so async state writes always read the latest value without stale closures
  const fileOrdersRef    = useRef({ left: [], right: [] })
  const hiddenRef        = useRef([])

  useEffect(() => { fileOrdersRef.current = fileOrders }, [fileOrders])
  useEffect(() => { hiddenRef.current     = hidden     }, [hidden])

  useEffect(() => {
    ;(async () => {
      const [desktopFiles, config] = await Promise.all([
        window.electron.readDesktop(),
        window.electron.readConfig(),
      ])
      setFiles(desktopFiles)
      if (config.orders) setFileOrders(config.orders)
      if (config.hidden) setHidden(config.hidden)
    })()
    window.electron.onDesktopChange(setFiles)
    return () => window.electron.removeDesktopListener()
  }, [])

  useEffect(() => { activeDrawerRef.current = activeDrawer }, [activeDrawer])

  const setIgnoreMouse = useCallback((ignore) => {
    if (lastIgnoreState.current !== ignore) {
      lastIgnoreState.current = ignore
      window.electron.setIgnoreMouse(ignore)
    }
  }, [])

  useEffect(() => {
    const onMouseMove = () => {
      if (activeDrawerRef.current !== null) setIgnoreMouse(false)
      else setIgnoreMouse(true)
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [setIgnoreMouse])

  const openDrawer   = useCallback((side) => { clearTimeout(closeTimerRef.current); setIgnoreMouse(false); setActiveDrawer(side) }, [setIgnoreMouse])
  const scheduleClose = useCallback(() => {
    closeTimerRef.current = setTimeout(() => { setActiveDrawer(null); setIgnoreMouse(true) }, CLOSE_DELAY)
  }, [setIgnoreMouse])
  const cancelClose  = useCallback(() => clearTimeout(closeTimerRef.current), [])

  const save = useCallback((orders, hiddenPaths) => {
    window.electron.writeConfig({ version: 1, orders, hidden: hiddenPaths })
  }, [])

  // Files for a drawer: strip hidden paths, then apply saved order
  const getOrderedFiles = useCallback((side) => {
    const visible = files.filter(f => !hidden.includes(f.path))
    const order   = fileOrders[side]
    if (!order || order.length === 0) return visible
    return [...visible].sort((a, b) => {
      const ai = order.indexOf(a.path)
      const bi = order.indexOf(b.path)
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }, [files, fileOrders, hidden])

  const handleReorder = useCallback((side, fromPath, toPath) => {
    setFileOrders(prev => {
      const base = prev[side].length ? prev[side] : files.map(f => f.path)
      const fi = base.indexOf(fromPath)
      const ti = base.indexOf(toPath)
      if (fi === -1 || ti === -1 || fi === ti) return prev
      const next = [...base]
      next.splice(fi, 1)
      next.splice(ti, 0, fromPath)
      const newOrders = { ...prev, [side]: next }
      save(newOrders, hiddenRef.current)
      return newOrders
    })
  }, [files, save])

  // Hide a file from all drawers — desktop file is never touched
  const handleHide = useCallback((filePath) => {
    setHidden(prev => {
      if (prev.includes(filePath)) return prev
      const next = [...prev, filePath]
      save(fileOrdersRef.current, next)
      return next
    })
  }, [save])

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'transparent' }}>
      {['left', 'right'].map(side => (
        <Drawer
          key={side}
          side={side}
          files={getOrderedFiles(side)}
          isOpen={activeDrawer === side}
          onHandleClick={() => openDrawer(side)}
          onDrawerLeave={scheduleClose}
          onDrawerEnter={cancelClose}
          onReorder={(from, to) => handleReorder(side, from, to)}
          onHide={handleHide}
        />
      ))}
    </div>
  )
}
