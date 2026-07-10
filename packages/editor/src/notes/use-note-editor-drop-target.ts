import { use, useEffect, useMemo } from 'react'
import { NOTE_EDITOR_DROP_TYPE } from '../drag-drop/drop-target-data'
import {
  DndProviderContext,
  useCanAcceptExternalFiles,
  useDndRuntimeDropData,
} from '../drag-drop/context'
import {
  registerSurfaceExternalUrlDropExecutor,
  registerSurfaceFileImportExecutor,
} from '../drag-drop/drop-command-execution'
import { resolveExternalFileDropTarget } from '../drag-drop/external-file-drop-target'
import { useExternalDropTarget } from '../drag-drop/use-external-drop-target'
import { useExternalUrlDropTarget } from '../drag-drop/use-external-url-drop-target'
import { useDndDropTarget } from '../drag-drop/use-drop-target'
import { useMergedRef } from '../drag-drop/ref-utils'
import { registerSurfaceDropExecutor } from '../drag-drop/surface-command'
import { blockPropsFromEmbedTarget, DEFAULT_NOTE_EMBED_PREVIEW_WIDTH } from './embeds/block-targets'
import { resourceEmbedTarget } from '../embeds/utils/targets'
import type { NoteEditorDropZoneData } from '../drag-drop/drop-target-data'
import type { SurfaceBatchDropCommand } from '../drag-drop/surface-planner'
import type { DndValue } from '../drag-drop/context'
import type { AnyItem } from '../workspace/items'
import type { CustomBlockNoteEditor } from './editor-schema'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { EmbedTarget } from '../../../../shared/embeds/embedTargets'
import type { EmbedTargetOperations } from '../embeds/target-operations'
import { runWithPendingEmbedUpload } from '../embeds/pending-upload'

const EMPTY_NOTE_ID = '' as SidebarItemId
const BLOCKED_NOTE_BODY_EXTERNAL_DROP_SELECTOR = '[data-blocknote-external-drop-blocked="true"]'

type NoteDropEditor = CustomBlockNoteEditor & {
  _tiptapEditor?: {
    chain: () => NoteDropTipTapChain
    view?: {
      posAtCoords?: (coords: { left: number; top: number }) => { pos?: number } | null
    }
  }
  getTextCursorPosition?: () => { block: unknown }
  insertBlocks?: (
    blocksToInsert: Array<unknown>,
    referenceBlock: unknown,
    placement?: 'before' | 'after',
  ) => Array<NoteDropBlock>
  updateBlock?: (block: NoteDropBlock, update: { props: Record<string, unknown> }) => void
}

type NoteDropBlock = { id: string }

type NoteDropTipTapChain = {
  focus: () => NoteDropTipTapChain
  insertContent: (content: string) => NoteDropTipTapChain
  run: () => unknown
  setTextSelection?: (range: { from: number; to: number }) => NoteDropTipTapChain
}

type NoteDropExecutionInput = {
  clientX: number
  clientY: number
}

