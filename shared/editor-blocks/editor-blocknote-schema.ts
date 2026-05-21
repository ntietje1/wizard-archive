import { BlockNoteSchema } from '@blocknote/core'
import {
  createCustomInlineContentSpecs,
  createCustomStyleSpecs,
  customBlockSpecs,
} from './editor-blocknote-spec-factory'

function renderHeadlessSpec(): never {
  throw new Error('Headless editor schema cannot render DOM content')
}

const headlessRenderers = {
  valueInline: { render: renderHeadlessSpec },
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

export const customInlineContentSpecs = createCustomInlineContentSpecs({
  valueInline: headlessRenderers.valueInline,
})

export const customStyleSpecs = createCustomStyleSpecs({
  textColor: headlessRenderers.textColor,
})

export const headlessEditorSchema = BlockNoteSchema.create({
  blockSpecs: customBlockSpecs,
  inlineContentSpecs: customInlineContentSpecs,
  styleSpecs: customStyleSpecs,
})
