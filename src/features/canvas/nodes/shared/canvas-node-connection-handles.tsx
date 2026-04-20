import { Handle, useConnection } from '@xyflow/react'
import type { Position } from '@xyflow/react'
import { cn } from '~/features/shadcn/lib/utils'

const HANDLE_POSITIONS = [
  { id: 'top', position: 'top' as Position },
  { id: 'right', position: 'right' as Position },
  { id: 'bottom', position: 'bottom' as Position },
  { id: 'left', position: 'left' as Position },
] as const
const CONNECTION_HANDLE_OUTSET_PX = 1
const HANDLE_POSITION_STYLES = {
  top: { top: -CONNECTION_HANDLE_OUTSET_PX },
  right: { right: -CONNECTION_HANDLE_OUTSET_PX },
  bottom: { bottom: -CONNECTION_HANDLE_OUTSET_PX },
  left: { left: -CONNECTION_HANDLE_OUTSET_PX },
} as const

interface CanvasNodeConnectionHandlesProps {
  selected: boolean
}

const BASE_HANDLE_CLASS =
  '!z-20 !bg-primary border-background shadow-sm opacity-0 scale-75 pointer-events-none transition-[opacity,transform] duration-150'

const ACTIVE_CONNECTION_HANDLE_CLASS =
  '[&.connectionindicator]:opacity-100 [&.connectionindicator]:scale-100 [&.connectionindicator]:pointer-events-auto'

export function CanvasNodeConnectionHandles({ selected }: CanvasNodeConnectionHandlesProps) {
  const connectionInProgress = useConnection((connection) => connection.inProgress)

  return HANDLE_POSITIONS.map(({ id, position }) => (
    <Handle
      key={id}
      id={id}
      type="source"
      position={position}
      style={HANDLE_POSITION_STYLES[position]}
      isConnectableStart
      isConnectableEnd
      className={cn(
        BASE_HANDLE_CLASS,
        selected && 'opacity-100 scale-100 pointer-events-auto',
        connectionInProgress && ACTIVE_CONNECTION_HANDLE_CLASS,
      )}
      data-testid={`canvas-node-handle-${id}`}
      data-selected={selected ? 'true' : 'false'}
      data-connection-in-progress={connectionInProgress ? 'true' : 'false'}
    />
  ))
}
