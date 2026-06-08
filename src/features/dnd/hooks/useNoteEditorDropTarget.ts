import { useEffect, useRef } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import { NOTE_EDITOR_DROP_TYPE, canDropFilesOnTarget } from '~/features/dnd/utils/drop-target-data'
import { registerSurfaceDropExecutor } from '~/features/dnd/utils/surface-drop-command'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useExternalDropTarget } from '~/features/dnd/hooks/useExternalDropTarget'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { getMinDisambiguationPath } from 'shared/links/resolution'
import { useNoteEditorStore } from '~/features/editor/stores/note-editor-store'
import { registerExternalFileDropExecutor } from '~/features/dnd/utils/external-file-drop-command'
import { blockPropsFromEmbedTarget } from '~/features/editor/components/extensions/embed-block/embed-block-targets'
import { sidebarItemEmbedTarget } from '~/features/embeds/utils/embed-targets'
import { useEmbedUpload } from '~/features/embeds/hooks/use-embed-upload'
import { handleError } from '~/shared/utils/logger'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import { focusEditorViewAtNearestPoint } from '~/features/editor/utils/note-editor-focus'

type NoteDropInput = {
  clientX: number
  clientY: number
}

function getBlockReferenceAtPoint(editor: CustomBlockNoteEditor, input: NoteDropInput) {
  const pointElement =
    typeof document.elementFromPoint === 'function'
      ? document.elementFromPoint(input.clientX, input.clientY)
      : null
  const blockElement = pointElement?.closest('[data-node-type="blockContainer"]')
  const blockId = blockElement?.getAttribute('data-id')
  const blockAtPoint = blockId ? editor.getBlock(blockId) : undefined
  if (blockAtPoint) return blockAtPoint

  return editor.getTextCursorPosition().block ?? editor.document.at(-1) ?? null
}

function insertSidebarItemEmbedBlocks(
  editor: CustomBlockNoteEditor,
  sidebarItemIds: Array<Id<'sidebarItems'>>,
  input: NoteDropInput,
) {
  const referenceBlock = getBlockReferenceAtPoint(editor, input)
  if (!referenceBlock) return false

  editor.insertBlocks(
    sidebarItemIds.map((sidebarItemId) => ({
      type: 'embed' as const,
      props: blockPropsFromEmbedTarget(sidebarItemEmbedTarget(sidebarItemId)),
    })),
    referenceBlock,
    'after',
  )
  return true
}

function focusNoteEditorAtDropPoint(editor: CustomBlockNoteEditor, input: NoteDropInput) {
  const view = editor._tiptapEditor.view
  if (!view) return

  focusEditorViewAtNearestPoint(view, {
    x: input.clientX,
    y: input.clientY,
  })
}

export function useNoteEditorDropTarget({
  ref,
  noteId,
}: {
  ref: React.RefObject<HTMLElement | null>
  noteId: Id<'sidebarItems'>
}) {
  const dropData = { type: NOTE_EDITOR_DROP_TYPE, noteId } as const
  useDndDropTarget({
    ref,
    data: dropData,
    highlightId: `note:${noteId}`,
  })
  useExternalDropTarget({
    ref,
    data: dropData,
    canAcceptFiles: canDropFilesOnTarget(dropData),
  })

  const { data: allItems, itemsMap } = useActiveSidebarItems()
  const allItemsRef = useRef(allItems)
  allItemsRef.current = allItems
  const itemsMapRef = useRef(itemsMap)
  itemsMapRef.current = itemsMap
  const { uploadEmbedFile } = useEmbedUpload()
  const uploadEmbedFileRef = useRef(uploadEmbedFile)
  uploadEmbedFileRef.current = uploadEmbedFile

  useEffect(() => {
    return registerSurfaceDropExecutor({
      action: 'link',
      target: { type: NOTE_EDITOR_DROP_TYPE, noteId },
      execute: async (linkCommand, input) => {
        const { clientX, clientY } = input
        const { editor } = useNoteEditorStore.getState()
        if (!editor) return

        const links = linkCommand.items.map((item) => {
          const pathParts = getMinDisambiguationPath(item, allItemsRef.current, itemsMapRef.current)
          const itemName = item.name.trim() || 'Untitled'
          const finalPathParts = pathParts.length === 0 ? [itemName] : pathParts
          const path = finalPathParts.join('/')
          const linkText = finalPathParts.length > 1 ? `${path}|${itemName}` : path
          return `[[${linkText}]]`
        })
        if (links.length === 0) return

        const { editor: currentEditor, provider: currentProvider } = useNoteEditorStore.getState()
        const currentTiptap = currentEditor?._tiptapEditor
        if (!currentTiptap) return
        const posResult = currentTiptap.view.posAtCoords({
          left: clientX,
          top: clientY,
        })
        if (!posResult) return

        currentTiptap.chain().focus().insertContentAt(posResult.pos, links.join('\n')).run()
        await currentProvider?.flushUpdates()
      },
    })
  }, [noteId])

  useEffect(() => {
    return registerSurfaceDropExecutor({
      action: 'noteEmbed',
      target: { type: NOTE_EDITOR_DROP_TYPE, noteId },
      execute: async (embedCommand, input) => {
        const { editor, provider } = useNoteEditorStore.getState()
        if (!editor) return

        const inserted = insertSidebarItemEmbedBlocks(
          editor,
          embedCommand.items.map((item) => item._id),
          input,
        )
        if (inserted) {
          focusNoteEditorAtDropPoint(editor, input)
          await provider?.flushUpdates()
        }
      },
    })
  }, [noteId])

  useEffect(() => {
    return registerExternalFileDropExecutor({
      target: { type: NOTE_EDITOR_DROP_TYPE, noteId },
      execute: async (dropResult, input) => {
        if (dropResult.files.length === 0) return { handled: false }

        const uploadedIds: Array<Id<'sidebarItems'>> = []
        for (const { file } of dropResult.files) {
          try {
            const result = await uploadEmbedFileRef.current(file)
            if (result) uploadedIds.push(result.id)
          } catch (error) {
            handleError(error, 'Failed to upload file to note')
          }
        }
        if (uploadedIds.length === 0) return { handled: false }

        const { editor, provider } = useNoteEditorStore.getState()
        if (!editor) return { handled: false }

        const inserted = insertSidebarItemEmbedBlocks(editor, uploadedIds, input)
        if (!inserted) return { handled: false }
        focusNoteEditorAtDropPoint(editor, input)
        await provider?.flushUpdates()

        return {
          handled: true,
          unhandledDropResult:
            dropResult.rootFolders.length > 0
              ? { files: [], rootFolders: dropResult.rootFolders }
              : undefined,
        }
      },
    })
  }, [noteId])
}
