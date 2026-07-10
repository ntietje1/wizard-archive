import { COLORS_DEFAULT, defaultProps } from '@blocknote/core'
import { createCustomInlineContentSpecs } from './document/schema-factory'
import { createNoteStyleSpecs } from './document/style-specs'
import {
  getValueInlineText,
  parseValueInlineExternalElement,
  renderValueInlineExternalElement,
} from './values/external-format'
import type { NoteValueProps } from './values/schema'

function renderValueInline(inlineContent: { props: Partial<NoteValueProps> }) {
  const element = document.createElement('span')
  element.textContent = getValueInlineText(inlineContent.props)
  element.dataset.valueInline = 'true'
  return { dom: element }
}

function renderValueInlineExternalHtml(inlineContent: { props: Partial<NoteValueProps> }) {
  return { dom: renderValueInlineExternalElement(inlineContent.props) }
}

export const noteInlineContentSpecs = createCustomInlineContentSpecs({
  valueInline: {
    parse: parseValueInlineExternalElement,
    render: renderValueInline,
    toExternalHTML: renderValueInlineExternalHtml,
  },
})

export const noteStyleSpecs = createNoteStyleSpecs({
  textColor: {
    parse: (element) => {
      if (element.tagName === 'SPAN' && element.style.color) {
        return element.style.color
      }

      return undefined
    },
    render: renderTextColorStyle,
    toExternalHTML: renderTextColorStyle,
  },
})

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
