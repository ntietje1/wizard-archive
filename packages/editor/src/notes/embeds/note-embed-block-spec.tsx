import { createReactBlockSpec } from '@blocknote/react'
import { parseSerializedAuthoredDestination } from '../../resources/authored-destination'
import { embedBlockConfig } from '../document/schema-factory'
import { ExternalNoteEmbedHtml, NoteEmbedBlock } from './note-embed-block'

const NOTE_EMBED_HTML_ATTRIBUTE = 'data-note-embed-destination'

export const noteEmbedBlockSpec = createReactBlockSpec(embedBlockConfig, {
  parse: parseNoteEmbedHtml,
  render: NoteEmbedBlock,
  toExternalHTML: ExternalNoteEmbedHtml,
})()

function parseNoteEmbedHtml(element: HTMLElement) {
  const destination = element.getAttribute(NOTE_EMBED_HTML_ATTRIBUTE)
  if (!destination || !parseSerializedAuthoredDestination(destination)) return undefined
  return {
    destination,
    previewAspectRatio: parsePositiveNumber(
      element.getAttribute('data-note-embed-preview-aspect-ratio'),
    ),
    previewHeight: parsePositiveNumber(element.getAttribute('data-note-embed-preview-height')),
    previewWidth: parsePositiveNumber(element.getAttribute('data-note-embed-preview-width')),
  }
}

function parsePositiveNumber(value: string | null) {
  if (!value) return undefined
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : undefined
}
