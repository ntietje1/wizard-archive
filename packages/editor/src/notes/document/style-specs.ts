import { createStyleSpec, defaultStyleSpecs } from '@blocknote/core'
import type { CustomStyleImplementation, StyleSpecs } from '@blocknote/core'

type NoteTextColorStyleConfig = {
  propSchema: 'string'
  type: 'textColor'
}

type NoteStyleRenderers = {
  textColor: CustomStyleImplementation<NoteTextColorStyleConfig>
}

const NOTE_TEXT_COLOR_STYLE_CONFIG = {
  propSchema: 'string',
  type: 'textColor',
} satisfies NoteTextColorStyleConfig

export function createNoteStyleSpecs(renderers: NoteStyleRenderers) {
  const textColorStyleSpec = createStyleSpec(NOTE_TEXT_COLOR_STYLE_CONFIG, renderers.textColor)
  return {
    ...defaultStyleSpecs,
    textColor: textColorStyleSpec,
  } satisfies StyleSpecs
}
