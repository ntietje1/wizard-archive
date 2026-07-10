import {
  BlockNoteSchema,
  COLORS_DEFAULT,
  createStyleSpec,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultProps,
  defaultStyleSpecs,
} from '@blocknote/core'
import { CANVAS_TEXT_BLOCK_TYPES } from './model'
import type {
  BlockNoteEditor,
  BlockSpecs,
  InlineContentSpecs,
  PartialBlock,
  StyleSpecs,
} from '@blocknote/core'

type CanvasTextColorStyleConfig = {
  propSchema: 'string'
  type: 'textColor'
}

const CANVAS_TEXT_COLOR_STYLE_CONFIG = {
  propSchema: 'string',
  type: 'textColor',
} satisfies CanvasTextColorStyleConfig

const canvasTextBlockSpecs = Object.fromEntries(
  CANVAS_TEXT_BLOCK_TYPES.map((type) => [type, defaultBlockSpecs[type]]),
) as BlockSpecs

const { link: _link, ...canvasTextInlineContentWithoutLinks } = defaultInlineContentSpecs

const canvasTextInlineContentSpecs = canvasTextInlineContentWithoutLinks as InlineContentSpecs

const canvasTextColorStyleSpec = createStyleSpec(CANVAS_TEXT_COLOR_STYLE_CONFIG, {
  parse: (element) => {
    if (element.tagName === 'SPAN' && element.style.color) {
      return element.style.color
    }

    return undefined
  },
  render: renderCanvasTextColorStyle,
  toExternalHTML: renderCanvasTextColorStyle,
})

const canvasTextStyleSpecs = {
  ...defaultStyleSpecs,
  textColor: canvasTextColorStyleSpec,
} satisfies StyleSpecs

export const canvasTextEditorSchema = BlockNoteSchema.create({
  blockSpecs: canvasTextBlockSpecs,
  inlineContentSpecs: canvasTextInlineContentSpecs,
  styleSpecs: canvasTextStyleSpecs,
})

type CanvasTextBlockSchema = typeof canvasTextEditorSchema.blockSchema
type CanvasTextInlineContentSchema = typeof canvasTextEditorSchema.inlineContentSchema
type CanvasTextStyleSchema = typeof canvasTextEditorSchema.styleSchema

export type CanvasTextPartialBlock = PartialBlock<
  CanvasTextBlockSchema,
  CanvasTextInlineContentSchema,
  CanvasTextStyleSchema
>

export type CanvasTextEditor = BlockNoteEditor<
  CanvasTextBlockSchema,
  CanvasTextInlineContentSchema,
  CanvasTextStyleSchema
>

function renderCanvasTextColorStyle(value: string | undefined) {
  const dom = document.createElement('span')
  const color =
    value && value !== defaultProps.textColor.default
      ? (COLORS_DEFAULT[value]?.text ?? value)
      : null

  if (color) {
    dom.style.color = color
  }

  return {
    contentDOM: dom,
    dom,
  }
}
