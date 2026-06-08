export type ResizeHandlePosition =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'

export const RESIZE_HANDLE_DESCRIPTORS: ReadonlyArray<{
  position: ResizeHandlePosition
  cursorClassName: string
}> = [
  {
    position: 'top-left',
    cursorClassName: 'cursor-nwse-resize',
  },
  {
    position: 'top',
    cursorClassName: 'cursor-ns-resize',
  },
  {
    position: 'top-right',
    cursorClassName: 'cursor-nesw-resize',
  },
  {
    position: 'right',
    cursorClassName: 'cursor-ew-resize',
  },
  {
    position: 'bottom-right',
    cursorClassName: 'cursor-nwse-resize',
  },
  {
    position: 'bottom',
    cursorClassName: 'cursor-ns-resize',
  },
  {
    position: 'bottom-left',
    cursorClassName: 'cursor-nesw-resize',
  },
  {
    position: 'left',
    cursorClassName: 'cursor-ew-resize',
  },
]

export function getResizeHandleCursor(position: ResizeHandlePosition) {
  const descriptor = RESIZE_HANDLE_DESCRIPTORS.find((handle) => handle.position === position)
  return descriptor?.cursorClassName.replace('cursor-', '') ?? 'default'
}

export function getResizeHandleLabel(position: ResizeHandlePosition) {
  const cornerPositions = new Set<ResizeHandlePosition>([
    'top-left',
    'top-right',
    'bottom-right',
    'bottom-left',
  ])
  const handleKind = cornerPositions.has(position) ? 'corner' : 'edge'
  return `Resize ${position} selection ${handleKind}`
}
