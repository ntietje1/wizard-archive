import type { Id } from '../_generated/dataModel'
import type { ShareStatus } from '../blockShares/types'
import type { ConvexValidatorFields } from '../common/types'
import type { NoteValueProps } from '../../shared/note-values/types'
import type { BlockType } from '../../shared/blockTypes'

export type { BlockType } from '../../shared/blockTypes'

export type BlockNoteId = string

export type BlockProps = Record<string, string | number | boolean>

export type InlineContentItem =
  | {
      type: 'text'
      text: string
      styles?: {
        bold?: boolean
        italic?: boolean
        underline?: boolean
        strike?: boolean
        code?: boolean
        textColor?: string
        backgroundColor?: string
      }
    }
  | {
      type: 'value'
      props: NoteValueProps
      content?: undefined
    }

export type InlineContent = Array<InlineContentItem>
export type CustomInlineContent = InlineContentItem

export type TableContent = {
  type: 'tableContent'
  columnWidths: Array<number | null>
  headerRows?: number
  headerCols?: number
  rows: Array<{
    cells: Array<
      | Array<InlineContentItem>
      | {
          type: 'tableCell'
          content: Array<InlineContentItem>
          props?: Record<string, string | number | boolean | null>
        }
    >
  }>
}

export type FlatBlockContent = {
  type: BlockType
  props: BlockProps
  content?: InlineContent | TableContent
}

export type CustomBlock = {
  id: BlockNoteId
  type: BlockType
  props: BlockProps
  content?: InlineContent | TableContent
  children?: Array<CustomBlock>
}

export type CustomPartialBlock = Partial<Omit<CustomBlock, 'children'>> & {
  children?: Array<CustomPartialBlock>
}

export type EditorBlockInput = Omit<CustomBlock, 'children'> & {
  children?: Array<unknown>
}

export type BlockShareInfo = {
  blockNoteId: BlockNoteId
  shareStatus: ShareStatus
  sharedMemberIds: Array<Id<'campaignMembers'>>
}

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export type Heading = {
  blockNoteId: BlockNoteId
  text: string
  level: HeadingLevel
  normalizedText: string
}

export type Block = ConvexValidatorFields<'blocks'> & {
  noteId: Id<'sidebarItems'>
  blockNoteId: BlockNoteId
  position: number | null
  parentBlockId: BlockNoteId | null
  depth: number
  type: BlockType
  props: BlockProps
  content?: InlineContent | TableContent | null
  inlineContent: InlineContent | null
  plainText: string
  campaignId: Id<'campaigns'>
  shareStatus: ShareStatus | null
}
