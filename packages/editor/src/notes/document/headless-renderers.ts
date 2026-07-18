import {
  parseValueInlineExternalElement,
  renderValueInlineExternalElement,
} from '../values/external-format'
import {
  parseNoteResourceLinkExternalElement,
  renderNoteResourceLinkExternalElement,
} from '../links/resource-link-external'
import type { NoteResourceLinkProps } from '../links/resource-link-model'
import type { NoteValueProps } from '../values/schema'

function renderHeadlessSpec(): never {
  throw new Error('Headless BlockNote schema cannot render DOM content')
}

export const headlessRenderers = {
  embedBlock: renderHeadlessSpec,
  resourceLink: {
    parse: parseNoteResourceLinkExternalElement,
    render: renderHeadlessSpec,
    toExternalHTML: (inlineContent: { props: Partial<NoteResourceLinkProps> }) => ({
      dom: renderNoteResourceLinkExternalElement(inlineContent.props),
    }),
  },
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
