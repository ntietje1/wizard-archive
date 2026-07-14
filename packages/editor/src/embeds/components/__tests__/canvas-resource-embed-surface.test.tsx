import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { CanvasResourceEmbedSurface } from '../canvas-resource-embed-surface'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { canonicalizeResourceItemTitle } from '../../../workspace/items'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../../../workspace/items-persistence-contract'
import type { AnyItem, AnyItemWithContent, FolderItemWithContent } from '../../../workspace/items'
import type {
  NoteDocumentContentSource,
  EmbeddedNoteContentSource,
  NoteEmbedTargetContentSource,
  NoteLinkCreationSource,
  NoteLinkNavigationSource,
  NoteLinkResolutionSource,
  NotePermissionContentSource,
  NotePlaybackContentSource,
  NoteSharingContentSource,
  NoteWikiLinkContentSource,
} from '../../../notes/runtime'
import type {
  NoteValueReferences,
  NoteValueRuntimeStateSource,
} from '../../../notes/value-runtime-model'

vi.mock('../../../notes/embeds/canvas-note-content', () => ({
  EmbedNoteContent: () => <div data-testid="note-embed" />,
}))

vi.mock('../embedded-canvas-content', () => ({
  EmbeddedCanvasContent: () => <div data-testid="canvas-embed" />,
}))

vi.mock('../embedded-map-content', () => ({
  EmbeddedMapContent: () => <div data-testid="map-embed" />,
}))

vi.mock('../../../files/viewer/file-media-embed-content', () => ({
  FileMediaEmbedContent: ({ name }: { name: string }) => <div data-testid="file-embed">{name}</div>,
}))

vi.mock('../../../folders/preview/folder-list-content-simple', () => ({
  FolderListContentSimple: ({ items }: { items: Array<{ id: string; name: string }> }) => {
    return (
      <div data-testid="folder-preview">
        {items.map((item) => (
          <span key={item.id}>{item.name}</span>
        ))}
      </div>
    )
  },
}))

vi.mock('../../../canvas/preview/canvas-thumbnail-preview', () => ({
  CanvasThumbnailPreview: ({ alt }: { alt: string }) => {
    return <div data-testid="canvas-static-preview">{alt}</div>
  },
}))

vi.mock('../../../game-maps/viewer/map-image-preview', () => ({
  MapImagePreview: ({ imageUrl }: { imageUrl: string | null }) => {
    return <div data-testid="map-static-preview">{imageUrl}</div>
  },
}))

describe('CanvasResourceEmbedSurface', () => {
  it('renders note and interactive map embeds through their domain-owned surfaces', () => {
    const { rerender } = renderCanvasResourceEmbedSurface(
      createSidebarItemWithContent({
        id: createSidebarItemId('note-1'),
        name: 'Note',
        parentId: null,
        type: RESOURCE_TYPES.notes,
      }),
    )

    expect(screen.getByTestId('note-embed')).toBeInTheDocument()

    rerender(
      <CanvasResourceEmbedSurface
        {...defaultSurfaceProps}
        item={createSidebarItemWithContent({
          id: createSidebarItemId('map-1'),
          name: 'Map',
          parentId: null,
          type: RESOURCE_TYPES.gameMaps,
        })}
      />,
    )

    expect(screen.getByTestId('map-embed')).toBeInTheDocument()
  })

  it('renders file embeds through the shared file preview behavior', () => {
    const file = createSidebarItemWithContent({
      id: createSidebarItemId('file-1'),
      name: 'File',
      parentId: null,
      type: RESOURCE_TYPES.files,
    })

    renderCanvasResourceEmbedSurface(file)

    expect(screen.getByTestId('file-embed')).toHaveTextContent('File')
  })

  it('wraps non-interactive canvas and map previews as passive static content', () => {
    const canvas = createSidebarItemWithContent({
      id: createSidebarItemId('canvas-1'),
      name: 'Canvas',
      parentId: null,
      type: RESOURCE_TYPES.canvases,
    })
    const { rerender } = renderCanvasResourceEmbedSurface(canvas, {
      interactiveRenderMode: false,
    })

    expect(screen.getByTestId('static-resource-embed-preview')).toHaveClass('pointer-events-none')
    expect(screen.getByTestId('canvas-static-preview')).toHaveTextContent('Canvas')
    expect(screen.queryByTestId('canvas-embed')).not.toBeInTheDocument()

    const map = createSidebarItemWithContent({
      id: createSidebarItemId('map-1'),
      name: 'Map',
      parentId: null,
      type: RESOURCE_TYPES.gameMaps,
      imageUrl: 'map.png',
    })

    rerender(
      <CanvasResourceEmbedSurface
        {...defaultSurfaceProps}
        interactiveRenderMode={false}
        item={map}
      />,
    )

    expect(screen.getByTestId('static-resource-embed-preview')).toHaveClass('pointer-events-none')
    expect(screen.getByTestId('map-static-preview')).toHaveTextContent('map.png')
    expect(screen.queryByTestId('map-embed')).not.toBeInTheDocument()
  })

  it('renders interactive canvas embeds through the embedded canvas surface', () => {
    renderCanvasResourceEmbedSurface(
      createSidebarItemWithContent({
        id: createSidebarItemId('canvas-1'),
        name: 'Canvas',
        parentId: null,
        type: RESOURCE_TYPES.canvases,
      }),
    )

    expect(screen.getByTestId('canvas-embed')).toBeInTheDocument()
  })

  it('renders folder embeds with resolver-provided folder children', () => {
    const folder = createFolderItem()
    const child = createSidebarItem({
      id: createSidebarItemId('note-1'),
      name: 'Note',
      parentId: folder.id,
      type: RESOURCE_TYPES.notes,
    })

    renderCanvasResourceEmbedSurface(folder, { folderChildren: [child] })

    expect(screen.getByTestId('folder-preview')).toBeInTheDocument()
    expect(screen.getByTestId('folder-preview')).toHaveTextContent('Note')
  })
})

