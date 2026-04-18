import { createContext, useContext } from 'react'
import type { RemoteHighlight } from '../utils/canvas-awareness-types'

type Position = { x: number; y: number }
type ResizeHandler = (nodeId: string, width: number, height: number, position: Position) => void

export interface CanvasNodeActionsContextValue {
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void
  onResize: ResizeHandler
  onResizeEnd: ResizeHandler
}

export interface CanvasEditSessionContextValue {
  editingEmbedId: string | null
  setEditingEmbedId: (id: string | null) => void
  pendingEditNodeId: string | null
  setPendingEditNodeId: (id: string | null) => void
}

export interface CanvasViewStateContextValue {
  remoteHighlights: Map<string, RemoteHighlight>
  canEdit: boolean
  user: RemoteHighlight
}

const CanvasNodeActionsContext = createContext<CanvasNodeActionsContextValue | null>(null)
const CanvasEditSessionContext = createContext<CanvasEditSessionContextValue | null>(null)
const CanvasViewStateContext = createContext<CanvasViewStateContextValue | null>(null)

interface CanvasProvidersProps {
  nodeActions: CanvasNodeActionsContextValue
  editSession: CanvasEditSessionContextValue
  viewState: CanvasViewStateContextValue
  children: React.ReactNode
}

export function CanvasProviders({
  nodeActions,
  editSession,
  viewState,
  children,
}: CanvasProvidersProps) {
  return (
    <CanvasNodeActionsContext value={nodeActions}>
      <CanvasEditSessionContext value={editSession}>
        <CanvasViewStateContext value={viewState}>{children}</CanvasViewStateContext>
      </CanvasEditSessionContext>
    </CanvasNodeActionsContext>
  )
}

function useRequiredCanvasContext<T>(value: T | null, name: string): T {
  if (!value) {
    throw new Error(`${name} must be used within CanvasProviders`)
  }
  return value
}

export function useCanvasNodeActions() {
  return useRequiredCanvasContext(useContext(CanvasNodeActionsContext), 'useCanvasNodeActions')
}

export function useCanvasEditSession() {
  return useRequiredCanvasContext(useContext(CanvasEditSessionContext), 'useCanvasEditSession')
}

export function useCanvasViewState() {
  return useRequiredCanvasContext(useContext(CanvasViewStateContext), 'useCanvasViewState')
}
