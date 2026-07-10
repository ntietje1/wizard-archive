import { createElement } from 'react'
import { EmbeddedNoteBlockPreviewContent } from './embedded-note-block-preview-content'
import type { ReactNode } from 'react'
import type { NoteItemWithContent } from '../../notes/item-contract'
import type { EmbeddedNoteContentSource } from '../runtime'

type EmbeddedNotePreviewRenderProps = {
  note: NoteItemWithContent
  allowInnerScroll: boolean
}

export type EmbeddedNotePreviewRenderer = (props: EmbeddedNotePreviewRenderProps) => ReactNode

export function createEmbeddedNotePreviewRenderer({
  source,
}: {
  source: EmbeddedNoteContentSource
}): EmbeddedNotePreviewRenderer {
  return ({ allowInnerScroll, note }: EmbeddedNotePreviewRenderProps): ReactNode =>
    createElement(EmbeddedNoteBlockPreviewContent, {
      allowInnerScroll,
      embeddedNoteContentSource: source,
      note,
    })
}
