import type { CSSProperties } from 'react'

export type ResizeHandle =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'

export const RESIZE_HANDLES: ReadonlyArray<ResizeHandle> = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
]

export function resizeHandleCursor(handle: ResizeHandle): CSSProperties['cursor'] {
  if (handle === 'top' || handle === 'bottom') return 'ns-resize'
  if (handle === 'left' || handle === 'right') return 'ew-resize'
  if (handle === 'top-left' || handle === 'bottom-right') return 'nwse-resize'
  return 'nesw-resize'
}

export function resizeHandleZoneStyle(handle: ResizeHandle, hitSize: number): CSSProperties {
  const halfSize = hitSize / 2
  switch (handle) {
    case 'top-left':
      return { height: hitSize, left: -halfSize, top: -halfSize, width: hitSize }
    case 'top':
      return { height: hitSize, left: halfSize, right: halfSize, top: -halfSize }
    case 'top-right':
      return { height: hitSize, right: -halfSize, top: -halfSize, width: hitSize }
    case 'right':
      return { bottom: halfSize, right: -halfSize, top: halfSize, width: hitSize }
    case 'bottom-right':
      return { bottom: -halfSize, height: hitSize, right: -halfSize, width: hitSize }
    case 'bottom':
      return { bottom: -halfSize, height: hitSize, left: halfSize, right: halfSize }
    case 'bottom-left':
      return { bottom: -halfSize, height: hitSize, left: -halfSize, width: hitSize }
    case 'left':
      return { bottom: halfSize, left: -halfSize, top: halfSize, width: hitSize }
  }
}
