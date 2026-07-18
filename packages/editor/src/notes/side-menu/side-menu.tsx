import { SideMenu } from '@blocknote/react'
import { useState } from 'react'
import { BlockDragHandleButton } from '../../rich-text/side-menu/block-drag-handle-button'
import type {
  RichTextSideMenuBlock,
  RichTextSideMenuEditor,
} from '../../rich-text/side-menu/block-drag-handle-button'
import { ShareSideMenuButton } from './share-side-menu-button'
import type { SideMenuProps } from '@blocknote/react'
import { duplicateNoteBlock } from './drag-handle/duplicate-note-block'
import type { NoteBlockNoteEditor } from '../note-editor-schema'

export function NoteSideMenu(props: SideMenuProps) {
  const [dragHandleMenuOpen, setDragHandleMenuOpen] = useState(false)

  return (
    <SideMenu {...props}>
      <ShareSideMenuButton tooltipDisabled={dragHandleMenuOpen} />
      <BlockDragHandleButton
        menuOpen={dragHandleMenuOpen}
        onDuplicate={duplicateBlock}
        onMenuOpenChange={setDragHandleMenuOpen}
        variant="note"
      />
    </SideMenu>
  )
}

function duplicateBlock(editor: RichTextSideMenuEditor, block: RichTextSideMenuBlock) {
  duplicateNoteBlock(
    editor as NoteBlockNoteEditor,
    block as NoteBlockNoteEditor['document'][number],
  )
}
