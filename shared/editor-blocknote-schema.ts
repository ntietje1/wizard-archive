import {
  BlockNoteSchema,
  createInlineContentSpec,
  createStyleSpec,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from '@blocknote/core'
import { noteValueInlineConfig } from './note-values/block-config'
import type { BlockSpecs, InlineContentSpecs, StyleSpecs } from '@blocknote/core'

const { link: _link, ...remainingInlineContentSpecs } = defaultInlineContentSpecs

function renderHeadlessSpec(): never {
  throw new Error('Headless editor schema cannot render DOM content')
}

const valueInlineSpec = createInlineContentSpec(noteValueInlineConfig, {
  render: renderHeadlessSpec,
})

const customInlineContentSpecs = {
  ...remainingInlineContentSpecs,
  value: valueInlineSpec,
} as InlineContentSpecs & {
  value: typeof valueInlineSpec
}

const textColorStyleSpec = createStyleSpec(
  {
    propSchema: 'string',
    type: 'textColor',
  },
  {
    parse: (element) => {
      if (element.tagName === 'SPAN' && element.style.color) {
        return element.style.color
      }

      return undefined
    },
    render: renderHeadlessSpec,
  },
)

const customStyleSpecs = {
  ...defaultStyleSpecs,
  textColor: textColorStyleSpec,
} satisfies StyleSpecs

export const customBlockSpecs = {
  ...defaultBlockSpecs,
} satisfies BlockSpecs

export const headlessEditorSchema = BlockNoteSchema.create({
  blockSpecs: customBlockSpecs,
  inlineContentSpecs: customInlineContentSpecs,
  styleSpecs: customStyleSpecs,
})
