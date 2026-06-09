import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SidebarItemPreviewRenderer } from '../sidebar-item-preview-renderer'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'
import type { NoteWithContent } from 'shared/notes/types'

const embeddedNoteBlockPreviewContent = vi.hoisted(() =>
  vi.fn(() => <div data-testid="embedded-note" />),
)

vi.mock('~/features/previews/components/embedded-note-block-preview-content', () => ({
  EmbeddedNoteBlockPreviewContent: embeddedNoteBlockPreviewContent,
}))

vi.mock('~/features/editor/components/viewer/folder/folder-list-content-simple', () => ({
  FolderListContentSimple: () => null,
}))

vi.mock('~/features/editor/components/viewer/map/map-image-preview', () => ({
  MapImagePreview: () => null,
}))

vi.mock('~/features/previews/components/canvas-thumbnail-preview', () => ({
  CanvasThumbnailPreview: () => null,
}))

vi.mock('~/features/previews/components/file-media-embed-content', () => ({
  FileMediaEmbedContent: () => null,
}))

describe('SidebarItemPreviewRenderer', () => {
  it('routes note previews through the static embedded note block renderer', () => {
    const note = createNoteItem()

    render(<SidebarItemPreviewRenderer item={note} allowInnerScroll={false} />)

    expect(screen.getByTestId('embedded-note')).toBeInTheDocument()
    expect(embeddedNoteBlockPreviewContent).toHaveBeenCalledWith(
      {
        allowInnerScroll: false,
        note,
      },
      undefined,
    )
  })
})

function createNoteItem(overrides: Partial<NoteWithContent> = {}): NoteWithContent {
  return {
    ...createNote({ _id: testId<'sidebarItems'>('note-1') }),
    ancestors: [],
    content: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
    ...overrides,
  }
}
