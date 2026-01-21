import { defaultInlineContentSpecs } from '@blocknote/core'
import type {
  Block,
  BlockSchemaFromSpecs,
  InlineContentSchemaFromSpecs,
  InlineContentSpecs,
  PartialBlock,
  StyleSchemaFromSpecs,
  defaultBlockSpecs,
  defaultStyleSpecs,
} from '@blocknote/core'

// remove link from inline content specs
const { link, ...remainingInlineContentSpecs } = defaultInlineContentSpecs

export const customInlineContentSpecs = {
  ...remainingInlineContentSpecs,
} as InlineContentSpecs

export type CustomInlineContentSpecs = typeof customInlineContentSpecs
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

export type CustomPartialBlock = PartialBlock<
  CustomBlockSchema,
  CustomInlineContentSchema,
  CustomStyleSchema
>
