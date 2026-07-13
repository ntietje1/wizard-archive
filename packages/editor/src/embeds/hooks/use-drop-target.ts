import { useEffect, useMemo, useReducer } from 'react'
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { RefObject } from 'react'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { EmbedTarget } from '../../../../../shared/embeds/embedTargets'
import { getSidebarItemIdFromDragData, resourceEmbedTarget } from '../utils/targets'
import { EMPTY_EMBED_DROP_TYPE } from '../../drag-drop/drop-target-data'
import type { EmptyEmbedDropZoneData } from '../../drag-drop/drop-target-data'
import type { EmbedTargetOperations } from '../target-operations'
import { registerSurfaceDropExecutor } from '../../drag-drop/surface-command'
import {
  useCanAcceptExternalFiles,
  useDndRuntimeDropData,
  useOptionalDndRuntimeDropData,
} from '../../drag-drop/context'
import { resolveExternalFileDropTarget } from '../../drag-drop/external-file-drop-target'
import { useExternalDropTarget } from '../../drag-drop/use-external-drop-target'
import { useExternalUrlDropTarget } from '../../drag-drop/use-external-url-drop-target'
import {
  registerSurfaceExternalUrlDropExecutor,
  registerSurfaceFileImportExecutor,
} from '../../drag-drop/drop-command-execution'
import { runWithPendingEmbedUpload } from '../pending-upload'
import type { EmbedUploadSurface } from '../pending-upload'

const EMBED_DROP_UPLOAD_ERROR = 'Could not upload file. Please try again.'
const EMPTY_DROP_DATA = {}

export type EmbedDropTargetVisualState = {
  isDropTarget: boolean
  isFileDropTarget: boolean
}

const inactiveDropVisualState: EmbedDropTargetVisualState = {
  isDropTarget: false,
  isFileDropTarget: false,
}

