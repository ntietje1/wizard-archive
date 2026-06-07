import { useEffect } from 'react'
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { RefObject } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { EmbedTarget } from 'shared/embeds/embedTargets'
import {
  getExternalUrlDropTarget,
  getSidebarItemIdFromDragData,
  sidebarItemEmbedTarget,
} from '~/features/embeds/utils/embed-targets'

export function useNoteEmbedBlockDropTarget({
  ref,
  editable,
  sourceNoteId,
  setTarget,
  uploadFile,
}: {
  ref: RefObject<HTMLElement | null>
  editable: boolean
  sourceNoteId: Id<'sidebarItems'> | null
  setTarget: (target: EmbedTarget) => void
  uploadFile: (file: File) => Promise<Id<'sidebarItems'> | null>
}) {
  useElementDropTarget({ ref, editable, sourceNoteId, setTarget })
  useNativeDropTarget({ ref, editable, setTarget, uploadFile })
}

function useElementDropTarget({
  ref,
  editable,
  sourceNoteId,
  setTarget,
}: {
  ref: RefObject<HTMLElement | null>
  editable: boolean
  sourceNoteId: Id<'sidebarItems'> | null
  setTarget: (target: EmbedTarget) => void
}) {
  useEffect(() => {
    const element = ref.current
    if (!element || !editable) return

    return dropTargetForElements({
      element,
      canDrop: ({ source }) => {
        const id = getSidebarItemIdFromDragData(source.data)
        return id !== null && id !== sourceNoteId
      },
      getDropEffect: () => 'copy',
      onDrop: ({ source }) => {
        const id = getSidebarItemIdFromDragData(source.data)
        if (!id || id === sourceNoteId) return
        setTarget(sidebarItemEmbedTarget(id))
      },
    })
  }, [editable, ref, setTarget, sourceNoteId])
}

function useNativeDropTarget({
  ref,
  editable,
  setTarget,
  uploadFile,
}: {
  ref: RefObject<HTMLElement | null>
  editable: boolean
  setTarget: (target: EmbedTarget) => void
  uploadFile: (file: File) => Promise<Id<'sidebarItems'> | null>
}) {
  useEffect(() => {
    const element = ref.current
    if (!element || !editable) return

    const onDragOver = (event: DragEvent) => {
      if (!canHandleNativeDrop(event.dataTransfer)) return
      event.preventDefault()
      event.dataTransfer!.dropEffect = 'copy'
    }

    const onDrop = async (event: DragEvent) => {
      if (!canHandleNativeDrop(event.dataTransfer)) return
      event.preventDefault()
      event.stopPropagation()

      const file = event.dataTransfer?.files.item(0)
      if (file) {
        const sidebarItemId = await uploadFile(file)
        if (sidebarItemId) setTarget(sidebarItemEmbedTarget(sidebarItemId))
        return
      }

      const target = getExternalUrlDropTarget(event.dataTransfer)
      if (target) setTarget(target)
    }

    element.addEventListener('dragover', onDragOver)
    element.addEventListener('drop', onDrop)
    return () => {
      element.removeEventListener('dragover', onDragOver)
      element.removeEventListener('drop', onDrop)
    }
  }, [editable, ref, setTarget, uploadFile])
}

function canHandleNativeDrop(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return false
  return dataTransfer.types.includes('Files') || getExternalUrlDropTarget(dataTransfer) !== null
}
