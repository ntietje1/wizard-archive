import { useEffect, useRef, useState } from 'react'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { DragOverlayState } from '~/features/dnd/components/drag-overlay'
import type { DndMonitorCtx } from '~/features/dnd/types'
import { handleError } from '~/shared/utils/logger'
import { getDragItemId, getDragPreviewItemIds } from '~/features/dnd/utils/drag-source-data'
import {
  getDropTargetKey,
  getHighlightId,
  resolveDropTarget,
} from '~/features/dnd/utils/drop-target-data'
import { rejectionReasonMessage } from '~/features/dnd/utils/drop-rejections'
import { resolveDropFeedback } from '~/features/dnd/utils/drop-feedback'
import {
  dropCommandFailureMessage,
  resolveGlobalDropCommand,
} from '~/features/dnd/utils/global-drop-planner'
import { resolveNormalizedDraggedSidebarItems } from '~/features/dnd/utils/sidebar-drag-items'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import type { DropOutcome } from '~/features/dnd/utils/drop-outcome'
import type { GlobalDropCommand } from '~/features/dnd/utils/global-drop-planner'
import { assertNever } from '~/shared/utils/utils'

function resolveDraggedItem(sourceData: Record<string, unknown>, ctx: DndMonitorCtx) {
  const sid = getDragItemId(sourceData)
  return sid ? (ctx.allItemsMap.get(sid) ?? null) : null
}

function resolveDraggedItems(sourceData: Record<string, unknown>, ctx: DndMonitorCtx) {
  return resolveNormalizedDraggedSidebarItems({
    sourceData,
    activeItemsMap: ctx.itemsMap,
    trashedItemsMap: ctx.trashedItemsMap,
    includeTrashed: true,
  })
}

