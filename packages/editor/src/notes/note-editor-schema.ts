import { BlockNoteSchema } from '@blocknote/core'
import type { BlockNoteEditor } from '@blocknote/core'
import { createNoteBlockSpecs } from './document/schema-factory'
import { noteInlineContentSpecs, noteStyleSpecs } from './dom-specs'
import { reactNoteValueInlineSpec } from './values/react-spec'

const noteBlockSpecs = createNoteBlockSpecs({
  renderEmbedBlock: () => {
    const element = document.createElement('div')
    element.className = 'note-embed-placeholder'
    element.textContent = 'Embedded content'
    return { dom: element }
  },
})
const { value: _value, ...noteInlineContentSpecsWithoutValue } = noteInlineContentSpecs

export const noteEditorSchema = BlockNoteSchema.create({
  blockSpecs: noteBlockSpecs,
  inlineContentSpecs: {
    ...noteInlineContentSpecsWithoutValue,
    value: reactNoteValueInlineSpec,
  },
  styleSpecs: noteStyleSpecs,
})

export type NoteBlockNoteEditor = BlockNoteEditor<
  typeof noteEditorSchema.blockSchema,
  typeof noteEditorSchema.inlineContentSchema,
  typeof noteEditorSchema.styleSchema
>
