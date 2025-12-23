import type {
  Block,
  BlockSchemaFromSpecs,
  InlineContentSchemaFromSpecs,
  StyleSchemaFromSpecs,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from '@blocknote/core'
import type { TagInlineSpecType } from '../tags/editorSpecs'

export type CustomInlineContentSpecs = typeof defaultInlineContentSpecs &
  TagInlineSpecType
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
