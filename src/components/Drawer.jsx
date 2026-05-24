import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import FileItem from './FileItem.jsx'

const HOVER_OPEN_DELAY = 2000

const DRAWER_W    = 340
const HANDLE_THICK = 12

const LABELS = { left: 'Archive', right: 'Reliquary' }

const spring = { type: 'spring', damping: 32, stiffness: 320, mass: 0.8 }

function getHandleStyle(side) {
  const base = { position: 'fixed', zIndex: 100, cursor: 'default' }
  if (side === 'left')  return { ...base, left: 0, top: 0, width: HANDLE_THICK, height: '100vh' }
  return                       { ...base, right: 0, top: 0, width: HANDLE_THICK, height: '100vh' }
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
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  }
  if (side === 'left')
    return { ...base, left: 0, top: 0, width: DRAWER_W, height: '100vh',
             borderRight: '1px solid rgba(38,62,118,0.45)', boxShadow: '5px 0 40px rgba(18,36,85,0.5)' }
  return   { ...base, right: 0, top: 0, width: DRAWER_W, height: '100vh',
             borderLeft: '1px solid rgba(38,62,118,0.45)', boxShadow: '-5px 0 40px rgba(18,36,85,0.5)' }
}

function getPanelVariants(side) {
  if (side === 'left')  return { hidden: { x: -DRAWER_W - 10 }, visible: { x: 0 }, exit: { x: -DRAWER_W - 10 } }
  return                       { hidden: { x: DRAWER_W + 10 },  visible: { x: 0 }, exit: { x: DRAWER_W + 10 } }
}

export default function Drawer({ side, files, isOpen, onHandleClick, onDrawerLeave, onDrawerEnter, onReorder, onHide }) {
  const scrollRef    = useRef(null)
  const hoverTimer   = useRef(null)
  const [draggingPath, setDraggingPath] = useState(null)
  const [dragOverPath, setDragOverPath] = useState(null)
  const [handleHover, setHandleHover]   = useState(false)   // charging up

  const startHover = () => {
    setHandleHover(true)
    hoverTimer.current = setTimeout(() => {
      onHandleClick()
      setHandleHover(false)
    }, HOVER_OPEN_DELAY)
  }

  const cancelHover = () => {
    clearTimeout(hoverTimer.current)
    setHandleHover(false)
    onDrawerLeave()
  }

  const handleDrop = (targetPath) => {
    if (draggingPath && draggingPath !== targetPath) {
      onReorder(draggingPath, targetPath)
    }
    setDraggingPath(null)
    setDragOverPath(null)
  }

  return (
    <>
      {/* ── Edge handle (hover 2 s to open) ── */}
      <div
        style={getHandleStyle(side)}
        onMouseEnter={!isOpen ? startHover : undefined}
        onMouseLeave={isOpen ? onDrawerLeave : cancelHover}
      >
        <motion.div
          style={{ width: '100%', height: '100%', background: getHandleGlow(side) }}
          animate={isOpen
            ? { opacity: 1, scaleX: 1.6 }
            : handleHover
              ? { opacity: 1, scaleX: 1.4 }
              : { opacity: [0.28, 0.62, 0.28], scaleX: 1 }}
          transition={isOpen || handleHover
            ? { duration: isOpen ? 0.15 : HOVER_OPEN_DELAY / 1000, ease: 'easeIn' }
            : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* charge-up progress bar */}
        {handleHover && !isOpen && (
          <motion.div
            key="charge"
            style={{
              position: 'absolute',
              [side === 'left' ? 'left' : 'right']: 0,
              top: 0,
              width: 3,
              height: '100%',
              background: 'rgba(90,140,255,0.9)',
              boxShadow: '0 0 8px rgba(90,140,255,0.8)',
              originY: 0,
              scaleY: 0,
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
            style={getPanelStyle(side)}
            variants={getPanelVariants(side)}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={spring}
            onMouseEnter={onDrawerEnter}
            onMouseLeave={onDrawerLeave}
          >
            {/* Ambient side glow */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: side === 'left'
                ? 'radial-gradient(ellipse 55% 40% at 0% 50%, rgba(28,48,105,0.18) 0%, transparent 70%)'
                : 'radial-gradient(ellipse 55% 40% at 100% 50%, rgba(28,48,105,0.18) 0%, transparent 70%)',
            }} />

            {/* Candle warmth at bottom */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 110, pointerEvents: 'none',
              background: 'radial-gradient(ellipse 80% 100% at 50% 100%, rgba(70,42,15,0.15) 0%, transparent 70%)',
            }} />

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
              <span style={{ color: 'rgba(65,95,160,0.55)', fontSize: 10 }}>{files.length}</span>
            </div>

            {/* File grid */}
            <div
              ref={scrollRef}
              className="drawer-scroll"
              style={{
                padding: '10px 8px',
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 2,
                alignContent: 'flex-start',
              }}
            >
              {files.map((file, i) => {
                const isDragging = draggingPath === file.path
                const isDragOver = dragOverPath === file.path && draggingPath !== file.path

                return (
                  <div
                    key={file.path}
                    style={{
                      position: 'relative',
                      opacity: isDragging ? 0.25 : 1,
                      transition: 'opacity 0.15s',
                    }}
                    onDragStart={() => setDraggingPath(file.path)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (draggingPath && draggingPath !== file.path) setDragOverPath(file.path)
                    }}
                    onDrop={(e) => { e.preventDefault(); handleDrop(file.path) }}
                    onDragEnd={() => { setDraggingPath(null); setDragOverPath(null) }}
                  >
                    {/* Drop target indicator */}
                    {isDragOver && (
                      <div style={{
                        position: 'absolute', inset: 3, borderRadius: 9,
                        border: '1px solid rgba(90,150,255,0.75)',
                        boxShadow: '0 0 14px rgba(90,150,255,0.4), inset 0 0 10px rgba(90,150,255,0.08)',
                        pointerEvents: 'none',
                        zIndex: 20,
                      }} />
                    )}

                    <motion.div
                      initial={{ opacity: 0, scale: 0.88 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: Math.min(i * 0.016, 0.28), duration: 0.2 }}
                    >
                      <FileItem file={file} onRemove={() => onHide(file.path)} />
                    </motion.div>
                  </div>
                )
              })}

              {files.length === 0 && (
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
