import { useEffect, useRef } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import { NOTE_EDITOR_DROP_TYPE, canDropFilesOnTarget } from '~/features/dnd/utils/drop-target-data'
import { registerSurfaceDropExecutor } from '~/features/dnd/utils/surface-drop-command'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useExternalDropTarget } from '~/features/dnd/hooks/useExternalDropTarget'
import { useFilteredSidebarItems } from '~/features/sidebar/hooks/useFilteredSidebarItems'
import { getMinDisambiguationPath } from 'shared/links/resolution'
import { useNoteEditorStore } from '~/features/editor/stores/note-editor-store'
import { registerExternalFileDropExecutor } from '~/features/dnd/utils/external-file-drop-command'
import { blockPropsFromEmbedTargetWithDefaultPreview } from '~/features/editor/components/extensions/embed-block/embed-block-targets'
import { sidebarItemEmbedTarget } from '~/features/embeds/utils/embed-targets'
import { useEmbedUpload } from '~/features/embeds/hooks/use-embed-upload'
import { handleError } from '~/shared/utils/logger'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import { focusEditorViewAtNearestPoint } from '~/features/editor/utils/note-editor-focus'
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model'

type NoteDropInput = {
  clientX: number
  clientY: number
}

function insertSidebarItemEmbedBlocks(
  editor: CustomBlockNoteEditor,
  sidebarItemIds: Array<Id<'sidebarItems'>>,
  input: NoteDropInput,
) {
  const dropPlacement = getNoteEditorBlockDropPlacement(editor, input)
  if (!dropPlacement) return false

  editor.insertBlocks(
    sidebarItemIds.map((sidebarItemId) => ({
      type: 'embed' as const,
      props: blockPropsFromEmbedTargetWithDefaultPreview(sidebarItemEmbedTarget(sidebarItemId)),
    })),
    dropPlacement.referenceBlock,
    dropPlacement.placement,
  )
  return true
}

function getNoteEditorBlockDropPlacement(editor: CustomBlockNoteEditor, input: NoteDropInput) {
  const view = editor._tiptapEditor.view
  const position = view?.posAtCoords({
    left: input.clientX,
    top: input.clientY,
  })

  if (view && position) {
    const placement = getBlockDropPlacementAtPosition(editor, view.state.doc.resolve(position.pos))
    if (placement) return placement
  }

  const fallbackBlock = editor.getTextCursorPosition().block ?? getLastEditorBlock(editor)
  return fallbackBlock
    ? {
        placement: 'after' as const,
        referenceBlock: fallbackBlock,
      }
    : null
}

function getBlockDropPlacementAtPosition(editor: CustomBlockNoteEditor, position: ResolvedPos) {
  for (let depth = position.depth; depth >= 0; depth -= 1) {
    const blockId = getBlockId(position.node(depth))
    const referenceBlock = blockId ? editor.getBlock(blockId) : undefined
    if (!referenceBlock) continue

    const start = depth === 0 ? 0 : position.before(depth)
    const end = depth === 0 ? position.node(depth).nodeSize : position.after(depth)
    return {
      placement:
        position.pos - start <= end - position.pos ? ('before' as const) : ('after' as const),
      referenceBlock,
    }
  }

  return null
}

function getBlockId(node: ProseMirrorNode) {
  const id = node.attrs.id
  return typeof id === 'string' ? id : null
}

function getLastEditorBlock(editor: CustomBlockNoteEditor) {
  const lastBlock = editor.document[editor.document.length - 1]
  return lastBlock ? editor.getBlock(lastBlock.id) : undefined
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

  const { data: allItems, itemsMap } = useFilteredSidebarItems()
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
