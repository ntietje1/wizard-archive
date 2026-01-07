import type {
  Block,
  BlockSchemaFromSpecs,
  InlineContentSchemaFromSpecs,
  StyleSchemaFromSpecs,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from '@blocknote/core'
import type { MentionInlineSpecType } from '../mentions/editorSpecs'

export type CustomInlineContentSpecs = typeof defaultInlineContentSpecs &
  MentionInlineSpecType
export type CustomInlineContentSchema =
  InlineContentSchemaFromSpecs<CustomInlineContentSpecs>

export type CustomBlockSpecs = typeof defaultBlockSpecs
export type CustomBlockSchema = BlockSchemaFromSpecs<CustomBlockSpecs>

export type CustomStyleSpecs = typeof defaultStyleSpecs
export type CustomStyleSchema = StyleSchemaFromSpecs<CustomStyleSpecs>

export type CustomBlock = Block<
  CustomBlockSchema,
  CustomInlineContentSchema,
  CustomStyleSchema
>
