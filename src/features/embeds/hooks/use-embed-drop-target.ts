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
import { handleError } from '~/shared/utils/logger'

const EMBED_DROP_UPLOAD_ERROR = 'Could not upload file. Please try again.'

export function useEmbedDropTarget({
  ref,
  enabled,
  sourceItemId,
  setTarget,
  uploadFile,
}: {
  ref: RefObject<HTMLElement | null>
  enabled: boolean
  sourceItemId: Id<'sidebarItems'> | null
  setTarget: (target: EmbedTarget) => Promise<void> | void
  uploadFile: (file: File) => Promise<Id<'sidebarItems'> | null>
}) {
  useElementDropTarget({ ref, enabled, sourceItemId, setTarget })
  useNativeDropTarget({ ref, enabled, setTarget, uploadFile })
}

function useElementDropTarget({
  ref,
  enabled,
  sourceItemId,
  setTarget,
}: {
  ref: RefObject<HTMLElement | null>
  enabled: boolean
  sourceItemId: Id<'sidebarItems'> | null
  setTarget: (target: EmbedTarget) => Promise<void> | void
}) {
  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) return

    return dropTargetForElements({
      element,
      canDrop: ({ source }) => {
        const id = getSidebarItemIdFromAppDragData(source.data)
        return id !== null && id !== sourceItemId
      },
      getDropEffect: () => 'copy',
      onDrop: ({ source }) => {
        const id = getSidebarItemIdFromAppDragData(source.data)
        if (!id || id === sourceItemId) return
        void Promise.resolve(setTarget(sidebarItemEmbedTarget(id))).catch((error) => {
          handleError(error, 'Failed to update embed target')
        })
      },
    })
  }, [enabled, ref, setTarget, sourceItemId])
}

function getSidebarItemIdFromAppDragData(data: Record<string | symbol, unknown>) {
  const id = getSidebarItemIdFromDragData(data)
  if (!id || !Array.isArray(data.sidebarItemIds)) return null
  return data.sidebarItemIds.includes(id) ? id : null
}

function useNativeDropTarget({
  ref,
  enabled,
  setTarget,
  uploadFile,
}: {
  ref: RefObject<HTMLElement | null>
  enabled: boolean
  setTarget: (target: EmbedTarget) => Promise<void> | void
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
      try {
        if (file) {
          const sidebarItemId = await uploadFile(file)
          if (!sidebarItemId) {
            handleError(new Error(EMBED_DROP_UPLOAD_ERROR), EMBED_DROP_UPLOAD_ERROR)
            return
          }
          await setTarget(sidebarItemEmbedTarget(sidebarItemId))
          return
        }

        const target = getExternalUrlDropTarget(event.dataTransfer)
        if (target) await setTarget(target)
      } catch (error) {
        handleError(error, 'Failed to update embed target')
      }
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
