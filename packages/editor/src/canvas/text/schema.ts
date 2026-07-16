import {
  BlockNoteSchema,
  COLORS_DEFAULT,
  createStyleSpec,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultProps,
  defaultStyleSpecs,
} from '@blocknote/core'
import type { InlineContentSpecs, PartialBlock, StyleSpecs } from '@blocknote/core'

const canvasTextBlockSpecs = {
  paragraph: defaultBlockSpecs.paragraph,
  heading: defaultBlockSpecs.heading,
  bulletListItem: defaultBlockSpecs.bulletListItem,
  numberedListItem: defaultBlockSpecs.numberedListItem,
  checkListItem: defaultBlockSpecs.checkListItem,
  quote: defaultBlockSpecs.quote,
  codeBlock: defaultBlockSpecs.codeBlock,
}

const canvasTextInlineContentSpecs = { text: defaultInlineContentSpecs.text }

const canvasTextColorStyleSpec = createStyleSpec(
  { propSchema: 'string', type: 'textColor' } as const,
  {
    parse: (element) =>
      element.tagName === 'SPAN' && element.style.color ? element.style.color : undefined,
    render: renderCanvasTextColorStyle,
    toExternalHTML: renderCanvasTextColorStyle,
  },
)

export const canvasTextEditorSchema = BlockNoteSchema.create({
  blockSpecs: canvasTextBlockSpecs,
  inlineContentSpecs: canvasTextInlineContentSpecs as InlineContentSpecs,
  styleSpecs: {
    ...defaultStyleSpecs,
    textColor: canvasTextColorStyleSpec,
  } satisfies StyleSpecs,
})

type CanvasTextBlockSchema = typeof canvasTextEditorSchema.blockSchema
type CanvasTextInlineContentSchema = typeof canvasTextEditorSchema.inlineContentSchema
type CanvasTextStyleSchema = typeof canvasTextEditorSchema.styleSchema

export type CanvasTextPartialBlock = PartialBlock<
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
  if (color) dom.style.color = color
  return { contentDOM: dom, dom }
}
