import { useEffect, useState } from 'react'
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
import { EMPTY_EMBED_DROP_TYPE } from '~/features/dnd/utils/drop-target-data'

const EMBED_DROP_UPLOAD_ERROR = 'Could not upload file. Please try again.'

export type EmbedDropTargetVisualState = {
  isDropTarget: boolean
  isFileDropTarget: boolean
}

const inactiveDropVisualState: EmbedDropTargetVisualState = {
  isDropTarget: false,
  isFileDropTarget: false,
}

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
  const [dropVisualState, setDropVisualState] =
    useState<EmbedDropTargetVisualState>(inactiveDropVisualState)

  useElementDropTarget({ ref, enabled, sourceItemId, setTarget, setDropVisualState })
  useNativeDropTarget({ ref, enabled, setTarget, uploadFile, setDropVisualState })

  return dropVisualState
}

function useElementDropTarget({
  ref,
  enabled,
  sourceItemId,
  setTarget,
  setDropVisualState,
}: {
  ref: RefObject<HTMLElement | null>
  enabled: boolean
  sourceItemId: Id<'sidebarItems'> | null
  setTarget: (target: EmbedTarget) => Promise<void> | void
  setDropVisualState: (state: EmbedDropTargetVisualState) => void
}) {
  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) return

    return dropTargetForElements({
      element,
      getData: () =>
        sourceItemId
          ? {
              type: EMPTY_EMBED_DROP_TYPE,
              sourceItemId,
            }
          : {},
      canDrop: ({ source }) => {
        const id = getSidebarItemIdFromAppDragData(source.data)
        return id !== null && id !== sourceItemId
      },
      getDropEffect: () => 'copy',
      onDragEnter: ({ source }) => {
        const id = getSidebarItemIdFromAppDragData(source.data)
        setDropVisualState(
          id && id !== sourceItemId
            ? { isDropTarget: true, isFileDropTarget: false }
            : inactiveDropVisualState,
        )
      },
      onDragLeave: () => {
        setDropVisualState(inactiveDropVisualState)
      },
      onDrop: ({ source }) => {
        setDropVisualState(inactiveDropVisualState)
        const id = getSidebarItemIdFromAppDragData(source.data)
        if (!id || id === sourceItemId) return
        void Promise.resolve(setTarget(sidebarItemEmbedTarget(id))).catch((error) => {
          handleError(error, 'Failed to update embed target')
        })
      },
    })
  }, [enabled, ref, setDropVisualState, setTarget, sourceItemId])
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
  setDropVisualState,
}: {
  ref: RefObject<HTMLElement | null>
  enabled: boolean
  setTarget: (target: EmbedTarget) => Promise<void> | void
  uploadFile: (file: File) => Promise<Id<'sidebarItems'> | null>
  setDropVisualState: (state: EmbedDropTargetVisualState) => void
}) {
  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) return

    let dragDepth = 0

    const resetDropVisualState = () => {
      dragDepth = 0
      setDropVisualState(inactiveDropVisualState)
    }

    const onDragEnter = (event: DragEvent) => {
      if (!canHandleNativeDrop(event.dataTransfer)) return
      dragDepth += 1
      setDropVisualState(getNativeDropVisualState(event.dataTransfer))
    }

    const onDragOver = (event: DragEvent) => {
      if (!canHandleNativeDrop(event.dataTransfer)) return
      event.preventDefault()
      event.dataTransfer!.dropEffect = 'copy'
    }

    const onDragLeave = (event: DragEvent) => {
      if (!canHandleNativeDrop(event.dataTransfer)) return
      dragDepth = Math.max(0, dragDepth - 1)
      if (dragDepth === 0) {
        setDropVisualState(inactiveDropVisualState)
      }
    }

    const onDrop = async (event: DragEvent) => {
      if (!canHandleNativeDrop(event.dataTransfer)) return
      event.preventDefault()
      event.stopPropagation()
      resetDropVisualState()

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

    element.addEventListener('dragenter', onDragEnter)
    element.addEventListener('dragover', onDragOver)
    element.addEventListener('dragleave', onDragLeave)
    element.addEventListener('drop', onDrop)
    return () => {
      element.removeEventListener('dragenter', onDragEnter)
      element.removeEventListener('dragover', onDragOver)
      element.removeEventListener('dragleave', onDragLeave)
      element.removeEventListener('drop', onDrop)
    }
  }, [enabled, ref, setDropVisualState, setTarget, uploadFile])
}

function canHandleNativeDrop(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return false
  return dataTransfer.types.includes('Files') || getExternalUrlDropTarget(dataTransfer) !== null
}

function getNativeDropVisualState(dataTransfer: DataTransfer | null): EmbedDropTargetVisualState {
  return {
    isDropTarget: true,
    isFileDropTarget: dataTransfer?.types.includes('Files') ?? false,
  }
}
