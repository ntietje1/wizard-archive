import { useFileDragDrop } from './useFileDragDrop'
import type { Id } from 'convex/_generated/dataModel'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'

/**
 * Encapsulates the full file-drag-drop pattern: store selectors, event handlers,
 * and highlight state. Replaces the repeated boilerplate across droppable components.
 */
export function useFileDropZone({
  targetId,
  canAcceptFiles,
}: {
  targetId: Id<'folders'> | undefined
  canAcceptFiles: boolean
}) {
  const { handleDragEnter, handleDragOver, handleDragLeave, handleDrop } =
    useFileDragDrop(canAcceptFiles ? targetId : undefined)

  const fileDragHoveredId = useSidebarUIStore((s) => s.fileDragHoveredId)
  const isDraggingFiles = useSidebarUIStore((s) => s.isDraggingFiles)

  const isFileDropTarget =
    isDraggingFiles && canAcceptFiles && fileDragHoveredId === targetId

  const fileDropProps = canAcceptFiles
    ? {
        onDragEnter: handleDragEnter,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        onDrop: handleDrop,
      }
    : {}

  return { isFileDropTarget, isDraggingFiles, fileDropProps }
}
