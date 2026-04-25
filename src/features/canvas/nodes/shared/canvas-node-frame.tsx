import { useEffect, useRef } from 'react'
import { useCanvasRuntime } from '../../runtime/providers/canvas-runtime'
import { useCanvasNodeVisualSelection } from './use-canvas-node-visual-selection'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'

interface CanvasNodeFrameProps {
  id: string
  nodeType: string
  dragging: boolean
  editing?: boolean
  chrome?: React.ReactNode
  children: React.ReactNode
}

export function CanvasNodeFrame({
  id,
  nodeType,
  dragging,
  editing = false,
  chrome,
  children,
}: CanvasNodeFrameProps) {
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  const { canEdit, canvasEngine, nodeDragController, remoteHighlights } = useCanvasRuntime()
  const frameRef = useRef<HTMLDivElement | null>(null)
  const { visuallySelected, pendingPreviewActive, pendingSelected, selected } =
    useCanvasNodeVisualSelection(id)
  const highlight = interactiveRenderMode ? remoteHighlights.get(id) : undefined

  useEffect(() => {
    const frame = frameRef.current
    const shell = frame?.closest('.canvas-node-shell')
    return canvasEngine.registerNodeElement(id, shell instanceof HTMLElement ? shell : frame)
  }, [canvasEngine, id])

  useEffect(() => {
    const frame = frameRef.current
    const shell = frame?.closest('.canvas-node-shell')
    const dragTarget = shell instanceof HTMLElement ? shell : frame
    if (!dragTarget || !canEdit || !interactiveRenderMode || editing || !nodeDragController) {
      return undefined
    }

    const handlePointerDown = (event: PointerEvent) => {
      nodeDragController.handlePointerDown(id, event)
    }
    const handleMouseDown = (event: MouseEvent) => {
      nodeDragController.handlePointerDown(id, event)
    }
    dragTarget.addEventListener('pointerdown', handlePointerDown, { capture: true })
    if (!window.PointerEvent) {
      dragTarget.addEventListener('mousedown', handleMouseDown, { capture: true })
    }
    return () => {
      dragTarget.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      dragTarget.removeEventListener('mousedown', handleMouseDown, { capture: true })
    }
  }, [canEdit, editing, id, interactiveRenderMode, nodeDragController])

  return (
    <div
      ref={frameRef}
      className="relative h-full w-full select-none"
      data-testid="canvas-node"
      data-node-id={id}
      data-node-type={nodeType}
      data-node-selected={selected ? 'true' : 'false'}
      data-node-visual-selected={visuallySelected ? 'true' : 'false'}
      data-node-pending-preview-active={pendingPreviewActive ? 'true' : 'false'}
      data-node-pending-selected={pendingSelected ? 'true' : 'false'}
      data-node-editing={editing ? 'true' : 'false'}
      data-node-dragging={dragging ? 'true' : 'false'}
    >
      {interactiveRenderMode && (visuallySelected || highlight) && (
        <div
          data-testid="selection-border"
          className="absolute -inset-0.25 rounded-sm pointer-events-none"
          style={{
            border: `1px solid ${highlight?.color ?? 'var(--primary)'}`,
            borderStyle: !highlight && pendingPreviewActive ? 'dashed' : 'solid',
            opacity: !highlight && pendingPreviewActive ? 0.85 : 1,
          }}
        />
      )}

      {chrome}
      {children}
    </div>
  )
}
