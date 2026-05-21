import type { WithoutSystemFields } from 'convex/server'
import type { Doc, Id } from '../_generated/dataModel'
import type {
  BlockNoteId,
  BlockType,
  FlatBlockContent,
  InlineContent,
  TableContent,
} from '../../shared/editor-blocks/types'
import type { ShareStatus } from '../../shared/editor-blocks/share-status'

export type BlockShareInfo = {
  blockNoteId: BlockNoteId
  shareStatus: ShareStatus
  sharedMemberIds: Array<Id<'campaignMembers'>>
}

type PersistedBlockCommon = {
  blockNoteId: BlockNoteId
  position: number | null
  parentBlockId: BlockNoteId | null
  depth: number
  plainText: string
}

type InlineBlockType = Exclude<BlockType, 'table'>

type PersistedInlineBlock = {
  [Type in InlineBlockType]: {
    type: Type
    props: Extract<FlatBlockContent, { type: Type }>['props']
    content?: InlineContent | null
    inlineContent: InlineContent | null
  }
}[InlineBlockType]

type PersistedTableBlock = {
  type: 'table'
  props: Extract<FlatBlockContent, { type: 'table' }>['props']
  content?: TableContent | null
  inlineContent: null
}

export type PersistedFlatBlock = PersistedBlockCommon & (PersistedInlineBlock | PersistedTableBlock)

export type BlockInsert = WithoutSystemFields<Doc<'blocks'>>

export type Block = Doc<'blocks'>
