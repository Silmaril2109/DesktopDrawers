import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

// File-type dot/glow colors — semantic, stay fixed regardless of drawer theme
const TYPES = {
  _dir: { c: 'rgba(215,168,48,0.88)',  g: 'rgba(215,168,48,0.32)' },
  pdf:  { c: 'rgba(228,72,52,0.82)',   g: 'rgba(228,72,52,0.28)' },
  doc:  { c: 'rgba(52,112,228,0.82)',  g: 'rgba(52,112,228,0.28)' },
  docx: { c: 'rgba(52,112,228,0.82)',  g: 'rgba(52,112,228,0.28)' },
  txt:  { c: 'rgba(80,108,175,0.75)',  g: 'rgba(80,108,175,0.24)' },
  md:   { c: 'rgba(80,108,175,0.75)',  g: 'rgba(80,108,175,0.24)' },
  xls:  { c: 'rgba(52,178,80,0.82)',   g: 'rgba(52,178,80,0.28)' },
  xlsx: { c: 'rgba(52,178,80,0.82)',   g: 'rgba(52,178,80,0.28)' },
  csv:  { c: 'rgba(52,178,80,0.82)',   g: 'rgba(52,178,80,0.28)' },
  ppt:  { c: 'rgba(228,98,48,0.82)',   g: 'rgba(228,98,48,0.28)' },
  pptx: { c: 'rgba(228,98,48,0.82)',   g: 'rgba(228,98,48,0.28)' },
  jpg:  { c: 'rgba(158,72,228,0.82)',  g: 'rgba(158,72,228,0.28)' },
  jpeg: { c: 'rgba(158,72,228,0.82)',  g: 'rgba(158,72,228,0.28)' },
  png:  { c: 'rgba(158,72,228,0.82)',  g: 'rgba(158,72,228,0.28)' },
  gif:  { c: 'rgba(158,72,228,0.82)',  g: 'rgba(158,72,228,0.28)' },
  svg:  { c: 'rgba(158,72,228,0.82)',  g: 'rgba(158,72,228,0.28)' },
  webp: { c: 'rgba(158,72,228,0.82)',  g: 'rgba(158,72,228,0.28)' },
  mp4:  { c: 'rgba(228,122,32,0.82)',  g: 'rgba(228,122,32,0.28)' },
  avi:  { c: 'rgba(228,122,32,0.82)',  g: 'rgba(228,122,32,0.28)' },
  mkv:  { c: 'rgba(228,122,32,0.82)',  g: 'rgba(228,122,32,0.28)' },
  mov:  { c: 'rgba(228,122,32,0.82)',  g: 'rgba(228,122,32,0.28)' },
  mp3:  { c: 'rgba(42,205,178,0.82)',  g: 'rgba(42,205,178,0.28)' },
  wav:  { c: 'rgba(42,205,178,0.82)',  g: 'rgba(42,205,178,0.28)' },
  flac: { c: 'rgba(42,205,178,0.82)',  g: 'rgba(42,205,178,0.28)' },
  aac:  { c: 'rgba(42,205,178,0.82)',  g: 'rgba(42,205,178,0.28)' },
  zip:  { c: 'rgba(155,150,135,0.75)', g: 'rgba(155,150,135,0.24)' },
  rar:  { c: 'rgba(155,150,135,0.75)', g: 'rgba(155,150,135,0.24)' },
  '7z': { c: 'rgba(155,150,135,0.75)', g: 'rgba(155,150,135,0.24)' },
  tar:  { c: 'rgba(155,150,135,0.75)', g: 'rgba(155,150,135,0.24)' },
  exe:  { c: 'rgba(228,168,32,0.88)',  g: 'rgba(228,168,32,0.32)' },
  msi:  { c: 'rgba(228,168,32,0.88)',  g: 'rgba(228,168,32,0.32)' },
  bat:  { c: 'rgba(228,168,32,0.88)',  g: 'rgba(228,168,32,0.32)' },
  lnk:  { c: 'rgba(72,122,208,0.72)',  g: 'rgba(72,122,208,0.22)' },
  url:  { c: 'rgba(72,122,208,0.72)',  g: 'rgba(72,122,208,0.22)' },
  js:   { c: 'rgba(42,218,195,0.82)',  g: 'rgba(42,218,195,0.28)' },
  ts:   { c: 'rgba(42,218,195,0.82)',  g: 'rgba(42,218,195,0.28)' },
  jsx:  { c: 'rgba(42,218,195,0.82)',  g: 'rgba(42,218,195,0.28)' },
  tsx:  { c: 'rgba(42,218,195,0.82)',  g: 'rgba(42,218,195,0.28)' },
  py:   { c: 'rgba(42,218,195,0.82)',  g: 'rgba(42,218,195,0.28)' },
  html: { c: 'rgba(42,218,195,0.82)',  g: 'rgba(42,218,195,0.28)' },
  css:  { c: 'rgba(42,218,195,0.82)',  g: 'rgba(42,218,195,0.28)' },
  json: { c: 'rgba(42,218,195,0.82)',  g: 'rgba(42,218,195,0.28)' },
  cpp:  { c: 'rgba(42,218,195,0.82)',  g: 'rgba(42,218,195,0.28)' },
}
const DEFAULT_TYPE = { c: 'rgba(78,112,185,0.72)', g: 'rgba(78,112,185,0.22)' }

