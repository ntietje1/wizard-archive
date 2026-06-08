import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ResizeHandlePosition } from 'shared/resize/resizeHandleDescriptors'
import { getResizeHandleCursor } from 'shared/resize/resizeHandleDescriptors'

export type NoteEmbedResizeHandle = ResizeHandlePosition

type ResizeSessionOptions = {
  aspectRatio: number | null
  editorElement: HTMLElement | null | undefined
  event: ReactPointerEvent<HTMLElement>
  handle: NoteEmbedResizeHandle
  root: HTMLElement | null
  width: number | undefined
  onCommit: (width: number) => void
}

const MIN_WIDTH = 64
const MIN_BODY_HEIGHT = 144

export function startNoteEmbedResizeSession({
  aspectRatio,
  editorElement,
  event,
  handle,
  root,
  width,
  onCommit,
}: ResizeSessionOptions) {
  event.preventDefault()
  event.stopPropagation()

  if (!root) return

  event.currentTarget.setPointerCapture?.(event.pointerId)

  const captureOverlay = createCaptureOverlay(handle)
  const previousUserSelect = document.body.style.userSelect
  const rootRect = root.getBoundingClientRect()
  const startWidth = positiveNumber(width) ?? positiveNumber(rootRect.width) ?? root.clientWidth
  const measuredHeight = positiveNumber(rootRect.height) ?? positiveNumber(root.clientHeight)
  const activeAspectRatio =
    positiveNumber(aspectRatio) ??
    (measuredHeight ? positiveNumber(startWidth / measuredHeight) : undefined)
  const minWidth = getMinimumWidthForAspectRatio(
    aspectRatio,
    getBodyWidthInset({ root, rootWidth: startWidth }),
  )
  const startHeight = measuredHeight ?? (activeAspectRatio ? startWidth / activeAspectRatio : 0)
  const startX = event.clientX
  const startY = event.clientY

  let latestWidth = startWidth
  let moved = false

  root.appendChild(captureOverlay)
  document.body.style.userSelect = 'none'

  const onPointerMove = (moveEvent: PointerEvent) => {
    moved = true
    latestWidth = clampWidth(
      getNextWidth({
        activeAspectRatio,
        handle,
        pointerX: moveEvent.clientX,
        pointerY: moveEvent.clientY,
        startHeight,
        startWidth,
        startX,
        startY,
      }),
      editorElement,
      minWidth,
    )
    root.style.width = `${latestWidth}px`
  }

  const onPointerUp = () => {
    cleanup()
    if (moved) onCommit(latestWidth)
  }

  const onPointerCancel = () => {
    cleanup()
    root.style.width = width ? `${width}px` : ''
  }

  const cleanup = () => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerCancel)
    captureOverlay.remove()
    document.body.style.userSelect = previousUserSelect
  }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
}

export function getNoteEmbedResizeCursor(handle: NoteEmbedResizeHandle) {
  return getResizeHandleCursor(handle)
}

function clampWidth(
  width: number,
  editorElement: HTMLElement | null | undefined,
  minWidth = MIN_WIDTH,
) {
  const editorWidth = editorElement?.firstElementChild?.clientWidth
  const maxWidth = editorWidth && editorWidth > 0 ? editorWidth : Number.MAX_VALUE
  return Math.round(Math.min(Math.max(width, minWidth), maxWidth))
}

function getMinimumWidthForAspectRatio(aspectRatio: number | null, widthInset: number) {
  const ratio = positiveNumber(aspectRatio)
  if (!ratio) return MIN_WIDTH
  return Math.max(MIN_WIDTH, Math.ceil(ratio * MIN_BODY_HEIGHT + widthInset))
}

function getBodyWidthInset({ root, rootWidth }: { root: HTMLElement; rootWidth: number }) {
  const body = root.querySelector<HTMLElement>('[data-note-embed-body="true"]')
  const bodyWidth = positiveNumber(body?.clientWidth)
  if (!bodyWidth) return 0
  return Math.max(0, rootWidth - bodyWidth)
}

function getNextWidth({
  activeAspectRatio,
  handle,
  pointerX,
  pointerY,
  startHeight,
  startWidth,
  startX,
  startY,
}: {
  activeAspectRatio: number | undefined
  handle: NoteEmbedResizeHandle
  pointerX: number
  pointerY: number
  startHeight: number
  startWidth: number
  startX: number
  startY: number
}) {
  const horizontalWidth = getHorizontalWidth({ handle, pointerX, startWidth, startX })
  const verticalWidth = activeAspectRatio
    ? getVerticalWidth({
        activeAspectRatio,
        handle,
        pointerY,
        startHeight,
        startY,
      })
    : undefined

  if (horizontalWidth === undefined) return verticalWidth ?? startWidth
  if (verticalWidth === undefined) return horizontalWidth

  const horizontalDelta = Math.abs(horizontalWidth - startWidth)
  const verticalDelta = Math.abs(verticalWidth - startWidth)
  return verticalDelta > horizontalDelta ? verticalWidth : horizontalWidth
}

function getHorizontalWidth({
  handle,
  pointerX,
  startWidth,
  startX,
}: {
  handle: NoteEmbedResizeHandle
  pointerX: number
  startWidth: number
  startX: number
}) {
  if (handle.includes('left')) return startWidth + startX - pointerX
  if (handle.includes('right')) return startWidth + pointerX - startX
  return undefined
}

function getVerticalWidth({
  activeAspectRatio,
  handle,
  pointerY,
  startHeight,
  startY,
}: {
  activeAspectRatio: number
  handle: NoteEmbedResizeHandle
  pointerY: number
  startHeight: number
  startY: number
}) {
  if (!handle.includes('top') && !handle.includes('bottom')) return undefined
  const heightDelta = handle.includes('top') ? startY - pointerY : pointerY - startY
  return (startHeight + heightDelta) * activeAspectRatio
}

function positiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function createCaptureOverlay(handle: NoteEmbedResizeHandle) {
  const overlay = document.createElement('div')
  overlay.setAttribute('aria-hidden', 'true')
  overlay.style.position = 'absolute'
  overlay.style.inset = '0'
  overlay.style.cursor = getNoteEmbedResizeCursor(handle)
  overlay.style.touchAction = 'none'
  return overlay
}
