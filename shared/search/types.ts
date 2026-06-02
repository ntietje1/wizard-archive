import type { SidebarItemId } from '../common/ids'
import type { BlockNoteId, BlockType } from '../editor-blocks/types'

export interface BlockSearchResult {
  blockNoteId: BlockNoteId
  noteId: SidebarItemId
  plainText: string
  type: BlockType
}
