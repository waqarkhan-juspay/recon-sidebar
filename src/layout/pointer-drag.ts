import type { PointerEvent as ReactPointerEvent } from 'react'

/**
 * Drag-to-reorder on plain pointer events, for the sidebar's items and a page's tabs.
 *
 * Not HTML5 drag and drop: some browsers never deliver its `dragover` and `drop` events — the
 * Claude desktop app's browser pane fires `dragstart` and then only `dragend`, so a drop never
 * lands. Pointer events arrive everywhere.
 *
 * Nothing happens until the pointer has moved a few pixels, so a click is still a click. Then a
 * small label follows the pointer, `onMove` reports where it is, and letting go calls
 * `onDrop`; Escape abandons the drag. The click a browser sends after the release is
 * swallowed, so dropping onto a link does not also follow it.
 */
const THRESHOLD = 4

export function startPointerDrag(
  event: ReactPointerEvent,
  handlers: {
    /** Shown beside the pointer while dragging. */
    label: string
    onStart: () => void
    onMove: (x: number, y: number) => void
    onDrop: () => void
    /** After a drop or a cancel, to clear any drag state. */
    onEnd: () => void
  },
) {
  // Mouse and pen only: on touch, a drag from a row would fight the page's own scrolling.
  if (event.button !== 0 || event.pointerType === 'touch') return
  const startX = event.clientX
  const startY = event.clientY
  let active = false
  let ghost: HTMLDivElement | null = null

  const move = (e: PointerEvent) => {
    if (!active) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < THRESHOLD) return
      active = true
      document.body.classList.add('is-pointer-dragging')
      ghost = document.createElement('div')
      ghost.className = 'pointer-drag-ghost'
      ghost.textContent = handlers.label
      document.body.appendChild(ghost)
      handlers.onStart()
    }
    e.preventDefault()
    ghost!.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 10}px)`
    handlers.onMove(e.clientX, e.clientY)
  }

  const finish = (drop: boolean) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancel)
    window.removeEventListener('keydown', key)
    if (!active) return
    ghost?.remove()
    document.body.classList.remove('is-pointer-dragging')
    if (drop) handlers.onDrop()
    handlers.onEnd()
    // The release is followed by a click on whatever is under the pointer; it is not one.
    const swallow = (c: MouseEvent) => {
      c.preventDefault()
      c.stopPropagation()
    }
    window.addEventListener('click', swallow, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', swallow, true), 0)
  }
  const up = () => finish(true)
  const cancel = () => finish(false)
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') finish(false)
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', cancel)
  window.addEventListener('keydown', key)
}
