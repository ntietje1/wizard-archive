import {
  BlockNoteSchema,
  COLORS_DEFAULT,
  createStyleSpec,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultProps,
  defaultStyleSpecs,
} from '@blocknote/core'
import type {
  Block,
  BlockNoteEditor,
  BlockSpecs,
  InlineContent,
  InlineContentSpecs,
  PartialBlock,
  PartialInlineContent,
  StyleSpecs,
} from '@blocknote/core'

// remove link from inline content specs
const { link: _link, ...remainingInlineContentSpecs } = defaultInlineContentSpecs

export const customInlineContentSpecs = {
  ...remainingInlineContentSpecs,
} as InlineContentSpecs

const textColorStyleSpec = createStyleSpec(
  {
    propSchema: 'string',
    type: 'textColor',
  },
  {
    parse: (element) => {
      if (element.tagName === 'SPAN' && element.style.color) {
        return element.style.color
      }

      return undefined
    },
    render: (value) => renderTextColorStyle(value),
    toExternalHTML: (value) => renderTextColorStyle(value),
  },
)

function renderTextColorStyle(value: string | undefined) {
  const span = document.createElement('span')
  if (value && value !== defaultProps.textColor.default) {
    span.style.color = COLORS_DEFAULT[value]?.text ?? value
  }

  return {
    contentDOM: span,
    dom: span,
  }
}

export const customStyleSpecs = {
  ...defaultStyleSpecs,
  textColor: textColorStyleSpec,
} satisfies StyleSpecs

export const customBlockSpecs = {
  ...defaultBlockSpecs,
} as BlockSpecs

export const editorSchema = BlockNoteSchema.create({
  blockSpecs: customBlockSpecs,
  inlineContentSpecs: customInlineContentSpecs,
  styleSpecs: customStyleSpecs,
})

export type CustomBlockSchema = typeof editorSchema.blockSchema
export type CustomInlineContentSchema = typeof editorSchema.inlineContentSchema
export type CustomStyleSchema = typeof editorSchema.styleSchema

export type CustomBlock = Block<CustomBlockSchema, CustomInlineContentSchema, CustomStyleSchema>

export type CustomPartialBlock = PartialBlock<
  CustomBlockSchema,
  CustomInlineContentSchema,
  CustomStyleSchema
>

export type CustomInlineContent = InlineContent<CustomInlineContentSchema, CustomStyleSchema>

export type CustomPartialInlineContent = PartialInlineContent<
  CustomInlineContentSchema,
  CustomStyleSchema
>

export type CustomBlockNoteEditor = BlockNoteEditor<
  CustomBlockSchema,
  CustomInlineContentSchema,
  CustomStyleSchema
>
