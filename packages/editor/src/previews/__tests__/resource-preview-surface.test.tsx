import type { ResourceId } from '../../resources/domain-id'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { ResourcePreviewSurface } from '../resource-preview-surface'
import type { ResourcePreviewRenderer } from '../resource-preview-surface'
import { getPreviewFallbackCopy, getResourceUnavailableFallbackReason } from '../fallback-policy'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { AnyItem, AnyItemWithContent } from '../../workspace/items'

vi.mock('../../folders/preview/folder-list-content-simple', () => ({
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

vi.mock('../../game-maps/viewer/map-image-preview', () => ({
  MapImagePreview: ({ imageUrl }: { imageUrl: string | null }) => {
    return <img data-testid="map-preview" src={imageUrl ?? ''} alt="Map preview" />
  },
}))

vi.mock('../../files/viewer/file-preview', () => ({
  FilePreview: ({ fileName, previewUrl }: { fileName: string; previewUrl: string | null }) => {
    return (
      <div data-testid="file-preview" data-preview-url={previewUrl ?? ''}>
        {fileName}
      </div>
    )
  },
}))

vi.mock('../../files/viewer/file-media-embed-content', () => ({
  FileMediaEmbedContent: ({
    downloadUrl,
    name,
    previewUrl,
  }: {
    downloadUrl: string | null
    name: string
    previewUrl: string | null
  }) => {
    return (
      <div
        data-testid="file-media-embed-preview"
        data-download-url={downloadUrl ?? ''}
        data-preview-url={previewUrl ?? ''}
      >
        {name}
      </div>
    )
  },
}))

vi.mock('../../canvas/preview/canvas-thumbnail-preview', () => ({
  CanvasThumbnailPreview: ({
    alt,
    objectFit,
    previewUrl,
  }: {
    alt: string
    objectFit: string
    previewUrl: string | null
  }) => {
    return (
      <img
        data-testid="canvas-preview"
        data-object-fit={objectFit}
        src={previewUrl ?? ''}
        alt={alt}
      />
    )
  },
}))

describe('ResourcePreviewSurface', () => {
  it('uses the same owner for static note previews and embedded note previews', () => {
    const note = createItem(RESOURCE_TYPES.notes, 'note-1', 'Note')
    const renderStaticPreview: ResourcePreviewRenderer = (input) => {
      if (input.kind !== 'note') return undefined
      return (
        <div data-testid="static-note-preview" data-inner-scroll={String(input.allowInnerScroll)}>
          {input.item.name}
        </div>
      )
    }
    const renderEmbeddedPreview: ResourcePreviewRenderer = (input) => {
      if (input.kind !== 'note') return undefined
      return (
        <div data-testid="embedded-note-preview" data-inner-scroll={String(input.allowInnerScroll)}>
          {input.item.name}
        </div>
      )
    }

    const { rerender } = render(
      <ResourcePreviewSurface item={note} renderPreview={renderStaticPreview} />,
    )

    expect(screen.getByTestId('static-note-preview')).toHaveTextContent('Note')
    expect(screen.getByTestId('static-note-preview')).toHaveAttribute('data-inner-scroll', 'true')

    rerender(
      <ResourcePreviewSurface
        item={note}
        mode="embed"
        allowInnerScroll={false}
        renderPreview={renderEmbeddedPreview}
      />,
    )

    expect(screen.getByTestId('embedded-note-preview')).toHaveTextContent('Note')
    expect(screen.getByTestId('embedded-note-preview')).toHaveAttribute(
      'data-inner-scroll',
      'false',
    )
  })

  it('uses one preview switch for folders, maps, files, and canvases across preview modes', () => {
    const folder = createItem(RESOURCE_TYPES.folders, 'folder-1', 'Folder')
    const child = createItem(RESOURCE_TYPES.notes, 'note-1', 'Child')
    const map = createItem(RESOURCE_TYPES.gameMaps, 'map-1', 'Map', { imageUrl: 'map.png' })
    const file = createItem(RESOURCE_TYPES.files, 'file-1', 'File', {
      contentType: 'image/png',
      downloadUrl: 'file.png',
      previewUrl: 'preview.png',
    })
    const canvas = createItem(RESOURCE_TYPES.canvases, 'canvas-1', 'Canvas', {
      previewUrl: 'canvas.png',
    })

    const { rerender } = render(<ResourcePreviewSurface item={folder} folderChildren={[child]} />)
    expect(screen.getByTestId('folder-preview')).toHaveTextContent('Child')

    rerender(<ResourcePreviewSurface item={map} />)
    expect(screen.getByTestId('map-preview')).toHaveAttribute('src', 'map.png')

    rerender(<ResourcePreviewSurface item={file} mode="embed" />)
    expect(screen.getByTestId('file-media-embed-preview')).toHaveTextContent('File')
    expect(screen.getByTestId('file-media-embed-preview')).toHaveAttribute(
      'data-download-url',
      'file.png',
    )
    expect(screen.getByTestId('file-media-embed-preview')).toHaveAttribute(
      'data-preview-url',
      'preview.png',
    )

    rerender(<ResourcePreviewSurface item={canvas} fillAvailableHeight />)
    expect(screen.getByTestId('canvas-preview')).toHaveAttribute('alt', 'Canvas')
    expect(screen.getByTestId('canvas-preview')).toHaveAttribute('src', 'canvas.png')
    expect(screen.getByTestId('canvas-preview')).toHaveAttribute('data-object-fit', 'cover')
  })

  it('lets embed callers provide interactive canvas and map renderers from the same surface', () => {
    const map = createItem(RESOURCE_TYPES.gameMaps, 'map-1', 'Map', { imageUrl: 'map.png' })
    const canvas = createItem(RESOURCE_TYPES.canvases, 'canvas-1', 'Canvas', {
      previewUrl: 'canvas.png',
    })
    const renderPreview: ResourcePreviewRenderer = (input) => {
      if (input.kind === 'map') {
        return (
          <div data-testid="interactive-map" data-has-layout={String(Boolean(input.onMediaLayout))}>
            {input.item.name}
          </div>
        )
      }
      if (input.kind === 'canvas') {
        return (
          <div
            data-testid="interactive-canvas"
            data-fill-height={String(input.fillAvailableHeight)}
          >
            {input.item.name}
          </div>
        )
      }
      return undefined
    }
    const onMediaLayout = () => {}

    const { rerender } = render(
      <ResourcePreviewSurface
        item={map}
        mode="embed"
        onMediaLayout={onMediaLayout}
        renderPreview={renderPreview}
      />,
    )

    expect(screen.getByTestId('interactive-map')).toHaveTextContent('Map')
    expect(screen.getByTestId('interactive-map')).toHaveAttribute('data-has-layout', 'true')

    rerender(
      <ResourcePreviewSurface
        item={canvas}
        fillAvailableHeight
        mode="embed"
        renderPreview={renderPreview}
      />,
    )

    expect(screen.getByTestId('interactive-canvas')).toHaveTextContent('Canvas')
    expect(screen.getByTestId('interactive-canvas')).toHaveAttribute('data-fill-height', 'true')
  })
})

describe('preview fallback policy', () => {
  it('keeps shared fallback copy explicit per render surface', () => {
    expect(getPreviewFallbackCopy({ surface: 'embed', reason: 'permission' })).toBe(
      "This embedded item isn't shared with you",
    )
    expect(getPreviewFallbackCopy({ surface: 'search', reason: 'loadError' })).toBe(
      'Failed to load preview. You can still open this result.',
    )
    expect(getPreviewFallbackCopy({ surface: 'history', reason: 'unsupportedSnapshot' })).toBe(
      'Preview not available for this snapshot type.',
    )
  })

  it('maps sidebar availability failures to shared fallback reasons', () => {
    expect(getResourceUnavailableFallbackReason('not_shared')).toBe('permission')
    expect(getResourceUnavailableFallbackReason('trashed')).toBe('trashed')
    expect(getResourceUnavailableFallbackReason('not_found')).toBe('missing')
  })
})

function createItem(
  type: AnyItem['type'],
  id: string,
  name: string,
  fields: Partial<AnyItemWithContent> = {},
): AnyItemWithContent {
  return {
    id: id as ResourceId,
    type,
    name,
    parentId: null,
    order: 0,
    trashed: false,
    icon: null,
    coverImageUrl: null,
    color: null,
    previewUrl: null,
    ancestors: [],
    content: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
    pins: [],
    imageUrl: null,
    downloadUrl: null,
    contentType: null,
    ...fields,
  } as unknown as AnyItemWithContent
}
