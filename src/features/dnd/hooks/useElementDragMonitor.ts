import { useEffect, useRef, useState } from 'react'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { DragOverlayState } from '~/features/dnd/components/drag-overlay'
import type { DndMonitorCtx } from '~/features/dnd/types'
import { handleError } from '~/shared/utils/logger'
import {
  getDragItemId,
  getDropTargetKey,
  getHighlightId,
  resolveDropOutcome,
  resolveDropTarget,
} from '~/features/dnd/utils/dnd-registry'
import { useDndStore } from '~/features/dnd/stores/dnd-store'

function resolveDraggedItem(
  sourceData: Record<string, unknown>,
  ctx: DndMonitorCtx,
) {
  const sid = getDragItemId(sourceData)
  return sid
    ? (ctx.itemsMap.get(sid) ?? ctx.trashedItemsMap.get(sid) ?? null)
    : null
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
      if (
        isElementDragRef.current &&
        !(e.target as Element)?.closest?.('.bn-editor')
      ) {
        ;(e as unknown as Record<string, unknown>).synthetic = true
      }
      if (!isFileDrag(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'
    }
    const handleDrop = (e: DragEvent) => {
      if (
        isElementDragRef.current &&
        !(e.target as Element)?.closest?.('.bn-editor')
      ) {
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
      if (
        isBogusLeave(e) &&
        (e.target as Element)?.closest?.('.bn-editor,.tiptap')
      ) {
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

        const draggedItem = resolveDraggedItem(source.data, ctx)
        const input = location.current.input

        if (overlayRef.current) {
          overlayRef.current.style.display = ''
          overlayRef.current.style.transform = `translate(${input.clientX + 8}px, ${input.clientY + 8}px)`
        }

        lastDropTargetKeyRef.current = null
        setDragOutcome(null)
        setIsDraggingElement(true)
        if (draggedItem) setDragState({ draggedItem, outcome: null })
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

          const dropTarget = rawDropTarget
            ? resolveDropTarget(
                rawDropTarget,
                ctx.itemsMap,
                ctx.trashedItemsMap,
                ctx.getAncestorIds,
              )
            : null

          const draggedItem = resolveDraggedItem(source.data, ctx)

          const outcome = resolveDropOutcome(
            draggedItem,
            dropTarget,
            ctx.dndContext,
          )

          setDragState((prev) => {
            if (!prev) return null
            return { ...prev, outcome }
          })

          setSidebarDragTargetId(getHighlightId(dropTarget))
          setDragOutcome(outcome)
        }
      },
      onDrop: async ({ source, location }) => {
        isElementDragRef.current = false

        if (overlayRef.current) overlayRef.current.style.display = 'none'
        lastDropTargetKeyRef.current = null
        setDragState(null)
        setSidebarDragTargetId(null)
        setDragOutcome(null)
        setIsDraggingElement(false)

        const topTarget = location.current.dropTargets[0]
        if (!topTarget) return

        const ctx = ctxRef.current
        const draggedItem = resolveDraggedItem(source.data, ctx)
        if (!draggedItem) return

        const targetData = resolveDropTarget(
          topTarget.data,
          ctx.itemsMap,
          ctx.trashedItemsMap,
          ctx.getAncestorIds,
        )
        if (!targetData) return

        const outcome = resolveDropOutcome(
          draggedItem,
          targetData,
          ctx.dndContext,
        )
        if (outcome?.type !== 'operation' || !outcome.execute) return

        try {
          await outcome.execute()
        } catch (error) {
          handleError(error, 'Failed to move item')
        }
      },
    })
  }, [setSidebarDragTargetId, setDragOutcome, setIsDraggingElement])

  return { overlayRef, dragState }
}
