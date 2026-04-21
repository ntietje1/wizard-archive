import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'

export interface CanvasNodeResizeHandleDescriptor {
  cursorClassName: string
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  style: CSSProperties
}

const HANDLE_SIZE = 4
const HANDLE_HIT_SIZE = 16

export function CanvasNodeResizeHandles({
  handles,
}: {
  handles: ReadonlyArray<CanvasNodeResizeHandleDescriptor>
}) {
  return handles.map(({ position, cursorClassName, onPointerDown, style }) => (
    <button
      key={position}
      type="button"
      aria-label={`Resize ${position} handle`}
      data-testid={`canvas-node-resize-handle-${position}`}
      data-resize-handle-position={position}
      className={`canvas-node-resize-handle nodrag nopan absolute border-none bg-transparent p-0 touch-none z-[2] ${cursorClassName}`}
      style={{
        width: HANDLE_HIT_SIZE,
        height: HANDLE_HIT_SIZE,
        ...style,
      }}
      onPointerDown={onPointerDown}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute rounded-[1px] border border-primary bg-background"
        style={{
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          top: (HANDLE_HIT_SIZE - HANDLE_SIZE) / 2,
          left: (HANDLE_HIT_SIZE - HANDLE_SIZE) / 2,
        }}
      />
    </button>
  ))
}
