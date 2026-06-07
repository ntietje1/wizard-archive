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

export function useCanvasEmbedDropTarget({
  ref,
  enabled,
  sourceCanvasId,
  setTarget,
  uploadFile,
}: {
  ref: RefObject<HTMLElement | null>
  enabled: boolean
  sourceCanvasId: Id<'sidebarItems'> | null
  setTarget: (target: EmbedTarget) => Promise<void>
  uploadFile: (file: File) => Promise<Id<'sidebarItems'> | null>
}) {
  useElementDropTarget({ ref, enabled, sourceCanvasId, setTarget })
  useNativeDropTarget({ ref, enabled, setTarget, uploadFile })
}

function useElementDropTarget({
  ref,
  enabled,
  sourceCanvasId,
  setTarget,
}: {
  ref: RefObject<HTMLElement | null>
  enabled: boolean
  sourceCanvasId: Id<'sidebarItems'> | null
  setTarget: (target: EmbedTarget) => Promise<void>
}) {
  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) return

    return dropTargetForElements({
      element,
      canDrop: ({ source }) => {
        const id = getSidebarItemIdFromDragData(source.data)
        return id !== null && id !== sourceCanvasId
      },
      getDropEffect: () => 'copy',
      onDrop: ({ source }) => {
        const id = getSidebarItemIdFromDragData(source.data)
        if (!id || id === sourceCanvasId) return
        void setTarget(sidebarItemEmbedTarget(id))
      },
    })
  }, [enabled, ref, setTarget, sourceCanvasId])
}

function useNativeDropTarget({
  ref,
  enabled,
  setTarget,
  uploadFile,
}: {
  ref: RefObject<HTMLElement | null>
  enabled: boolean
  setTarget: (target: EmbedTarget) => Promise<void>
  uploadFile: (file: File) => Promise<Id<'sidebarItems'> | null>
}) {
  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) return

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
        if (sidebarItemId) await setTarget(sidebarItemEmbedTarget(sidebarItemId))
        return
      }

      const target = getExternalUrlDropTarget(event.dataTransfer)
      if (target) await setTarget(target)
    }

    element.addEventListener('dragover', onDragOver)
    element.addEventListener('drop', onDrop)
    return () => {
      element.removeEventListener('dragover', onDragOver)
      element.removeEventListener('drop', onDrop)
    }
  }, [enabled, ref, setTarget, uploadFile])
}

function canHandleNativeDrop(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return false
  return dataTransfer.types.includes('Files') || getExternalUrlDropTarget(dataTransfer) !== null
}
