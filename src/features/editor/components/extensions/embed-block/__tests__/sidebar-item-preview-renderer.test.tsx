import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SidebarItemPreviewRenderer } from '../sidebar-item-preview-renderer'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'
import type { NoteWithContent } from 'shared/notes/types'

vi.mock('~/features/editor/components/raw-note-content', () => ({
  RawNoteContent: (props: { className?: string; fillHeight?: boolean }) => (
    <div className={props.fillHeight ? 'note-editor-fill-height' : undefined}>
      <div className={props.className} data-testid="raw-note-content" />
    </div>
  ),
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
  it('preserves embedded note styling hooks for static note previews', () => {
    render(<SidebarItemPreviewRenderer item={createNoteItem()} allowInnerScroll={false} />)

    const wrapper = screen.getByTestId('embed-note-content-wrapper')
    expect(wrapper).toHaveClass('canvas-rich-text-editor', 'h-full', 'pt-2')
    expect(wrapper).toHaveAttribute('data-embedded-note-mode', 'readonly')
    expect(
      screen.getByTestId('raw-note-content').closest('.note-editor-scroll-content'),
    ).not.toBeNull()
    expect(
      screen.getByTestId('raw-note-content').closest('.note-editor-fill-height'),
    ).not.toBeNull()
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