export function useNoteEditorDropTarget({
  editor,
  enabled,
  sourceNoteId,
  uploadFile,
}: {
  editor: CustomBlockNoteEditor
  enabled: boolean
  sourceNoteId: SidebarItemId | null
  uploadFile?: EmbedTargetOperations['uploadFile']
}) {
  const dndContext = use(DndProviderContext)
  const canAcceptExternalFiles = useCanAcceptExternalFiles()
  const noteId = sourceNoteId ?? EMPTY_NOTE_ID
  const dropData = useMemo<NoteEditorDropZoneData>(
    () => ({ type: NOTE_EDITOR_DROP_TYPE, noteId }),
    [noteId],
  )
  const scopedDropData = useDndRuntimeDropData(dropData)
  const canDrop = enabled && sourceNoteId !== null && dndContext !== null
  const { dropTargetRef, isDropTarget } = useDndDropTarget({
    data: scopedDropData,
    canDrop,
  })
  const { externalDropTargetRef, isFileDropTarget } = useExternalDropTarget({
    data: scopedDropData,
    enabled: canDrop && canAcceptExternalFiles && Boolean(uploadFile),
    fileDropTarget: resolveExternalFileDropTarget(scopedDropData, {
      surfaceFileUploadAvailable: Boolean(uploadFile),
    }),
    blockedTargetSelector: BLOCKED_NOTE_BODY_EXTERNAL_DROP_SELECTOR,
  })
  const { externalUrlDropTargetRef, isUrlDropTarget } = useExternalUrlDropTarget({
    data: scopedDropData,
    enabled: canDrop,
    blockedTargetSelector: BLOCKED_NOTE_BODY_EXTERNAL_DROP_SELECTOR,
  })

  useEffect(() => {
    if (!canDrop || !dndContext) return

    const dropEditor = editor as NoteDropEditor
    const disposeLinkExecutor = registerSurfaceDropExecutor({
      action: 'link',
      target: scopedDropData,
      execute: (command, input) => {
        insertDroppedLinks(dropEditor, command, input, dndContext)
        return Promise.resolve()
      },
    })
    const disposeEmbedExecutor = registerSurfaceDropExecutor({
      action: 'noteEmbed',
      target: scopedDropData,
      execute: (command, input) => {
        insertDroppedEmbeds(dropEditor, command, input)
        return Promise.resolve()
      },
    })
    const disposeUrlExecutor = registerSurfaceExternalUrlDropExecutor({
      commandId: 'surface-url-drop.note-editor',
      target: scopedDropData,
      execute: (command, input) => {
        insertDroppedEmbedTargets(dropEditor, [command.embedTarget], input)
        return Promise.resolve()
      },
    })

    return () => {
      disposeLinkExecutor()
      disposeEmbedExecutor()
      disposeUrlExecutor()
    }
  }, [canDrop, dndContext, editor, scopedDropData])

  useEffect(() => {
    if (!canDrop || !uploadFile) return

    const dropEditor = editor as NoteDropEditor
    return registerSurfaceFileImportExecutor({
      commandId: 'surface-file-import.note-editor',
      target: scopedDropData,
      execute: async (command, input) => {
        const updateBlock = dropEditor.updateBlock
        if (typeof updateBlock !== 'function') {
          throw new Error('Cannot resolve dropped file embeds without block update support')
        }
        const updateDroppedBlock = updateBlock.bind(dropEditor)
        const pendingBlocks = insertDroppedEmbedTargets(
          dropEditor,
          command.dropResult.files.map(() => ({ kind: 'empty' })),
          input,
        )

        return Promise.all(
          command.dropResult.files.map(async ({ file }, index) => {
            try {
              const pendingBlock = pendingBlocks[index]
              if (!pendingBlock) {
                throw new Error('Dropped file embed did not create a corresponding block')
              }
              return await runWithPendingEmbedUpload(
                'note',
                pendingBlock.id,
                file.name,
                async () => {
                  const uploadResult = await uploadFile(file)
                  if (uploadResult.status === 'completed') {
                    updateDroppedBlock(pendingBlock, {
                      props: blockPropsFromEmbedTarget(resourceEmbedTarget(uploadResult.itemId)),
                    })
                  }
                  return uploadResult
                },
              )
            } catch (error) {
              return { status: 'error' as const, error }
            }
          }),
        )
      },
    })
  }, [canDrop, editor, scopedDropData, uploadFile])

  return {
    dropTargetRef: useMergedRef(dropTargetRef, externalDropTargetRef, externalUrlDropTargetRef),
    isDropTarget: isDropTarget || isFileDropTarget || isUrlDropTarget,
  }
}

function insertDroppedLinks(
  editor: NoteDropEditor,
  command: SurfaceBatchDropCommand & { action: 'link' },
  input: NoteDropExecutionInput,
  dndContext: Pick<DndValue, 'getItemLinkPath'>,
) {
  const tiptap = editor._tiptapEditor
  if (!tiptap) {
    throw new Error('Cannot insert dropped links without an active note editor')
  }

  const content = command.items.map((item) => buildDroppedItemWikiLink(item, dndContext)).join(' ')
  focusEditorAtDropPoint(tiptap, input)
  tiptap.chain().focus().insertContent(content).run()
}

function insertDroppedEmbeds(
  editor: NoteDropEditor,
  command: SurfaceBatchDropCommand & { action: 'noteEmbed' },
  input: NoteDropExecutionInput,
) {
  insertDroppedEmbedTargets(
    editor,
    command.items.map((item) => resourceEmbedTarget(item.id)),
    input,
  )
}

function insertDroppedEmbedTargets(
  editor: NoteDropEditor,
  targets: Array<EmbedTarget>,
  input: NoteDropExecutionInput,
): Array<NoteDropBlock> {
  if (typeof editor.insertBlocks !== 'function') {
    throw new Error('Cannot insert dropped embeds without block insertion support')
  }

  const tiptap = editor._tiptapEditor
  if (tiptap) {
    focusEditorAtDropPoint(tiptap, input)
  }

  const currentBlock = editor.getTextCursorPosition?.().block
  if (!currentBlock) {
    throw new Error('Cannot insert dropped embeds without an active note block')
  }

  return editor.insertBlocks(
    targets.map((target) => ({
      type: 'embed',
      props: {
        ...blockPropsFromEmbedTarget(target),
        previewWidth: DEFAULT_NOTE_EMBED_PREVIEW_WIDTH,
      },
    })),
    currentBlock,
    'after',
  )
}

function focusEditorAtDropPoint(
  tiptap: NonNullable<NoteDropEditor['_tiptapEditor']>,
  input: NoteDropExecutionInput,
) {
  const pos = tiptap.view?.posAtCoords?.({ left: input.clientX, top: input.clientY })?.pos
  const chain = tiptap.chain().focus()
  if (typeof pos === 'number') {
    chain.setTextSelection?.({ from: pos, to: pos })
  }
  chain.run()
}

function buildDroppedItemWikiLink(item: AnyItem, dndContext: Pick<DndValue, 'getItemLinkPath'>) {
  const path = dndContext
    .getItemLinkPath(item)
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/')
  return `[[${path || item.name}]]`
}
