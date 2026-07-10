import type { SidebarItemId } from '../common/ids'

export interface BlockSearchResult<
  BlockType extends string = string,
  BlockNoteId extends string = string,
> {
  blockNoteId: BlockNoteId
  noteId: SidebarItemId
  plainText: string
  type: BlockType
}
