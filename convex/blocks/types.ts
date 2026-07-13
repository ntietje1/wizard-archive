import type { WithoutSystemFields } from 'convex/server'
import type { Doc } from '../_generated/dataModel'
import type {
  NoteBlockType,
  NoteBlockContent,
  InlineContent,
  TableContent,
} from '@wizard-archive/editor/notes/document-contract'
import type { NoteBlockId } from '@wizard-archive/editor/resources/domain-id'

type PersistedBlockCommon = {
  blockNoteId: NoteBlockId
  position: number | null
  parentBlockId: NoteBlockId | null
  depth: number
  plainText: string
}

type InlineBlockType = Exclude<NoteBlockType, 'table'>

type PersistedInlineBlock = {
  [Type in InlineBlockType]: {
    type: Type
    props: Extract<NoteBlockContent, { type: Type }>['props']
    content: InlineContent | null
  }
}[InlineBlockType]

type PersistedTableBlock = {
  type: 'table'
  props: Extract<NoteBlockContent, { type: 'table' }>['props']
  content: TableContent | null
}

export type PersistedFlatBlock = PersistedBlockCommon & (PersistedInlineBlock | PersistedTableBlock)

export type BlockInsert = WithoutSystemFields<Doc<'blocks'>>

export type Block = Doc<'blocks'>
