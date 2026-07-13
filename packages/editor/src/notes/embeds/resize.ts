import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ResizeHandlePosition } from '../../../../../shared/resize/resizeHandleDescriptors'
import { getResizeHandleCursor } from '../../../../../shared/resize/resizeHandleDescriptors'
import { getPositiveFiniteNumber } from './numbers'

type ResizeSessionOptions = {
  aspectRatio: number | null
  editorElement: HTMLElement | null | undefined
  event: ReactPointerEvent<HTMLElement>
  handle: ResizeHandlePosition
  height: number | undefined
  maxHeightAspectRatio: number | null
  resizeHeight: boolean
  root: HTMLElement | null
  useMeasuredAspectRatioFallback: boolean
  width: number | undefined
  onCommit: (size: { height?: number; width: number }) => void
}

const MIN_WIDTH = 64
const MIN_BODY_HEIGHT = 144

export function startNoteEmbedResizeSession({
  aspectRatio,
  editorElement,
  event,
  handle,
  height,
  maxHeightAspectRatio,
  resizeHeight,
  root,
  useMeasuredAspectRatioFallback,
  width,
  onCommit,
}: ResizeSessionOptions) {
  event.preventDefault()
  event.stopPropagation()

  if (!root) return

  event.currentTarget.setPointerCapture?.(event.pointerId)

  const ownerDocument = root.ownerDocument
  const ownerWindow = ownerDocument.defaultView
  if (!ownerWindow) return

  const captureOverlay = createCaptureOverlay(ownerDocument, handle)
  const previousUserSelect = ownerDocument.body.style.userSelect
  const rootRect = root.getBoundingClientRect()
  const body = getBodyElement(root)
  const bodyRect = body?.getBoundingClientRect()
  const startWidth =
    getPositiveFiniteNumber(width) ?? getPositiveFiniteNumber(rootRect.width) ?? root.clientWidth
  const startHeight =
    getPositiveFiniteNumber(height) ??
    getPositiveFiniteNumber(bodyRect?.height) ??
    getPositiveFiniteNumber(rootRect.height) ??
    getPositiveFiniteNumber(root.clientHeight) ??
    MIN_BODY_HEIGHT
  const activeAspectRatio =
    getPositiveFiniteNumber(aspectRatio) ??
    (useMeasuredAspectRatioFallback ? getAspectRatio(startWidth, startHeight) : undefined)
  const minWidth = getMinimumWidthForAspectRatio(
    activeAspectRatio ?? null,
    getBodyWidthInset({ root, rootWidth: startWidth }),
  )
  const startX = event.clientX
  const startY = event.clientY

  let latestWidth = startWidth
  let latestHeight = startHeight
  let moved = false

  root.appendChild(captureOverlay)
  ownerDocument.body.style.userSelect = 'none'

  const onPointerMove = (moveEvent: PointerEvent) => {
    moved = true
    const nextSize = getNextSize({
      activeAspectRatio,
      handle,
      pointerX: moveEvent.clientX,
      pointerY: moveEvent.clientY,
      resizeHeight,
      startHeight,
      startWidth,
      startX,
      startY,
    })
    latestWidth = clampWidth(nextSize.width, editorElement, minWidth)
    latestHeight = clampHeight(nextSize.height, getMaxHeight(latestWidth, maxHeightAspectRatio))
    root.style.width = `${latestWidth}px`
    if (!activeAspectRatio && resizeHeight && body) {
      body.style.height = `${latestHeight}px`
    }
  }

  const onPointerUp = () => {
    cleanup()
    if (!moved) return
    onCommit(
      activeAspectRatio || !resizeHeight
        ? { width: latestWidth }
        : { width: latestWidth, height: latestHeight },
    )
  }

  const onPointerCancel = () => {
    cleanup()
    root.style.width = width ? `${width}px` : ''
    if (body) body.style.height = height ? `${height}px` : ''
  }

  const cleanup = () => {
    ownerWindow.removeEventListener('pointermove', onPointerMove)
    ownerWindow.removeEventListener('pointerup', onPointerUp)
    ownerWindow.removeEventListener('pointercancel', onPointerCancel)
    captureOverlay.remove()
    ownerDocument.body.style.userSelect = previousUserSelect
  }

  ownerWindow.addEventListener('pointermove', onPointerMove)
  ownerWindow.addEventListener('pointerup', onPointerUp)
  ownerWindow.addEventListener('pointercancel', onPointerCancel)
}

