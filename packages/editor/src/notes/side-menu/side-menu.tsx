import { SideMenu } from '@blocknote/react'
import { useState } from 'react'
import { BlockDragHandleButton } from '../../rich-text/side-menu/block-drag-handle-button'
import type {
  RichTextBlockMenuBlock,
  RichTextBlockMenuEditor,
} from '../../rich-text/block-menu/block-menu'
import { ShareSideMenuButton } from './share-side-menu-button'
import type { SideMenuProps } from '@blocknote/react'
import { duplicateNoteBlock } from './drag-handle/duplicate-note-block'
import type { NoteBlockNoteEditor } from '../note-editor-schema'
import { useNoteResourceRuntime } from '../use-note-resource-runtime'
import { copyNoteBlockLink } from '../block-link'
import type { NoteBlockId } from '../../resources/domain-id'

export function NoteSideMenu(props: SideMenuProps) {
  const [dragHandleMenuOpen, setDragHandleMenuOpen] = useState(false)
  const resources = useNoteResourceRuntime()
  const sourceResourceId = resources.sourceResourceId

  return (
    <SideMenu {...props}>
      <ShareSideMenuButton tooltipDisabled={dragHandleMenuOpen} />
      <BlockDragHandleButton
        menuOpen={dragHandleMenuOpen}
        onCopyLink={
          sourceResourceId
            ? (block) => {
                void copyNoteBlockLink(sourceResourceId, block.id as NoteBlockId, resources.report)
              }
            : undefined
        }
        onDuplicate={duplicateBlock}
        onMenuOpenChange={setDragHandleMenuOpen}
        variant="note"
      />
    </SideMenu>
  )
}

function duplicateBlock(editor: RichTextBlockMenuEditor, block: RichTextBlockMenuBlock) {
  duplicateNoteBlock(
    editor as NoteBlockNoteEditor,
    block as NoteBlockNoteEditor['document'][number],
  )
}
