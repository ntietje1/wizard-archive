import type { CSSProperties } from 'react'
import { cn } from '~/features/shadcn/lib/utils'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'

export type CanvasConnectionHandlePosition = 'top' | 'right' | 'bottom' | 'left'

export type CanvasConnectionHandleDescriptor = {
  id: string
  position: CanvasConnectionHandlePosition
  style?: CSSProperties
}

const HANDLE_POSITIONS: ReadonlyArray<CanvasConnectionHandleDescriptor> = [
  { id: 'top', position: 'top' },
  { id: 'right', position: 'right' },
  { id: 'bottom', position: 'bottom' },
  { id: 'left', position: 'left' },
] as const

const BASE_HANDLE_CLASS =
  "canvas-node-connection-handle relative !z-20 !size-8 !rounded-full !border-0 !bg-transparent opacity-0 scale-75 pointer-events-none transition-[opacity,transform] after:pointer-events-none after:absolute after:left-1/2 after:top-1/2 after:size-3.5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border after:border-border after:bg-background after:content-['']"

export function CanvasNodeConnectionHandles({
  handles = HANDLE_POSITIONS,
}: {
  handles?: ReadonlyArray<CanvasConnectionHandleDescriptor>
}) {
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  const edgeToolActive = useCanvasToolStore((state) => state.activeTool === 'edge')

  if (!interactiveRenderMode) {
    return null
  }

  return handles.map(({ id, position, style }) => (
    <div
      key={id}
      style={{ ...getDefaultHandleStyle(position), ...style }}
      className={cn(
        BASE_HANDLE_CLASS,
        edgeToolActive ? 'duration-150' : 'duration-0',
        edgeToolActive && 'opacity-100 scale-100 pointer-events-auto',
      )}
      data-testid={`canvas-node-handle-${id}`}
      data-canvas-node-handle="true"
      data-handle-id={id}
      data-handle-position={position}
      data-handles-visible={edgeToolActive ? 'true' : 'false'}
    />
  ))
}

function getDefaultHandleStyle(position: CanvasConnectionHandlePosition): CSSProperties {
  switch (position) {
    case 'top':
      return { position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%, -50%)' }
    case 'right':
      return { position: 'absolute', right: 0, top: '50%', transform: 'translate(50%, -50%)' }
    case 'bottom':
      return { position: 'absolute', left: '50%', bottom: 0, transform: 'translate(-50%, 50%)' }
    case 'left':
      return { position: 'absolute', left: 0, top: '50%', transform: 'translate(-50%, -50%)' }
    default:
      return {}
  }
}
