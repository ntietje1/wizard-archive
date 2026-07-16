import { createCustomInlineContentSpecs } from './document/schema-factory'
import {
  createCommonRichTextStyleSpecs,
  renderRichTextColorStyle,
} from '../rich-text/blocknote/common-schema'
import {
  getValueInlineText,
  parseValueInlineExternalElement,
  renderValueInlineExternalElement,
} from './values/external-format'
import type { NoteValueProps } from './values/schema'

export const noteInlineContentSpecs = createCustomInlineContentSpecs({
  valueInline: {
    parse: parseValueInlineExternalElement,
    render: (inlineContent: { props: Partial<NoteValueProps> }) => {
      const element = document.createElement('span')
      element.className = 'note-value-inline'
      element.textContent = getValueInlineText(inlineContent.props)
      return { dom: element }
    },
    toExternalHTML: (inlineContent: { props: Partial<NoteValueProps> }) => ({
      dom: renderValueInlineExternalElement(inlineContent.props),
    }),
  },
})

export const noteStyleSpecs = createCommonRichTextStyleSpecs({
  parse: (element) =>
    element.tagName === 'SPAN' && element.style.color ? element.style.color : undefined,
  render: renderRichTextColorStyle,
  toExternalHTML: renderRichTextColorStyle,
})
