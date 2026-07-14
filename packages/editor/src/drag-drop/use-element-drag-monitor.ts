import type { ResourceId } from '../resources/domain-id'
import { useEffect, useRef, useState } from 'react'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { DragOverlayState } from './drag-overlay'
import type { ElementDragMonitorContext } from './monitor-context'
import { useDndStore } from './store'
import type { DropOutcome } from './outcome'

import {
  getElementDragFeedbackInput,
  globalDropOptionsFromInput,
  planElementDragFeedback,
  planElementDragStart,
} from './element-drag-feedback'
import { executeElementDrop } from './element-drop-execution'
import { installNativeDragGuards } from './native-drag-guards'
import { createSurfaceDropCommandUiEffects } from './surface-command-effects'

const surfaceDropCommandEffects = createSurfaceDropCommandUiEffects()

function resetElementDragState({
  overlayRef,
  lastDropTargetKeyRef,
  setDragState,
  setActiveDropTargetKey,
  setDragOutcome,
  setIsDraggingElement,
  setDragPreviewItemIds,
}: {
  overlayRef: React.RefObject<HTMLDivElement | null>
  lastDropTargetKeyRef: React.MutableRefObject<string | null>
  setDragState: React.Dispatch<React.SetStateAction<DragOverlayState>>
  setActiveDropTargetKey: (id: string | null) => void
  setDragOutcome: (outcome: DropOutcome | null) => void
  setIsDraggingElement: (isDragging: boolean) => void
  setDragPreviewItemIds: (ids: Array<ResourceId>) => void
}) {
  if (overlayRef.current) overlayRef.current.style.display = 'none'
  lastDropTargetKeyRef.current = null
  setDragState(null)
  setActiveDropTargetKey(null)
  setDragPreviewItemIds([])
  setDragOutcome(null)
  setIsDraggingElement(false)
}

type ElementMonitor = Parameters<typeof monitorForElements>[0]
type ElementDragUpdateArgs = Parameters<NonNullable<ElementMonitor['onDrag']>>[0]
type ElementDragStartArgs = Parameters<NonNullable<ElementMonitor['onDragStart']>>[0]
type ElementDropArgs = Parameters<NonNullable<ElementMonitor['onDrop']>>[0]

function updateOverlayPosition(
  overlayRef: React.RefObject<HTMLDivElement | null>,
  input: { clientX: number; clientY: number },
) {
  if (!overlayRef.current) return
  overlayRef.current.style.transform = `translate(${input.clientX + 8}px, ${input.clientY + 8}px)`
}

export function useElementDragMonitor(ctxRef: React.RefObject<ElementDragMonitorContext>) {
  const setActiveDropTargetKey = useDndStore((s) => s.setActiveDropTargetKey)
  const setDragOutcome = useDndStore((s) => s.setDragOutcome)
  const setIsDraggingElement = useDndStore((s) => s.setIsDraggingElement)
  const setDragPreviewItemIds = useDndStore((s) => s.setDragPreviewItemIds)
  const setBatchDecision = useDndStore((s) => s.setBatchDecision)

  const [dragState, setDragState] = useState<DragOverlayState>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const lastDropTargetKeyRef = useRef<string | null>(null)
  const isElementDragRef = useRef(false)
  const handleDragUpdateRef = useRef<(args: ElementDragUpdateArgs) => void>(() => {})
  const handleDragStartRef = useRef<(args: ElementDragStartArgs) => void>(() => {})
  const handleElementDropRef = useRef<(args: ElementDropArgs) => Promise<void>>(async () => {})

  handleDragUpdateRef.current = ({ location, source }) => {
    updateOverlayPosition(overlayRef, location.current.input)
    const { feedbackKey, options, rawDropTarget } = getElementDragFeedbackInput(location)

    if (feedbackKey !== lastDropTargetKeyRef.current) {
      const ctx = ctxRef.current
      if (!ctx) return

      lastDropTargetKeyRef.current = feedbackKey
      const feedback = planElementDragFeedback({
        ctx,
        options,
        rawDropTarget,
        sourceData: source.data,
      })
      setDragState((prev) => {
        if (!prev) return null
        return {
          ...prev,
          draggedItemCount: feedback.dragState.draggedItemCount,
          outcome: feedback.dragState.outcome,
          rejectedItemCount: feedback.dragState.rejectedItemCount,
        }
      })
      setActiveDropTargetKey(feedback.dropTargetKey)
      setDragOutcome(feedback.dragState.outcome)
    }
  }

  handleDragStartRef.current = ({ source, location }) => {
    isElementDragRef.current = true

    const ctx = ctxRef.current
    if (!ctx) return

    const dragStart = planElementDragStart({ ctx, sourceData: source.data })
    const input = location.current.input

    if (overlayRef.current) {
      overlayRef.current.style.display = ''
      overlayRef.current.style.transform = `translate(${input.clientX + 8}px, ${input.clientY + 8}px)`
    }

    lastDropTargetKeyRef.current = null
    setDragOutcome(null)
    setDragPreviewItemIds(dragStart.dragPreviewItemIds)
    setIsDraggingElement(true)
    if (dragStart.dragState) setDragState(dragStart.dragState)
  }

  handleElementDropRef.current = async ({ source, location }) => {
    isElementDragRef.current = false
    resetElementDragState({
      overlayRef,
      lastDropTargetKeyRef,
      setDragState,
      setActiveDropTargetKey,
      setDragOutcome,
      setIsDraggingElement,
      setDragPreviewItemIds,
    })

    const topTarget = location.current.dropTargets[0]
    if (!topTarget) return

    const ctx = ctxRef.current
    if (ctx) {
      try {
        await executeElementDrop({
          ctx,
          sourceData: source.data,
          targetData: topTarget.data,
          input: location.current.input,
          options: globalDropOptionsFromInput(location.current.input),
          setBatchDecision,
        })
      } catch (error) {
        surfaceDropCommandEffects.reportError(error, 'Cannot complete this drop')
      }
    }
  }

  useEffect(() => {
    return installNativeDragGuards({
      isElementDragActive: () => isElementDragRef.current,
    })
  }, [])

  useEffect(() => {
    return monitorForElements({
      onDragStart: (args) => handleDragStartRef.current(args),
      onDrag: (args) => handleDragUpdateRef.current(args),
      onDropTargetChange: (args) => handleDragUpdateRef.current(args),
      onDrop: (args) => handleElementDropRef.current(args),
    })
  }, [])

  return { overlayRef, dragState }
}
