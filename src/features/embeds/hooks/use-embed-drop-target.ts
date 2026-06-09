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
  useLocalEditorDragBoundary({ ref, enabled })

  return dropVisualState
}

function useLocalEditorDragBoundary({
  ref,
  enabled,
}: {
  ref: RefObject<HTMLElement | null>
  enabled: boolean
}) {
  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) return
    const editorElement = element.closest<HTMLElement>('.bn-editor')
    const editorContainer = element.closest<HTMLElement>('.bn-container')
    const bodyElement = element.ownerDocument.body

    const stopEditorDragOver = (event: DragEvent) => {
      editorElement?.setAttribute('data-note-empty-embed-drop-active', 'true')
      editorContainer?.setAttribute('data-note-empty-embed-drop-active', 'true')
      bodyElement.setAttribute('data-note-empty-embed-drop-active', 'true')
      event.stopPropagation()
    }
    const clearEditorDropState = () => {
      editorElement?.removeAttribute('data-note-empty-embed-drop-active')
      editorContainer?.removeAttribute('data-note-empty-embed-drop-active')
      bodyElement.removeAttribute('data-note-empty-embed-drop-active')
    }

    element.addEventListener('dragover', stopEditorDragOver)
    element.addEventListener('dragleave', clearEditorDropState)
    element.addEventListener('drop', clearEditorDropState)
    element.ownerDocument.addEventListener('dragend', clearEditorDropState, true)
    return () => {
      element.removeEventListener('dragover', stopEditorDragOver)
      element.removeEventListener('dragleave', clearEditorDropState)
      element.removeEventListener('drop', clearEditorDropState)
      element.ownerDocument.removeEventListener('dragend', clearEditorDropState, true)
      clearEditorDropState()
    }
  }, [enabled, ref])
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
        return isSingleSidebarItemDrag(source.data) && id !== null && id !== sourceItemId
      },
      getDropEffect: () => 'copy',
      onDragEnter: ({ source }) => {
        const id = getSidebarItemIdFromAppDragData(source.data)
        setDropVisualState(
          isSingleSidebarItemDrag(source.data) && id && id !== sourceItemId
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
        if (!isSingleSidebarItemDrag(source.data) || !id || id === sourceItemId) return
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

function isSingleSidebarItemDrag(data: Record<string | symbol, unknown>) {
  return Array.isArray(data.sidebarItemIds) && data.sidebarItemIds.length === 1
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
