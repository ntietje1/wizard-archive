import { COLORS_DEFAULT, defaultProps } from '@blocknote/core'
import { createCustomInlineContentSpecs } from './document/schema-factory'
import { createNoteStyleSpecs } from './document/style-specs'
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
      element.dataset.valueInline = 'true'
      element.textContent = getValueInlineText(inlineContent.props)
      return { dom: element }
    },
    toExternalHTML: (inlineContent: { props: Partial<NoteValueProps> }) => ({
      dom: renderValueInlineExternalElement(inlineContent.props),
    }),
  },
})

export const noteStyleSpecs = createNoteStyleSpecs({
  textColor: {
    parse: (element) =>
      element.tagName === 'SPAN' && element.style.color ? element.style.color : undefined,
    render: renderTextColor,
    toExternalHTML: renderTextColor,
  },
})

function renderTextColor(value: string | undefined) {
  const element = document.createElement('span')
  if (value && value !== defaultProps.textColor.default) {
    element.style.color = COLORS_DEFAULT[value]?.text ?? value
  }
  return { contentDOM: element, dom: element }
}
