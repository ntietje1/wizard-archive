import type {
  Block,
  BlockSchemaFromSpecs,
  InlineContentSchemaFromSpecs,
  PartialBlock,
  StyleSchemaFromSpecs,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from '@blocknote/core'

export type CustomInlineContentSpecs = typeof defaultInlineContentSpecs
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