export function useEmbedDropTarget({
  embedBlockId,
  ref,
  enabled,
  sourceItemId,
  setTarget,
  targetKind,
  uploadFile,
  uploadSurface,
}: {
  embedBlockId: string
  ref: RefObject<HTMLElement | null>
  enabled: boolean
  sourceItemId: SidebarItemId | null
  setTarget: (target: EmbedTarget) => Promise<void> | void
  targetKind: EmbedTarget['kind']
  uploadFile: EmbedTargetOperations['uploadFile']
  uploadSurface: EmbedUploadSurface
}) {
  const isEmptyEmbedTarget = targetKind === 'empty'
  const emptyTargetEnabled = enabled && isEmptyEmbedTarget
  const [dropVisualState, updateDropVisualState] = useReducer(
    (_state: EmbedDropTargetVisualState, nextState: EmbedDropTargetVisualState) => nextState,
    inactiveDropVisualState,
  )
  const rawDropData = useMemo<EmptyEmbedDropZoneData | null>(
    () =>
      sourceItemId
        ? {
            type: EMPTY_EMBED_DROP_TYPE,
            sourceItemId,
            embedBlockId,
          }
        : null,
    [embedBlockId, sourceItemId],
  )
  const emptyDropData = useDndRuntimeDropData(EMPTY_DROP_DATA)
  const dropData = useOptionalDndRuntimeDropData(rawDropData)
  const canAcceptExternalFiles = useCanAcceptExternalFiles()

  useElementDropTarget({
    dropData: dropData ?? emptyDropData,
    ref,
    enabled: emptyTargetEnabled,
    sourceItemId,
    updateDropVisualState,
  })
  useEmptyEmbedSurfaceExecutor({
    dropData,
    enabled: emptyTargetEnabled,
    sourceItemId,
    setTarget,
  })
  useEmptyEmbedFileImportExecutor({
    canAcceptExternalFiles,
    dropData,
    enabled: emptyTargetEnabled,
    setTarget,
    uploadFile,
    uploadSurface,
    embedBlockId,
  })
  useEmptyEmbedExternalUrlExecutor({ dropData, enabled: emptyTargetEnabled, setTarget })
  const { externalDropTargetRef, isFileDropTarget } = useExternalDropTarget({
    data: dropData ?? emptyDropData,
    enabled: emptyTargetEnabled && canAcceptExternalFiles && Boolean(dropData),
    fileDropTarget: resolveExternalFileDropTarget(dropData, {
      surfaceFileUploadAvailable: Boolean(uploadFile),
    }),
  })
  const { externalUrlDropTargetRef, isUrlDropTarget } = useExternalUrlDropTarget({
    data: dropData ?? emptyDropData,
    enabled: emptyTargetEnabled && Boolean(dropData),
  })
  useEffect(() => {
    externalDropTargetRef(ref.current)
    return () => externalDropTargetRef(null)
  }, [externalDropTargetRef, ref])
  useEffect(() => {
    externalUrlDropTargetRef(ref.current)
    return () => externalUrlDropTargetRef(null)
  }, [externalUrlDropTargetRef, ref])
  useLocalEditorDragBoundary({ ref, enabled: emptyTargetEnabled })

  return {
    isDropTarget: dropVisualState.isDropTarget || isUrlDropTarget || isFileDropTarget,
    isFileDropTarget: dropVisualState.isFileDropTarget || isFileDropTarget,
  }
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

function useEmptyEmbedSurfaceExecutor({
  dropData,
  enabled,
  sourceItemId,
  setTarget,
}: {
  dropData: EmptyEmbedDropZoneData | null
  enabled: boolean
  sourceItemId: SidebarItemId | null
  setTarget: (target: EmbedTarget) => Promise<void> | void
}) {
  useEffect(() => {
    if (!enabled || !sourceItemId || !dropData) return

    return registerSurfaceDropExecutor({
      action: 'noteEmbed',
      target: dropData,
      execute: async (command) => {
        if (command.items.length !== 1) {
          throw new Error('Empty embed surface command requires exactly one item')
        }
        const item = command.items[0]
        await setTarget(resourceEmbedTarget(item.id))
      },
    })
  }, [dropData, enabled, setTarget, sourceItemId])
}

function useEmptyEmbedFileImportExecutor({
  canAcceptExternalFiles,
  dropData,
  enabled,
  setTarget,
  uploadFile,
  uploadSurface,
  embedBlockId,
}: {
  canAcceptExternalFiles: boolean
  dropData: EmptyEmbedDropZoneData | null
  enabled: boolean
  setTarget: (target: EmbedTarget) => Promise<void> | void
  uploadFile: EmbedTargetOperations['uploadFile']
  uploadSurface: EmbedUploadSurface
  embedBlockId: string
}) {
  useEffect(() => {
    if (!enabled || !canAcceptExternalFiles || !dropData || !uploadFile) return

    return registerSurfaceFileImportExecutor({
      commandId: 'surface-file-import.empty-embed',
      target: dropData,
      execute: async (command) => {
        if (command.dropResult.files.length !== 1) {
          throw new Error('Empty embed file import command requires exactly one file')
        }
        const file = command.dropResult.files[0].file

        return runWithPendingEmbedUpload(uploadSurface, embedBlockId, file.name, async () => {
          const uploadResult = await uploadFile(file)
          if (uploadResult.status !== 'completed') {
            console.error(EMBED_DROP_UPLOAD_ERROR, uploadResult)
            return uploadResult
          }
          await setTarget(resourceEmbedTarget(uploadResult.itemId))
          return uploadResult
        })
      },
    })
  }, [
    canAcceptExternalFiles,
    dropData,
    embedBlockId,
    enabled,
    setTarget,
    uploadFile,
    uploadSurface,
  ])
}

function useEmptyEmbedExternalUrlExecutor({
  dropData,
  enabled,
  setTarget,
}: {
  dropData: EmptyEmbedDropZoneData | null
  enabled: boolean
  setTarget: (target: EmbedTarget) => Promise<void> | void
}) {
  useEffect(() => {
    if (!enabled || !dropData) return

    return registerSurfaceExternalUrlDropExecutor({
      commandId: 'surface-url-drop.empty-embed',
      target: dropData,
      execute: async (command) => {
        await setTarget(command.embedTarget)
      },
    })
  }, [dropData, enabled, setTarget])
}

function useElementDropTarget({
  dropData,
  ref,
  enabled,
  sourceItemId,
  updateDropVisualState,
}: {
  dropData: Record<string, unknown>
  ref: RefObject<HTMLElement | null>
  enabled: boolean
  sourceItemId: SidebarItemId | null
  updateDropVisualState: (state: EmbedDropTargetVisualState) => void
}) {
  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) return

    return dropTargetForElements({
      element,
      getData: () => dropData,
      canDrop: ({ source }) => canAcceptDrop(source.data),
      getDropEffect: () => 'copy',
      onDragEnter: ({ source }) => {
        updateDropVisualState(
          canAcceptDrop(source.data)
            ? { isDropTarget: true, isFileDropTarget: false }
            : inactiveDropVisualState,
        )
      },
      onDragLeave: () => {
        updateDropVisualState(inactiveDropVisualState)
      },
      onDrop: () => {
        updateDropVisualState(inactiveDropVisualState)
      },
    })

    function canAcceptDrop(data: Record<string | symbol, unknown>) {
      const id = getSidebarItemIdFromAppDragData(data)
      return isSingleSidebarItemDrag(data) && id !== null && id !== sourceItemId
    }
  }, [dropData, enabled, ref, updateDropVisualState, sourceItemId])
}

function getSidebarItemIdFromAppDragData(data: Record<string | symbol, unknown>) {
  const id = getSidebarItemIdFromDragData(data)
  if (!id || !Array.isArray(data.sidebarItemIds)) return null
  return data.sidebarItemIds.includes(id) ? id : null
}

function isSingleSidebarItemDrag(data: Record<string | symbol, unknown>) {
  return Array.isArray(data.sidebarItemIds) && data.sidebarItemIds.length === 1
}
