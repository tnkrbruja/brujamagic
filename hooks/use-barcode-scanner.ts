'use client'

import { useEffect, useEffectEvent, useRef } from 'react'

// USB/Bluetooth scanners in keyboard (HID) mode "type" a whole code in a few
// milliseconds and finish with Enter or Tab. Humans can't sustain that speed,
// so a fast burst of keys followed by a terminator is treated as a scan.
const MAX_KEY_GAP_MS = 50
const MAX_TERMINATOR_GAP_MS = 120
const MIN_CODE_LENGTH = 6

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    el.isContentEditable
  )
}

type Options = {
  onScan: (code: string) => void
  /** Editable element that is allowed to receive scans (e.g. the identifier input). */
  scanTarget: React.RefObject<HTMLElement | null>
}

export function useBarcodeScanner({ onScan, scanTarget }: Options) {
  const buffer = useRef('')
  const lastKeyAt = useRef(0)

  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return

    const target = e.target
    const inScanTarget = target === scanTarget.current
    // Never hijack typing in other fields (name, notes, quantity, ...).
    if (isEditable(target) && !inScanTarget) {
      buffer.current = ''
      return
    }

    const now = performance.now()
    const gap = now - lastKeyAt.current
    lastKeyAt.current = now

    if (e.key === 'Enter' || e.key === 'Tab') {
      const code = buffer.current.trim()
      buffer.current = ''
      if (code.length >= MIN_CODE_LENGTH && gap <= MAX_TERMINATOR_GAP_MS) {
        e.preventDefault()
        e.stopPropagation()
        onScan(code)
      }
      return
    }

    if (e.key.length !== 1) return

    buffer.current = gap > MAX_KEY_GAP_MS ? e.key : buffer.current + e.key
    // With nothing focused the keys have nowhere to go; stop Space from scrolling etc.
    if (!inScanTarget) e.preventDefault()
  })

  useEffect(() => {
    const listener = (e: KeyboardEvent) => handleKeyDown(e)
    // Capture phase so a scan's Enter never reaches the order form's submit.
    window.addEventListener('keydown', listener, true)
    return () => window.removeEventListener('keydown', listener, true)
  }, [])
}
