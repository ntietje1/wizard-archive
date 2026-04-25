import type { Position } from '@xyflow/react'
import type { CSSProperties } from 'react'
import { cn } from '~/features/shadcn/lib/utils'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'

export type CanvasConnectionHandleDescriptor = {
  id: string
  position: Position
  style?: CSSProperties
}

const HANDLE_POSITIONS: ReadonlyArray<CanvasConnectionHandleDescriptor> = [
  { id: 'top', position: 'top' as Position },
  { id: 'right', position: 'right' as Position },
  { id: 'bottom', position: 'bottom' as Position },
  { id: 'left', position: 'left' as Position },
] as const

const BASE_HANDLE_CLASS =
  "canvas-node-connection-handle relative !z-20 !size-8 !rounded-full !border-0 !bg-transparent opacity-0 scale-75 pointer-events-none transition-[opacity,transform] after:pointer-events-none after:absolute after:left-1/2 after:top-1/2 after:size-3.5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border after:border-border after:bg-background after:content-['']"

const ACTIVE_CONNECTION_HANDLE_CLASS =
  '[&.connectionindicator]:opacity-100 [&.connectionindicator]:scale-100 [&.connectionindicator]:pointer-events-auto'

export function CanvasNodeConnectionHandles({
  handles = HANDLE_POSITIONS,
}: {
  handles?: ReadonlyArray<CanvasConnectionHandleDescriptor>
}) {
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  const edgeToolActive = useCanvasToolStore((state) => state.activeTool === 'edge')
  const handlesVisible = edgeToolActive

  if (!interactiveRenderMode) {
    return null
  }

  return handles.map(({ id, position, style }) => (
    <div
      key={id}
      style={{ ...getDefaultHandleStyle(position), ...style }}
      className={cn(
        BASE_HANDLE_CLASS,
        handlesVisible ? 'duration-150' : 'duration-0',
        edgeToolActive && 'opacity-100 scale-100 pointer-events-auto',
        handlesVisible && ACTIVE_CONNECTION_HANDLE_CLASS,
      )}
      data-testid={`canvas-node-handle-${id}`}
      data-canvas-node-handle="true"
      data-handle-id={id}
      data-handle-position={position}
      data-connection-in-progress={handlesVisible ? 'true' : 'false'}
      data-edge-tool-active={edgeToolActive ? 'true' : 'false'}
    />
  ))
}

function getDefaultHandleStyle(position: Position): CSSProperties {
  switch (String(position)) {
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
