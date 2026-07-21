import type { ReactNode } from 'react'
import type { NoteBlockId } from '../resources/domain-id'
import { RichTextBlockContextMenu } from '../rich-text/block-menu/block-context-menu'
import type {
  RichTextBlockMenuBlock,
  RichTextBlockMenuEditor,
} from '../rich-text/block-menu/block-menu'
import { copyNoteBlockLink } from './block-link'
import type { NoteBlockNoteEditor } from './note-editor-schema'
import { duplicateNoteBlock } from './side-menu/drag-handle/duplicate-note-block'
import { getBlockShareTargetIds, getBlockShareTitle } from './sharing/block-share-targets'
import { useNoteBlockAccessMenu } from './sharing/note-block-access-menu-context'
import { useNoteResourceRuntime } from './use-note-resource-runtime'

export function NoteBlockContextMenu({
  children,
  editable,
  editor,
}: {
  children: ReactNode
  editable: boolean
  editor: NoteBlockNoteEditor
}) {
  const resources = useNoteResourceRuntime()
  const access = useNoteBlockAccessMenu()
  const sourceResourceId = resources.sourceResourceId
  const copyLink = sourceResourceId
    ? (block: RichTextBlockMenuBlock) => {
        void copyNoteBlockLink(sourceResourceId, block.id as NoteBlockId, resources.report)
      }
    : undefined
  const openVisibility = access
    ? (block: RichTextBlockMenuBlock, position: Readonly<{ x: number; y: number }>) => {
        const blockIds = getBlockShareTargetIds(editor, block.id as NoteBlockId)
        access.open({
          blockIds,
          kind: 'sharing',
          position,
          source: { kind: 'editor' },
          title: getBlockShareTitle(blockIds.length),
        })
      }
    : undefined

  return (
    <RichTextBlockContextMenu
      editor={editor as RichTextBlockMenuEditor}
      enabled={editable}
      onCopyLink={copyLink}
      onDuplicate={duplicateBlock}
      onOpenVisibility={openVisibility}
    >
      {children}
    </RichTextBlockContextMenu>
  )
}

function duplicateBlock(editor: RichTextBlockMenuEditor, block: RichTextBlockMenuBlock) {
  duplicateNoteBlock(
    editor as NoteBlockNoteEditor,
    block as NoteBlockNoteEditor['document'][number],
  )
}
