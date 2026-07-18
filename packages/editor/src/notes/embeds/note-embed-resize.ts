import type { PointerEvent as ReactPointerEvent } from 'react'
import { resizeHandleCursor } from '../../interaction/resize-handle'
import type { ResizeHandle } from '../../interaction/resize-handle'

const MIN_WIDTH = 64
const MIN_HEIGHT = 144
const KEYBOARD_STEP = 16

type NoteEmbedSize = Readonly<{ width: number; height: number }>

export function startNoteEmbedResize({
  editorElement,
  event,
  handle,
  onCommit,
  root,
}: {
  editorElement: HTMLElement | null
  event: ReactPointerEvent<HTMLElement>
  handle: ResizeHandle
  onCommit: (size: NoteEmbedSize) => void
  root: HTMLElement | null
}) {
  if (!root) return
  event.preventDefault()
  event.stopPropagation()
  event.currentTarget.setPointerCapture?.(event.pointerId)

  const body = root.querySelector<HTMLElement>('[data-note-embed-body="true"]')
  if (!body) return
  const rootBounds = root.getBoundingClientRect()
  const bodyBounds = body.getBoundingClientRect()
  const start = {
    width: positive(rootBounds.width) ?? positive(root.clientWidth) ?? MIN_WIDTH,
    height: positive(bodyBounds.height) ?? positive(body.clientHeight) ?? MIN_HEIGHT,
  }
  const startPoint = { x: event.clientX, y: event.clientY }
  const ownerDocument = root.ownerDocument
  const ownerWindow = ownerDocument.defaultView
  if (!ownerWindow) return
  const previousUserSelect = ownerDocument.body.style.userSelect
  const overlay = ownerDocument.createElement('div')
  overlay.setAttribute('aria-hidden', 'true')
  Object.assign(overlay.style, {
    cursor: resizeHandleCursor(handle),
    inset: '0',
    position: 'fixed',
    touchAction: 'none',
    zIndex: '2147483647',
  })
  ownerDocument.body.appendChild(overlay)
  ownerDocument.body.style.userSelect = 'none'

  let latest = start
  let moved = false
  const cleanup = () => {
    ownerWindow.removeEventListener('pointermove', move)
    ownerWindow.removeEventListener('pointerup', finish)
    ownerWindow.removeEventListener('pointercancel', cancel)
    overlay.remove()
    ownerDocument.body.style.userSelect = previousUserSelect
  }
  const move = (moveEvent: PointerEvent) => {
    moved = true
    latest = resizeNoteEmbed({
      editorWidth: editorElement?.firstElementChild?.clientWidth,
      handle,
      start,
      x: moveEvent.clientX - startPoint.x,
      y: moveEvent.clientY - startPoint.y,
    })
    root.style.width = `${latest.width}px`
    body.style.height = `${latest.height}px`
  }
  const finish = () => {
    cleanup()
    if (moved) onCommit(latest)
  }
  const cancel = () => {
    cleanup()
    root.style.width = `${start.width}px`
    body.style.height = `${start.height}px`
  }
  ownerWindow.addEventListener('pointermove', move)
  ownerWindow.addEventListener('pointerup', finish)
  ownerWindow.addEventListener('pointercancel', cancel)
}

export function keyboardResizeNoteEmbed({
  editorWidth,
  handle,
  height,
  key,
  width,
}: {
  editorWidth?: number
  handle: ResizeHandle
  height: number
  key: string
  width: number
}): NoteEmbedSize | null {
  const horizontal = key === 'ArrowLeft' ? -KEYBOARD_STEP : key === 'ArrowRight' ? KEYBOARD_STEP : 0
  const vertical = key === 'ArrowUp' ? -KEYBOARD_STEP : key === 'ArrowDown' ? KEYBOARD_STEP : 0
  if (
    (horizontal === 0 && vertical === 0) ||
    (horizontal !== 0 && !handle.includes('left') && !handle.includes('right')) ||
    (vertical !== 0 && !handle.includes('top') && !handle.includes('bottom'))
  ) {
    return null
  }
  return resizeNoteEmbed({
    editorWidth,
    handle,
    start: { height, width },
    x: horizontal,
    y: vertical,
  })
}

function resizeNoteEmbed({
  editorWidth,
  handle,
  start,
  x,
  y,
}: {
  editorWidth?: number
  handle: ResizeHandle
  start: NoteEmbedSize
  x: number
  y: number
}): NoteEmbedSize {
  const widthDelta = handle.includes('left') ? -x : handle.includes('right') ? x : 0
  const heightDelta = handle.includes('top') ? -y : handle.includes('bottom') ? y : 0
  const maximumWidth = positive(editorWidth) ?? Number.MAX_VALUE
  return {
    width: Math.round(Math.min(Math.max(start.width + widthDelta, MIN_WIDTH), maximumWidth)),
    height: Math.round(Math.max(start.height + heightDelta, MIN_HEIGHT)),
  }
}

export function noteEmbedResizeLabel(handle: ResizeHandle): string {
  return `Resize embedded resource ${handle.replace('-', ' ')}`
}

function positive(value: number | undefined): number | null {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : null
}