function createFolderItem(overrides: Partial<FolderItemWithContent> = {}): FolderItemWithContent {
  return {
    ...createSidebarItem({
      id: createSidebarItemId('folder-1'),
      name: 'Folder',
      parentId: null,
      type: RESOURCE_TYPES.folders,
    }),
    ancestors: [],
    ...overrides,
  } as FolderItemWithContent
}

function createSidebarItem({
  id,
  imageUrl = null,
  name,
  parentId,
  type,
}: {
  id: SidebarItemId
  imageUrl?: string | null
  name: string
  parentId: SidebarItemId | null
  type: AnyItem['type']
}): AnyItem {
  const item = {
    id,
    createdAt: 0,
    name: canonicalizeResourceItemTitle(name),
    iconName: null,
    color: null,
    slug: name.toLowerCase(),
    campaignId: 'campaign-id',
    parentId,
    type,
    allPermissionLevel: null,
    location: RESOURCE_LOCATION.sidebar,
    status: RESOURCE_STATUS.active,
    previewAssetId: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: 'user-id',
    deletionTime: null,
    deletedBy: null,
    shares: [],
    isBookmarked: false,
    myPermissionLevel: 'owner',
    imageUrl,
    previewUrl: null,
    isActive: true,
    isTrashed: false,
  }
  return item as unknown as AnyItem
}

const defaultSurfaceProps = {
  isEditing: false,
  isExclusivelySelected: true,
  interactiveRenderMode: true,
  noteDocumentSource: {} as NoteDocumentContentSource,
  noteEmbeddedNoteContentSource: {} as EmbeddedNoteContentSource,
  noteEmbedTargetSource: {} as NoteEmbedTargetContentSource,
  noteLinkCreationSource: null as NoteLinkCreationSource | null,
  noteLinkNavigationSource: null as NoteLinkNavigationSource | null,
  noteLinkResolutionSource: {} as NoteLinkResolutionSource,
  notePlaybackSource: {} as NotePlaybackContentSource,
  notePermissionSource: {} as NotePermissionContentSource,
  noteSharingSource: {} as NoteSharingContentSource,
  noteValueReferences: {} as NoteValueReferences,
  noteValueStateSource: {} as NoteValueRuntimeStateSource,
  noteWikiLinkSource: {} as NoteWikiLinkContentSource,
  onActivated: vi.fn(),
  onEditorChange: vi.fn(),
  pendingActivationRef: { current: null },
  textColor: null,
} satisfies Omit<Parameters<typeof CanvasResourceEmbedSurface>[0], 'item'>

function renderCanvasResourceEmbedSurface(
  item: AnyItemWithContent,
  overrides: Partial<Omit<Parameters<typeof CanvasResourceEmbedSurface>[0], 'item'>> = {},
) {
  return render(<CanvasResourceEmbedSurface {...defaultSurfaceProps} {...overrides} item={item} />)
}

function createSidebarItemWithContent(args: Parameters<typeof createSidebarItem>[0]) {
  return createSidebarItem(args) as AnyItemWithContent
}

function createSidebarItemId(value: string) {
  return value as SidebarItemId
}