function getType(file) {
  if (file.isDirectory) return TYPES._dir
  const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
  return TYPES[ext] || DEFAULT_TYPE
}

function getLabel(file) {
  if (file.isDirectory) return file.name
  const dot = file.name.lastIndexOf('.')
  return dot > 0 ? file.name.slice(0, dot) : file.name
}

// Derive card chrome colors from the drawer's accent color.
// Multipliers calibrated so #3458A8 reproduces the original values exactly.
function deriveCardColors(hex) {
  const clean = (hex || '#3458A8').replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  const cc = (rv, gv, bv, a) =>
    `rgba(${Math.max(0,Math.min(255,Math.round(rv)))},${Math.max(0,Math.min(255,Math.round(gv)))},${Math.max(0,Math.min(255,Math.round(bv)))},${a})`
  return {
    frameBg:     `linear-gradient(150deg, ${cc(r*.135, g*.114, b*.143, 0.98)} 0%, ${cc(r*.231, g*.205, b*.25, 0.95)} 100%)`,
    border:       cc(r*.615, g*.591, b*.607, 0.65),
    shadowInset:  cc(r*1.538, g*1.364, b*1.190, 0.06),
    bracketIdle:  cc(r*.923, g*.852, b*.821, 0.55),
    labelIdle:    cc(r*1.885, g*1.477, b*1.083, 0.76),
    labelHover:   cc(r*3.558, g*2.386, b*1.476, 0.95),
  }
}

