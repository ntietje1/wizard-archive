import { COLORS_DEFAULT, defaultProps } from '@blocknote/core'
import {
  createCustomInlineContentSpecs,
  createCustomStyleSpecs,
} from '../../../shared/editor-blocknote-spec-factory'

function renderValueInline(inlineContent: { props: { slug?: string } }) {
  const element = document.createElement('span')
  element.textContent = inlineContent.props.slug || 'value'
  element.dataset.valueInline = 'true'
  return { dom: element }
}

function renderValueInlineExternalHtml(inlineContent: { props: { slug?: string } }) {
  const element = document.createElement('span')
  element.textContent = inlineContent.props.slug || 'value'
  return { dom: element }
}

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

export const customInlineContentSpecs = createCustomInlineContentSpecs({
  valueInline: {
    render: renderValueInline,
    toExternalHTML: renderValueInlineExternalHtml,
  },
})

export const customStyleSpecs = createCustomStyleSpecs({
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
