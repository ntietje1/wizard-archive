import {
  parseValueInlineExternalElement,
  renderValueInlineExternalElement,
} from '../values/external-format'
import type { NoteValueProps } from '../values/schema'

function renderHeadlessSpec(): never {
  throw new Error('Headless BlockNote schema cannot render DOM content')
}

export const headlessRenderers = {
  embedBlock: renderHeadlessSpec,
  valueInline: {
    parse: parseValueInlineExternalElement,
    render: renderHeadlessSpec,
    toExternalHTML: (inlineContent: { props: Partial<NoteValueProps> }) => ({
      dom: renderValueInlineExternalElement(inlineContent.props),
    }),
  },
  textColor: {
    parse: (element: HTMLElement) => {
      if (element.tagName === 'SPAN' && element.style.color) {
        return element.style.color
      }

      return undefined
    },
    render: renderHeadlessSpec,
  },
}
