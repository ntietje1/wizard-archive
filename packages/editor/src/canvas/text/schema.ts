import { BlockNoteSchema } from '@blocknote/core'
import type { InlineContentSpecs, PartialBlock } from '@blocknote/core'
import {
  commonRichTextBlockSpecs,
  commonRichTextInlineContentSpecs,
  createCommonRichTextStyleSpecs,
  renderRichTextColorStyle,
} from '../../rich-text/blocknote/common-schema'

export const canvasTextEditorSchema = BlockNoteSchema.create({
  blockSpecs: commonRichTextBlockSpecs,
  inlineContentSpecs: commonRichTextInlineContentSpecs as InlineContentSpecs,
  styleSpecs: createCommonRichTextStyleSpecs({
    parse: (element) =>
      element.tagName === 'SPAN' && element.style.color ? element.style.color : undefined,
    render: renderRichTextColorStyle,
    toExternalHTML: renderRichTextColorStyle,
  }),
})

export type CanvasTextPartialBlock = PartialBlock<
  typeof canvasTextEditorSchema.blockSchema,
  typeof canvasTextEditorSchema.inlineContentSchema,
  typeof canvasTextEditorSchema.styleSchema
>
