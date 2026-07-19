import type { PointerEvent as ReactPointerEvent } from 'react'
import { resizeHandleCursor } from '../../interaction/resize-handle'
import type { ResizeHandle } from '../../interaction/resize-handle'

const MIN_WIDTH = 64
const MIN_HEIGHT = 144
const KEYBOARD_STEP = 16

type NoteEmbedSize = Readonly<{ width: number; height: number }>

export type NoteEmbedResizeGesture = Readonly<{ cancel: () => void }>

export function startNoteEmbedResize({
  aspectRatio,
  editorElement,
  event,
  handle,
  onCommit,
  root,
}: {
  aspectRatio?: number | null
  editorElement: HTMLElement | null
  event: ReactPointerEvent<HTMLElement>
  handle: ResizeHandle
  onCommit: (size: NoteEmbedSize) => void
  root: HTMLElement | null
}): NoteEmbedResizeGesture | null {
  if (!root) return null
  const body = root.querySelector<HTMLElement>('[data-note-embed-body="true"]')
  if (!body) return null
  const ownerDocument = root.ownerDocument
  const ownerWindow = ownerDocument.defaultView
  if (!ownerWindow) return null
  event.preventDefault()
  event.stopPropagation()
  const handleElement = event.currentTarget
  handleElement.setPointerCapture?.(event.pointerId)

  const rootBounds = root.getBoundingClientRect()
  const bodyBounds = body.getBoundingClientRect()
  const start = {
    width: positive(rootBounds.width) ?? positive(root.clientWidth) ?? MIN_WIDTH,
    height: positive(bodyBounds.height) ?? positive(body.clientHeight) ?? MIN_HEIGHT,
  }
  const startPoint = { x: event.clientX, y: event.clientY }
  const previousUserSelect = ownerDocument.body.style.userSelect
  const previousRootWidth = root.style.width
  const previousBodyHeight = body.style.height
  const overlay = ownerDocument.createElement('div')
  overlay.setAttribute('aria-hidden', 'true')
  overlay.dataset.noteEmbedResizeOverlay = 'true'
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
  let active = true
  const settle = (commit: boolean) => {
    if (!active) return
    active = false
    ownerWindow.removeEventListener('pointermove', move)
    ownerWindow.removeEventListener('pointerup', finish)
    ownerWindow.removeEventListener('pointercancel', cancelPointer)
    ownerWindow.removeEventListener('blur', cancel)
    handleElement.removeEventListener('lostpointercapture', cancel)
    if (handleElement.hasPointerCapture?.(event.pointerId)) {
      handleElement.releasePointerCapture(event.pointerId)
    }
    overlay.remove()
    ownerDocument.body.style.userSelect = previousUserSelect
    if (commit) {
      if (moved) onCommit(latest)
      return
    }
    root.style.width = previousRootWidth
    body.style.height = previousBodyHeight
  }
  const move = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== event.pointerId) return
    moved = true
    latest = resizeNoteEmbed({
      aspectRatio,
      editorWidth: editorElement?.firstElementChild?.clientWidth,
      handle,
      start,
      x: moveEvent.clientX - startPoint.x,
      y: moveEvent.clientY - startPoint.y,
    })
    root.style.width = `${latest.width}px`
    body.style.height = `${latest.height}px`
  }
  const finish = (finishEvent: PointerEvent) => {
    if (finishEvent.pointerId !== event.pointerId) return
    settle(true)
  }
  const cancel = () => {
    settle(false)
  }
  const cancelPointer = (cancelEvent: PointerEvent) => {
    if (cancelEvent.pointerId !== event.pointerId) return
    cancel()
  }
  ownerWindow.addEventListener('pointermove', move)
  ownerWindow.addEventListener('pointerup', finish)
  ownerWindow.addEventListener('pointercancel', cancelPointer)
  ownerWindow.addEventListener('blur', cancel)
  handleElement.addEventListener('lostpointercapture', cancel)
  return { cancel }
}

export function keyboardResizeNoteEmbed({
  aspectRatio,
  editorWidth,
  handle,
  height,
  key,
  width,
}: {
  aspectRatio?: number | null
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
    aspectRatio,
    editorWidth,
    handle,
    start: { height, width },
    x: horizontal,
    y: vertical,
  })
}

function resizeNoteEmbed({
  aspectRatio,
  editorWidth,
  handle,
  start,
  x,
  y,
}: {
  aspectRatio?: number | null
  editorWidth?: number
  handle: ResizeHandle
  start: NoteEmbedSize
  x: number
  y: number
}): NoteEmbedSize {
  const widthDelta = handle.includes('left') ? -x : handle.includes('right') ? x : 0
  const heightDelta = handle.includes('top') ? -y : handle.includes('bottom') ? y : 0
  const maximumWidth = positive(editorWidth) ?? Number.MAX_VALUE
  const activeAspectRatio = positive(aspectRatio ?? undefined)
  if (activeAspectRatio)
    return resizeProportionalNoteEmbed({
      aspectRatio: activeAspectRatio,
      heightDelta,
      maximumWidth,
      start,
      widthDelta,
    })
  return {
    width: Math.round(Math.min(Math.max(start.width + widthDelta, MIN_WIDTH), maximumWidth)),
    height: Math.round(Math.max(start.height + heightDelta, MIN_HEIGHT)),
  }
}

function resizeProportionalNoteEmbed({
  aspectRatio,
  heightDelta,
  maximumWidth,
  start,
  widthDelta,
}: {
  aspectRatio: number
  heightDelta: number
  maximumWidth: number
  start: NoteEmbedSize
  widthDelta: number
}): NoteEmbedSize {
  const horizontalWidth = widthDelta === 0 ? null : Math.max(start.width + widthDelta, MIN_WIDTH)
  const verticalWidth =
    heightDelta === 0 ? null : Math.max(start.height + heightDelta, MIN_HEIGHT) * aspectRatio
  const proposedWidth = resizeDriverWidth(start.width, horizontalWidth, verticalWidth)
  const minimumWidth = Math.max(MIN_WIDTH, MIN_HEIGHT * aspectRatio)
  const width = Math.round(Math.min(Math.max(proposedWidth, minimumWidth), maximumWidth))
  return { width, height: Math.round(width / aspectRatio) }
}

function resizeDriverWidth(
  initialWidth: number,
  horizontalWidth: number | null,
  verticalWidth: number | null,
): number {
  if (horizontalWidth === null) return verticalWidth ?? initialWidth
  if (verticalWidth === null) return horizontalWidth
  return Math.abs(horizontalWidth - initialWidth) >= Math.abs(verticalWidth - initialWidth)
    ? horizontalWidth
    : verticalWidth
}

export function noteEmbedResizeLabel(handle: ResizeHandle): string {
  return `Resize embedded resource ${handle.replace('-', ' ')}`
}

function positive(value: number | undefined): number | null {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : null
}
