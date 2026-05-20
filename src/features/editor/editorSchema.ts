import { BlockNoteSchema } from '@blocknote/core'
import {
  customBlockSpecs as baseBlockSpecs,
  customInlineContentSpecs as baseInlineContentSpecs,
  customStyleSpecs,
} from 'convex/notes/editorSpecs'
import { createReactValueInlineSpec } from './value-block/value-block-react-spec'

const { value: _value, ...remainingInlineContentSpecs } = baseInlineContentSpecs

export function createEditorSchema() {
  return BlockNoteSchema.create({
    blockSpecs: baseBlockSpecs,
    inlineContentSpecs: {
      ...remainingInlineContentSpecs,
      value: createReactValueInlineSpec(),
    },
    styleSpecs: customStyleSpecs,
  })
}