export default function FileItem({ file, drawerSide, accentColor, onRemove }) {
  const [icon, setIcon] = useState(null)
  const [hovered, setHovered] = useState(false)
  const [confirmPending, setConfirmPending] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    window.electron?.getFileIcon(file.path)
      .then(d => { if (mountedRef.current && d) setIcon(d) })
      .catch(() => {})
    return () => { mountedRef.current = false }
  }, [file.path])

  const { c: typeColor, g: typeGlow } = getType(file)
  const card = deriveCardColors(accentColor)
  const label = getLabel(file)
  const bracketStroke = hovered ? typeColor : card.bracketIdle

  return (
    <motion.div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-drawer-file', file.path)
        e.dataTransfer.setData('application/x-drawer-side', drawerSide || '')
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDoubleClick={() => window.electron?.openFile(file.path)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmPending(false) }}
      animate={{ y: hovered ? -4 : 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      whileTap={{ scale: 0.91 }}
      style={{
        width: 76,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 4px 7px',
        gap: 7,
        flexShrink: 0,
        cursor: 'default',
      }}
    >
      {/* ── Icon frame ── */}
      <motion.div
        animate={{
          borderColor: hovered ? typeColor : card.border,
          boxShadow: hovered
            ? `0 0 22px ${typeGlow}, 0 4px 14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(140,180,255,0.10)`
            : `0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 ${card.shadowInset}`,
        }}
        transition={{ duration: 0.2 }}
        style={{
          width: 54,
          height: 54,
          borderRadius: 8,
          background: card.frameBg,
          border: `1px solid ${card.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {/* Remove button */}
        <div
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setConfirmPending(true) }}
          onDoubleClick={(e) => e.stopPropagation()}
          title="Send to Desktop"
          style={{
            position: 'absolute', top: -7, left: -7,
            width: 18, height: 18, borderRadius: '50%',
            background: 'rgba(5,8,20,0.97)',
            border: '1px solid rgba(190,55,55,0.72)',
            boxShadow: hovered ? '0 0 8px rgba(190,55,55,0.38)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 30,
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'scale(1)' : 'scale(0.55)',
            transition: 'opacity 0.15s, transform 0.15s, box-shadow 0.15s',
            pointerEvents: hovered ? 'auto' : 'none',
          }}
        >
          <span style={{ fontSize: 8, color: 'rgba(220,72,72,0.95)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>✕</span>
        </div>

        {/* Confirm-remove overlay */}
        {confirmPending && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 7, zIndex: 40,
            background: 'linear-gradient(150deg, rgba(5,8,20,0.98) 0%, rgba(10,6,18,0.97) 100%)',
            border: '1px solid rgba(190,55,55,0.5)',
            boxShadow: '0 0 16px rgba(190,55,55,0.25)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 7,
          }}>
            <span style={{
              fontSize: 7.5, letterSpacing: '1.8px', textTransform: 'uppercase',
              color: 'rgba(195,140,140,0.85)',
            }}>Desktop?</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <div
                onClick={(e) => { e.stopPropagation(); setConfirmPending(false); onRemove && onRemove() }}
                onDoubleClick={(e) => e.stopPropagation()}
                style={{
                  width: 22, height: 22, borderRadius: 4, cursor: 'pointer',
                  background: 'rgba(38,90,38,0.4)',
                  border: '1px solid rgba(60,185,60,0.65)',
                  boxShadow: '0 0 7px rgba(60,185,60,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: 'rgba(80,220,80,0.95)',
                  transition: 'box-shadow 0.15s',
                }}>✓</div>
              <div
                onClick={(e) => { e.stopPropagation(); setConfirmPending(false) }}
                onDoubleClick={(e) => e.stopPropagation()}
                style={{
                  width: 22, height: 22, borderRadius: 4, cursor: 'pointer',
                  background: 'rgba(90,22,22,0.4)',
                  border: '1px solid rgba(190,55,55,0.65)',
                  boxShadow: '0 0 7px rgba(190,55,55,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: 'rgba(220,72,72,0.95)',
                  transition: 'box-shadow 0.15s',
                }}>✕</div>
            </div>
          </div>
        )}

        {/* Inner ambient top-glow on hover */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 7, pointerEvents: 'none',
          background: hovered
            ? `radial-gradient(ellipse 90% 55% at 50% 0%, ${typeGlow} 0%, transparent 75%)`
            : 'transparent',
          transition: 'background 0.22s',
        }} />

        {/* Corner brackets */}
        <svg
          viewBox="0 0 54 54"
          fill="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <path d="M4 15 L4 4 L15 4"   stroke={bracketStroke} strokeWidth="1.3" strokeLinecap="round" style={{ transition: 'stroke 0.2s' }} />
          <path d="M39 4 L50 4 L50 15" stroke={bracketStroke} strokeWidth="1.3" strokeLinecap="round" style={{ transition: 'stroke 0.2s' }} />
          <path d="M4 39 L4 50 L15 50" stroke={bracketStroke} strokeWidth="1.3" strokeLinecap="round" style={{ transition: 'stroke 0.2s' }} />
          <path d="M39 50 L50 50 L50 39" stroke={bracketStroke} strokeWidth="1.3" strokeLinecap="round" style={{ transition: 'stroke 0.2s' }} />
        </svg>

        {/* File-type dot */}
        <div style={{
          position: 'absolute', top: 6, right: 6,
          width: 5, height: 5, borderRadius: '50%',
          background: typeColor,
          boxShadow: hovered ? `0 0 7px ${typeGlow}, 0 0 3px ${typeColor}` : 'none',
          transition: 'box-shadow 0.2s',
        }} />

        {/* Icon */}
        {icon ? (
          <img
            src={icon}
            alt=""
            draggable={false}
            style={{
              width: 30, height: 30,
              objectFit: 'contain',
              filter: hovered ? `drop-shadow(0 0 5px ${typeGlow})` : 'none',
              transition: 'filter 0.2s',
            }}
          />
        ) : (
          <span style={{
            fontSize: 26, lineHeight: 1,
            color: typeColor,
            filter: `drop-shadow(0 0 6px ${typeGlow})`,
          }}>
            {file.isDirectory ? '◫' : '◧'}
          </span>
        )}
      </motion.div>

      {/* Label */}
      <span style={{
        fontSize: 9.5,
        color: hovered ? card.labelHover : card.labelIdle,
        textAlign: 'center',
        lineHeight: 1.3,
        maxWidth: 68,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        wordBreak: 'break-word',
        letterSpacing: '0.3px',
        transition: 'color 0.15s',
      }}>
        {label}
      </span>
    </motion.div>
  )
}
