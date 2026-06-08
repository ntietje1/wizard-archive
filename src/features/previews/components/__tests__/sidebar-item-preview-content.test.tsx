import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { SidebarItemPreviewContent } from '../sidebar-item-preview-content'
import type { CanvasWithContent } from 'shared/canvases/types'
import type { FileWithContent } from 'shared/files/types'
import type { FolderWithContent } from 'shared/folders/types'
import type { GameMapWithContent } from 'shared/game-maps/types'
import type { NoteWithContent } from 'shared/notes/types'
import {
  createFile,
  createFolder,
  createGameMap,
  createNote,
} from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

const embeddedNoteSpy = vi.hoisted(() => vi.fn())
const folderPreviewSpy = vi.hoisted(() => vi.fn())
const mapPreviewSpy = vi.hoisted(() => vi.fn())
const filePreviewSpy = vi.hoisted(() => vi.fn())
const canvasPreviewSpy = vi.hoisted(() => vi.fn())

vi.mock('~/features/embeds/components/embedded-note-content', () => ({
  EmbeddedNoteContent: (props: unknown) => {
    embeddedNoteSpy(props)
    return <div>note-preview</div>
  },
}))

vi.mock('~/features/editor/components/viewer/folder/folder-list-content-simple', () => ({
  FolderListContentSimple: (props: unknown) => {
    folderPreviewSpy(props)
    return <div>folder-preview</div>
  },
}))

vi.mock('~/features/editor/components/viewer/map/map-image-preview', () => ({
  MapImagePreview: (props: unknown) => {
    mapPreviewSpy(props)
    return <div>map-preview</div>
  },
}))

vi.mock('~/features/editor/components/viewer/file/file-preview', () => ({
  FilePreview: (props: unknown) => {
    filePreviewSpy(props)
    return <div>file-preview</div>
  },
}))

vi.mock('../canvas-thumbnail-preview', () => ({
  CanvasThumbnailPreview: (props: unknown) => {
    canvasPreviewSpy(props)
    return <div>canvas-preview</div>
  },
}))

describe('SidebarItemPreviewContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes note previews to the read-only note preview', () => {
    const note = createNoteItem()

    render(<SidebarItemPreviewContent item={note} />)

    expect(screen.getByText('note-preview')).toBeInTheDocument()
    expect(embeddedNoteSpy).toHaveBeenCalledWith({
      note,
      editable: false,
      allowInnerScroll: true,
      constrained: false,
    })
  })

  it('passes note previews whole to NoteContent so it owns visibility filtering', () => {
    const note = createNoteItem({
      content: [{ id: 'block-1', type: 'paragraph' }] as NoteWithContent['content'],
    })

    render(<SidebarItemPreviewContent item={note} />)

    expect(embeddedNoteSpy).toHaveBeenCalledWith({
      note,
      editable: false,
      allowInnerScroll: true,
      constrained: false,
    })
  })

  it('passes embedded note preview constraints to note previews', () => {
    const note = createNoteItem()

    render(<SidebarItemPreviewContent item={note} allowInnerScroll={false} constrainNotePreview />)

    expect(embeddedNoteSpy).toHaveBeenCalledWith({
      note,
      editable: false,
      allowInnerScroll: false,
      constrained: true,
    })
  })

  it('lets explicitly sized embeds make note previews fill their available height', () => {
    const note = createNoteItem()

    render(
      <SidebarItemPreviewContent
        item={note}
        allowInnerScroll={false}
        constrainNotePreview
        fillAvailableHeight
      />,
    )

    expect(embeddedNoteSpy).toHaveBeenCalledWith({
      note,
      editable: false,
      allowInnerScroll: false,
      constrained: false,
    })
  })

  it('routes folder previews to the simple folder preview', () => {
    render(<SidebarItemPreviewContent item={createFolderItem()} />)

    expect(screen.getByText('folder-preview')).toBeInTheDocument()
    expect(folderPreviewSpy).toHaveBeenCalledWith({ folderId: 'folder-1' })
  })

  it('routes map previews to the map image preview', () => {
    render(<SidebarItemPreviewContent item={createMapItem()} />)

    expect(screen.getByText('map-preview')).toBeInTheDocument()
    expect(mapPreviewSpy).toHaveBeenCalledWith({ imageUrl: 'map.png' })
  })

  it('routes file previews to the file preview component', () => {
    render(<SidebarItemPreviewContent item={createFileItem()} />)

    expect(screen.getByText('file-preview')).toBeInTheDocument()
    expect(filePreviewSpy).toHaveBeenCalledWith({
      downloadUrl: 'file.png',
      contentType: 'image/png',
      previewUrl: 'preview.png',
      alt: 'Handout',
    })
  })

  it('routes canvas previews to the shared thumbnail preview', () => {
    render(<SidebarItemPreviewContent item={createCanvasItem()} />)

    expect(screen.getByText('canvas-preview')).toBeInTheDocument()
    expect(canvasPreviewSpy).toHaveBeenCalledWith({
      previewUrl: 'canvas.png',
      alt: 'Battle Map',
      objectFit: 'contain',
    })
  })

  it('uses a filling canvas thumbnail for explicitly sized embeds', () => {
    render(<SidebarItemPreviewContent item={createCanvasItem()} fillAvailableHeight />)

    expect(screen.getByText('canvas-preview')).toBeInTheDocument()
    expect(canvasPreviewSpy).toHaveBeenCalledWith({
      previewUrl: 'canvas.png',
      alt: 'Battle Map',
      objectFit: 'cover',
    })
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

function createFolderItem(overrides: Partial<FolderWithContent> = {}): FolderWithContent {
  return {
    ...createFolder({ _id: testId<'sidebarItems'>('folder-1') }),
    ancestors: [],
    ...overrides,
  }
}

function createMapItem(overrides: Partial<GameMapWithContent> = {}): GameMapWithContent {
  return {
    ...createGameMap({ _id: testId<'sidebarItems'>('map-1'), imageUrl: 'map.png' }),
    ancestors: [],
    pins: [],
    ...overrides,
  }
}

function createFileItem(overrides: Partial<FileWithContent> = {}): FileWithContent {
  return {
    ...createFile({
      _id: testId<'sidebarItems'>('file-1'),
      name: 'Handout',
      downloadUrl: 'file.png',
      previewUrl: 'preview.png',
      contentType: 'image/png',
    }),
    ancestors: [],
    ...overrides,
  }
}

function createCanvasItem(overrides: Partial<CanvasWithContent> = {}): CanvasWithContent {
  const { type: _type, ...baseItem } = createNote({
    _id: testId<'sidebarItems'>('canvas-1'),
    name: 'Battle Map',
    previewUrl: 'canvas.png',
  })

  return {
    ...baseItem,
    type: SIDEBAR_ITEM_TYPES.canvases,
    ancestors: [],
    ...overrides,
  }
}