export function getNoteEmbedResizeCursor(handle: ResizeHandlePosition) {
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

function clampHeight(height: number, maxHeight: number | undefined) {
  const clampedHeight = Math.max(height, MIN_BODY_HEIGHT)
  const effectiveMaxHeight =
    maxHeight === undefined ? undefined : Math.max(maxHeight, MIN_BODY_HEIGHT)
  return Math.round(
    effectiveMaxHeight === undefined ? clampedHeight : Math.min(clampedHeight, effectiveMaxHeight),
  )
}

function getMinimumWidthForAspectRatio(aspectRatio: number | null, widthInset: number) {
  const ratio = getPositiveFiniteNumber(aspectRatio)
  if (!ratio) return MIN_WIDTH
  return Math.max(MIN_WIDTH, Math.ceil(ratio * MIN_BODY_HEIGHT + widthInset))
}

function getBodyWidthInset({ root, rootWidth }: { root: HTMLElement; rootWidth: number }) {
  const body = getBodyElement(root)
  const bodyWidth = getPositiveFiniteNumber(body?.clientWidth)
  if (!bodyWidth) return 0
  return Math.max(0, rootWidth - bodyWidth)
}

function getNextSize({
  activeAspectRatio,
  handle,
  pointerX,
  pointerY,
  resizeHeight,
  startHeight,
  startWidth,
  startX,
  startY,
}: {
  activeAspectRatio: number | undefined
  handle: ResizeHandlePosition
  pointerX: number
  pointerY: number
  resizeHeight: boolean
  startHeight: number
  startWidth: number
  startX: number
  startY: number
}) {
  if (!activeAspectRatio) {
    return {
      width: getHorizontalWidth({ handle, pointerX, startWidth, startX }) ?? startWidth,
      height: resizeHeight
        ? (getVerticalHeight({ handle, pointerY, startHeight, startY }) ?? startHeight)
        : startHeight,
    }
  }

  const horizontalWidth = getHorizontalWidth({ handle, pointerX, startWidth, startX })
  const verticalWidth = getVerticalWidth({
    activeAspectRatio,
    handle,
    pointerY,
    startHeight,
    startY,
  })

  if (horizontalWidth === undefined) {
    const width = verticalWidth ?? startWidth
    return { width, height: width / activeAspectRatio }
  }
  if (verticalWidth === undefined) {
    return { width: horizontalWidth, height: horizontalWidth / activeAspectRatio }
  }

  const horizontalDelta = Math.abs(horizontalWidth - startWidth)
  const verticalDelta = Math.abs(verticalWidth - startWidth)
  const width = verticalDelta > horizontalDelta ? verticalWidth : horizontalWidth
  return { width, height: width / activeAspectRatio }
}

function getHorizontalWidth({
  handle,
  pointerX,
  startWidth,
  startX,
}: {
  handle: ResizeHandlePosition
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
  handle: ResizeHandlePosition
  pointerY: number
  startHeight: number
  startY: number
}) {
  if (!handle.includes('top') && !handle.includes('bottom')) return undefined
  const heightDelta = handle.includes('top') ? startY - pointerY : pointerY - startY
  return (startHeight + heightDelta) * activeAspectRatio
}

function getVerticalHeight({
  handle,
  pointerY,
  startHeight,
  startY,
}: {
  handle: ResizeHandlePosition
  pointerY: number
  startHeight: number
  startY: number
}) {
  if (!handle.includes('top') && !handle.includes('bottom')) return undefined
  return startHeight + (handle.includes('top') ? startY - pointerY : pointerY - startY)
}

function getAspectRatio(width: number, height: number) {
  return height > 0 ? width / height : undefined
}

function getMaxHeight(width: number, aspectRatio: number | null) {
  const ratio = getPositiveFiniteNumber(aspectRatio)
  return ratio ? width / ratio : undefined
}

function createCaptureOverlay(ownerDocument: Document, handle: ResizeHandlePosition) {
  const overlay = ownerDocument.createElement('div')
  overlay.setAttribute('aria-hidden', 'true')
  overlay.style.position = 'absolute'
  overlay.style.inset = '0'
  overlay.style.cursor = getNoteEmbedResizeCursor(handle)
  overlay.style.touchAction = 'none'
  return overlay
}

function getBodyElement(root: HTMLElement) {
  return root.querySelector<HTMLElement>('[data-note-embed-body="true"]')
}
