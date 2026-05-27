import { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import FileItem from './FileItem.jsx'

const HOVER_OPEN_DELAY = 2000
const DRAWER_W    = 340
const HANDLE_THICK = 12
const LABELS = { left: 'Archive', right: 'Reliquary' }
const spring = { type: 'spring', damping: 32, stiffness: 320, mass: 0.8 }

function getHandleStyle(side) {
  const base = { position: 'fixed', zIndex: 100, cursor: 'default' }
  if (side === 'left') return { ...base, left: 0, top: 0, width: HANDLE_THICK, height: '100vh' }
  return                      { ...base, right: 0, top: 0, width: HANDLE_THICK, height: '100vh' }
}
function getHandleGlow(side) {
  if (side === 'left')
    return 'linear-gradient(to right, rgba(52,88,168,0.92) 0%, rgba(38,65,132,0.52) 50%, transparent 100%)'
  return   'linear-gradient(to left,  rgba(52,88,168,0.92) 0%, rgba(38,65,132,0.52) 50%, transparent 100%)'
}
function getPanelStyle(side) {
  const base = {
    position: 'fixed', zIndex: 200,
    background: 'linear-gradient(160deg, rgba(7,10,20,0.97) 0%, rgba(10,14,26,0.95) 100%)',
    backdropFilter: 'blur(22px)',
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
  }
  if (side === 'left')
    return { ...base, left: 0, top: 0, width: DRAWER_W, height: '100vh',
             borderRight: '1px solid rgba(38,62,118,0.45)', boxShadow: '5px 0 40px rgba(18,36,85,0.5)' }
  return   { ...base, right: 0, top: 0, width: DRAWER_W, height: '100vh',
             borderLeft: '1px solid rgba(38,62,118,0.45)', boxShadow: '-5px 0 40px rgba(18,36,85,0.5)' }
}
function getPanelVariants(side) {
  if (side === 'left') return { hidden: { x: -DRAWER_W - 10 }, visible: { x: 0 }, exit: { x: -DRAWER_W - 10 } }
  return                      { hidden: { x: DRAWER_W + 10 },  visible: { x: 0 }, exit: { x: DRAWER_W + 10 } }
}

export default function Drawer({
  side, files, isOpen, isCharging,
  onDrawerLeave, onDrawerEnter,
  onMoveToDesktop, onDropFile, onMoveBetweenDrawers,
}) {
  const scrollRef     = useRef(null)
  const isDraggingRef = useRef(false)

  const [dropActive,   setDropActive]   = useState(false)
  const [draggingPath, setDraggingPath] = useState(null)
  const [dragOverPath, setDragOverPath] = useState(null)

  // localFiles mirrors `files` but preserves user drag-to-reorder
  const [localFiles, setLocalFiles] = useState(files)

  useEffect(() => {
    setLocalFiles(prev => {
      const cur  = new Set(files.map(f => f.path))
      const prev_ = new Set(prev.map(f => f.path))
      const kept = prev.filter(f => cur.has(f.path))           // maintain order, remove deleted
      const added = files.filter(f => !prev_.has(f.path))     // new files go to end
      return [...kept, ...added]
    })
  }, [files])

  // ── Reorder ────────────────────────────────────────────────────────────────
  const reorder = (fromPath, toPath) => {
    setLocalFiles(prev => {
      const arr = [...prev]
      const fi = arr.findIndex(f => f.path === fromPath)
      const ti = arr.findIndex(f => f.path === toPath)
      if (fi === -1 || ti === -1 || fi === ti) return prev
      const [item] = arr.splice(fi, 1)
      arr.splice(ti, 0, item)
      window.electron.saveDrawerOrder(side, arr.map(f => f.path))
      return arr
    })
  }

  // ── Drop helpers ───────────────────────────────────────────────────────────
  const isExternalDrag = (e) =>
    !e.dataTransfer.types.includes('application/x-drawer-file') &&
    e.dataTransfer.types.includes('Files')

  const processExternalDrop = (e) => {
    Array.from(e.dataTransfer.files).forEach(f => {
      const p = window.electron.getPathForFile(f)
      if (p) onDropFile(p)
    })
  }

  // Per-file-item drop (reorder within drawer OR inter-drawer move)
  const handleFileItemDrop = (e, targetPath) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverPath(null)
    const srcFile = e.dataTransfer.getData('application/x-drawer-file')
    const srcSide = e.dataTransfer.getData('application/x-drawer-side')
    if (srcFile) {
      if (srcSide === side) reorder(srcFile, targetPath)
      else onMoveBetweenDrawers(srcFile)
    } else if (e.dataTransfer.files.length > 0) {
      processExternalDrop(e)
    }
  }

  // Panel-level drop (external files, or inter-drawer landing on empty space)
  const handlePanelDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDropActive(false)
    setDragOverPath(null)
    const srcFile = e.dataTransfer.getData('application/x-drawer-file')
    const srcSide = e.dataTransfer.getData('application/x-drawer-side')
    if (srcFile && srcSide !== side) onMoveBetweenDrawers(srcFile)
    else if (!srcFile && e.dataTransfer.files.length > 0) processExternalDrop(e)
  }

  // Handle-level drop (drawer not yet open when file dragged to edge)
  const handleHandleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDropActive(false)
    const srcFile = e.dataTransfer.getData('application/x-drawer-file')
    const srcSide = e.dataTransfer.getData('application/x-drawer-side')
    if (srcFile && srcSide !== side) onMoveBetweenDrawers(srcFile)
    else if (!srcFile && e.dataTransfer.files.length > 0) processExternalDrop(e)
  }

  return (
    <>
      {/* ── Edge handle (charge driven by App mousemove, not mouseenter) ── */}
      <div
        style={getHandleStyle(side)}
        onDragEnter={(e) => { e.preventDefault(); onDrawerEnter(); setDropActive(true) }}
        onDragOver={(e)  => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDrawerEnter() }}
        onDrop={handleHandleDrop}
      >
        <motion.div
          style={{ width: '100%', height: '100%', background: getHandleGlow(side) }}
          animate={isOpen
            ? { opacity: 1, scaleX: 1.6 }
            : isCharging
              ? { opacity: 1, scaleX: 1.4 }
              : { opacity: [0.28, 0.62, 0.28], scaleX: 1 }}
          transition={isOpen || isCharging
            ? { duration: isOpen ? 0.15 : HOVER_OPEN_DELAY / 1000, ease: 'easeIn' }
            : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        {isCharging && !isOpen && (
          <motion.div
            key="charge"
            style={{
              position: 'absolute', [side === 'left' ? 'left' : 'right']: 0,
              top: 0, width: 3, height: '100%',
              background: 'rgba(90,140,255,0.9)', boxShadow: '0 0 8px rgba(90,140,255,0.8)',
              originY: 0, scaleY: 0,
            }}
            animate={{ scaleY: 1 }}
            transition={{ duration: HOVER_OPEN_DELAY / 1000, ease: 'linear' }}
          />
        )}
      </div>

      {/* ── Drawer panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            style={{
              ...getPanelStyle(side),
              ...(dropActive ? {
                boxShadow: side === 'left'
                  ? '5px 0 40px rgba(18,36,85,0.5), inset 0 0 0 2px rgba(80,140,255,0.55)'
                  : '-5px 0 40px rgba(18,36,85,0.5), inset 0 0 0 2px rgba(80,140,255,0.55)',
              } : {}),
            }}
            variants={getPanelVariants(side)}
            initial="hidden" animate="visible" exit="exit"
            transition={spring}
            onMouseEnter={onDrawerEnter}
            onMouseLeave={() => { if (!isDraggingRef.current) onDrawerLeave() }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              e.dataTransfer.dropEffect = 'move'
              if (isExternalDrag(e)) setDropActive(true)
            }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropActive(false) }}
            onDrop={handlePanelDrop}
          >
            {/* Ambient side glow */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: side === 'left'
                ? 'radial-gradient(ellipse 55% 40% at 0% 50%, rgba(28,48,105,0.18) 0%, transparent 70%)'
                : 'radial-gradient(ellipse 55% 40% at 100% 50%, rgba(28,48,105,0.18) 0%, transparent 70%)',
            }} />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 110, pointerEvents: 'none',
              background: 'radial-gradient(ellipse 80% 100% at 50% 100%, rgba(70,42,15,0.15) 0%, transparent 70%)',
            }} />
            {dropActive && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 300,
                background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(60,110,255,0.08) 0%, transparent 70%)',
              }} />
            )}

            {/* Header */}
            <div style={{
              padding: '14px 16px 10px', flexShrink: 0,
              borderBottom: '1px solid rgba(35,58,110,0.35)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ color: 'rgba(85,115,190,0.75)', fontSize: 9, letterSpacing: '3.5px', textTransform: 'uppercase' }}>
                {LABELS[side]}
              </span>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, rgba(38,62,118,0.45), transparent)' }} />
              <span style={{ color: 'rgba(65,95,160,0.55)', fontSize: 10 }}>{localFiles.length}</span>
            </div>

            {dropActive && (
              <div style={{
                padding: '6px 16px', flexShrink: 0,
                color: 'rgba(90,140,255,0.7)', fontSize: 9,
                letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center',
              }}>— drop to store —</div>
            )}

            {/* File grid */}
            <div
              ref={scrollRef}
              className="drawer-scroll"
              style={{
                padding: '10px 8px', flex: 1,
                overflowY: 'auto', overflowX: 'hidden',
                display: 'flex', flexWrap: 'wrap', gap: 2,
                alignContent: 'flex-start',
              }}
            >
              {localFiles.map((file, i) => {
                const isDragging = draggingPath === file.path
                const isTarget   = dragOverPath === file.path && !isDragging

                return (
                  <div
                    key={file.path}
                    draggable={false}
                    style={{
                      opacity: isDragging ? 0.25 : 1,
                      transition: 'opacity 0.15s',
                      borderRadius: 10,
                      outline: isTarget ? '2px solid rgba(90,140,255,0.72)' : '2px solid transparent',
                      boxShadow: isTarget ? '0 0 12px rgba(90,140,255,0.3)' : 'none',
                    }}
                    onDragStart={() => { setDraggingPath(file.path); isDraggingRef.current = true }}
                    onDragEnd={() => { setDraggingPath(null); setDragOverPath(null); isDraggingRef.current = false }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      e.dataTransfer.dropEffect = 'move'
                      setDragOverPath(file.path)
                    }}
                    onDragLeave={() => setDragOverPath(null)}
                    onDrop={(e) => handleFileItemDrop(e, file.path)}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.88 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: Math.min(i * 0.016, 0.28), duration: 0.2 }}
                    >
                      <FileItem
                        file={file}
                        drawerSide={side}
                        onRemove={() => onMoveToDesktop(file.path)}
                      />
                    </motion.div>
                  </div>
                )
              })}

              {localFiles.length === 0 && !dropActive && (
                <div style={{ color: 'rgba(60,90,145,0.4)', fontSize: 11, padding: 24, width: '100%', textAlign: 'center' }}>
                  — empty —
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
