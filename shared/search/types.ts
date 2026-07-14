import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'

export interface BlockSearchResult<
  BlockType extends string = string,
  BlockNoteId extends string = string,
> {
  blockNoteId: BlockNoteId
  noteId: ResourceId
  plainText: string
  type: BlockType
}