function resolveDraggedPreviewItems(sourceData: Record<string, unknown>, ctx: DndMonitorCtx) {
  return getDragPreviewItemIds(sourceData)
    .map((id) => ctx.allItemsMap.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
}

function overlayItemCount(items: Array<unknown>) {
  return items.length > 1 ? items.length : undefined
}

function resolveMonitorDropTarget(
  rawDropTarget: Record<string, unknown> | null,
  ctx: DndMonitorCtx,
) {
  return rawDropTarget
    ? resolveDropTarget(rawDropTarget, ctx.itemsMap, ctx.trashedItemsMap, ctx.getAncestorIds)
    : null
}

function resetElementDragState({
  overlayRef,
  lastDropTargetKeyRef,
  setDragState,
  setSidebarDragTargetId,
  setDragOutcome,
  setIsDraggingElement,
}: {
  overlayRef: React.RefObject<HTMLDivElement | null>
  lastDropTargetKeyRef: React.MutableRefObject<string | null>
  setDragState: React.Dispatch<React.SetStateAction<DragOverlayState>>
  setSidebarDragTargetId: (id: string | null) => void
  setDragOutcome: (outcome: DropOutcome | null) => void
  setIsDraggingElement: (isDragging: boolean) => void
}) {
  if (overlayRef.current) overlayRef.current.style.display = 'none'
  lastDropTargetKeyRef.current = null
  setDragState(null)
  setSidebarDragTargetId(null)
  setDragOutcome(null)
  setIsDraggingElement(false)
}

async function executeDropCommand(ctx: DndMonitorCtx, command: GlobalDropCommand) {
  if (command.status === 'noop') return
  if (command.status === 'blocked') {
    handleError(new Error(rejectionReasonMessage(command.reason)), 'Cannot drop items here')
    return
  }
  try {
    switch (command.action) {
      case 'move':
        await ctx.dndContext.moveItems(command.items, command.parentId)
        break
      case 'restore':
        await ctx.dndContext.restoreItems(command.items, command.parentId)
        break
      case 'trash':
        await ctx.dndContext.trashItems(command.items)
        break
      case 'open':
        await ctx.dndContext.navigateToItem(command.item.slug, true)
        break
      default:
        assertNever(command)
    }
    if ('parentId' in command && command.parentId) {
      ctx.dndContext.setFolderOpen(command.parentId)
    }
  } catch (error) {
    handleError(error, dropCommandFailureMessage(command))
  }
}

async function executeElementDrop(
  ctx: DndMonitorCtx,
  sourceData: Record<string, unknown>,
  targetData: Record<string, unknown>,
) {
  const draggedItems = resolveDraggedItems(sourceData, ctx)
  if (draggedItems.length === 0) return

  const resolvedTarget = resolveDropTarget(
    targetData,
    ctx.itemsMap,
    ctx.trashedItemsMap,
    ctx.getAncestorIds,
  )
  if (!resolvedTarget) return

  await executeDropCommand(
    ctx,
    resolveGlobalDropCommand(draggedItems, resolvedTarget, ctx.dropPlanningContext),
  )
}

export function useElementDragMonitor(ctxRef: React.RefObject<DndMonitorCtx>) {
  const setSidebarDragTargetId = useDndStore((s) => s.setSidebarDragTargetId)
  const setDragOutcome = useDndStore((s) => s.setDragOutcome)
  const setIsDraggingElement = useDndStore((s) => s.setIsDraggingElement)

  const [dragState, setDragState] = useState<DragOverlayState>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const lastDropTargetKeyRef = useRef<string | null>(null)
  const isElementDragRef = useRef(false)

  // Capture-phase handlers: prevent browser from opening dragged files,
  // and mark events as `synthetic` during element drags to avoid BlockNote
  // SideMenu interference
  useEffect(() => {
    const isFileDrag = (e: DragEvent) => {
      if (!e.dataTransfer) return false
      for (const type of e.dataTransfer.types) {
        if (type === 'Files') return true
      }
      return false
    }
    const handleDragOver = (e: DragEvent) => {
      if (isElementDragRef.current && !(e.target as Element)?.closest?.('.bn-editor')) {
        ;(e as unknown as Record<string, unknown>).synthetic = true
      }
      if (!isFileDrag(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'
    }
    const handleDrop = (e: DragEvent) => {
      if (isElementDragRef.current && !(e.target as Element)?.closest?.('.bn-editor')) {
        ;(e as unknown as Record<string, unknown>).synthetic = true
      }
      if (isFileDrag(e)) e.preventDefault()
    }
    // ProseMirror's contenteditable fires bogus dragleave events during
    // external file drags. On Firefox the relatedTarget points to an element
    // with a foreign ownerDocument; on other browsers it can be null.
    // pragmatic-dnd treats both as "cursor left the window" and cancels the
    // external drag lifecycle. Suppress these before the lifecycle sees them.
    const isBogusLeave = (e: DragEvent) => {
      if (e.relatedTarget == null) return true
      const rt = e.relatedTarget as Node
      if ('ownerDocument' in rt && rt.ownerDocument !== document) return true
      return false
    }
    const handleDragLeave = (e: DragEvent) => {
      if (isBogusLeave(e) && (e.target as Element)?.closest?.('.bn-editor,.tiptap')) {
        e.stopImmediatePropagation()
      }
    }
    window.addEventListener('dragleave', handleDragLeave, true)
    document.addEventListener('dragover', handleDragOver, true)
    document.addEventListener('drop', handleDrop, true)
    return () => {
      window.removeEventListener('dragleave', handleDragLeave, true)
      document.removeEventListener('dragover', handleDragOver, true)
      document.removeEventListener('drop', handleDrop, true)
    }
  }, [])

  useEffect(() => {
    return monitorForElements({
      onDragStart: ({ source, location }) => {
        isElementDragRef.current = true

        const ctx = ctxRef.current
        if (!ctx) return

        const draggedItems = resolveDraggedItems(source.data, ctx)
        const draggedPreviewItems = resolveDraggedPreviewItems(source.data, ctx)
        const draggedItem = draggedItems[0] ?? resolveDraggedItem(source.data, ctx)
        const input = location.current.input

        if (overlayRef.current) {
          overlayRef.current.style.display = ''
          overlayRef.current.style.transform = `translate(${input.clientX + 8}px, ${input.clientY + 8}px)`
        }

        lastDropTargetKeyRef.current = null
        setDragOutcome(null)
        setIsDraggingElement(true)
        if (draggedItem) {
          setDragState({
            draggedItem,
            draggedItemCount: overlayItemCount(draggedPreviewItems),
            outcome: null,
          })
        }
      },
      onDrag: ({ location, source }) => {
        const input = location.current.input
        if (overlayRef.current) {
          overlayRef.current.style.transform = `translate(${input.clientX + 8}px, ${input.clientY + 8}px)`
        }

        const topTarget = location.current.dropTargets[0]
        const rawDropTarget = topTarget ? topTarget.data : null
        const key = getDropTargetKey(rawDropTarget)

        if (key !== lastDropTargetKeyRef.current) {
          lastDropTargetKeyRef.current = key
          const ctx = ctxRef.current
          if (!ctx) return

          const dropTarget = resolveMonitorDropTarget(rawDropTarget, ctx)
          const draggedItems = resolveDraggedItems(source.data, ctx)
          const draggedPreviewItems = resolveDraggedPreviewItems(source.data, ctx)
          const feedback = resolveDropFeedback(draggedItems, dropTarget, ctx.dropPlanningContext)

          setDragState((prev) => {
            if (!prev) return null
            return {
              ...prev,
              draggedItemCount: overlayItemCount(draggedPreviewItems),
              outcome: feedback.outcome,
              rejectedItemCount: feedback.rejectedItemCount,
            }
          })

          setSidebarDragTargetId(getHighlightId(dropTarget))
          setDragOutcome(feedback.outcome)
        }
      },
      onDrop: async ({ source, location }) => {
        isElementDragRef.current = false
        resetElementDragState({
          overlayRef,
          lastDropTargetKeyRef,
          setDragState,
          setSidebarDragTargetId,
          setDragOutcome,
          setIsDraggingElement,
        })

        const topTarget = location.current.dropTargets[0]
        if (!topTarget) return

        const ctx = ctxRef.current
        if (ctx) await executeElementDrop(ctx, source.data, topTarget.data)
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSidebarDragTargetId, setDragOutcome, setIsDraggingElement])

  return { overlayRef, dragState }
}
