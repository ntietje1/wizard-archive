import type { ReactNode } from 'react'
import { CanvasRuntimeContext } from './canvas-runtime'
import type { CanvasRuntime } from './canvas-runtime'

interface CanvasRuntimeProviderProps extends CanvasRuntime {
  children: ReactNode
}

export function CanvasRuntimeProvider({
  canEdit,
  canvasEngine,
  children,
  commands,
  documentWriter,
  domRuntime,
  editSession,
  history,
  nodeActions,
  nodeDragController,
  remoteHighlights,
  selection,
  viewportController,
}: CanvasRuntimeProviderProps) {
  const value = {
    canEdit,
    canvasEngine,
    commands,
    documentWriter,
    domRuntime,
    editSession,
    history,
    nodeActions,
    nodeDragController,
    remoteHighlights,
    selection,
    viewportController,
  }
  return <CanvasRuntimeContext value={value}>{children}</CanvasRuntimeContext>
}
