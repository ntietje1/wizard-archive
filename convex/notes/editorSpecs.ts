import {
  BlockNoteSchema,
  COLORS_DEFAULT,
  createInlineContentSpec,
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
import { noteValueInlineConfig } from '../../shared/note-values/block-config'
import type { NoteValueProps } from '../../shared/note-values/types'

// remove link from inline content specs
const { link: _link, ...remainingInlineContentSpecs } = defaultInlineContentSpecs

const valueInlineSpec = createInlineContentSpec(noteValueInlineConfig, {
  render: (inlineContent) => {
    const element = document.createElement('span')
    element.textContent = inlineContent.props.slug || 'value'
    element.dataset.valueInline = 'true'
    return { dom: element }
  },
  toExternalHTML: (inlineContent) => {
    const element = document.createElement('span')
    element.textContent = inlineContent.props.slug || 'value'
    return { dom: element }
  },
})

export const customInlineContentSpecs = {
  ...remainingInlineContentSpecs,
  value: valueInlineSpec,
} as InlineContentSpecs & {
  value: typeof valueInlineSpec
}

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
} satisfies BlockSpecs

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

export interface CustomValuePartialInlineContent {
  type: 'value'
  props: NoteValueProps
  content?: undefined
}

export type CustomPartialInlineContent =
  | PartialInlineContent<CustomInlineContentSchema, CustomStyleSchema>
  | Array<CustomValuePartialInlineContent>

type BaseCustomBlockNoteEditor = BlockNoteEditor<
  CustomBlockSchema,
  CustomInlineContentSchema,
  CustomStyleSchema
>

export type CustomBlockNoteEditor = BaseCustomBlockNoteEditor & {
  insertInlineContent(
    content: CustomPartialInlineContent,
    options?: { updateSelection?: boolean },
  ): void
}
