import { act, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { RESOURCE_TYPES } from '../../../../workspace/items-persistence-contract'
import type { AnyItemWithContent } from '../../../../workspace/items'
import { EmbedNode } from '../embed-node'
import { EMBED_NODE_MIN_SIZE } from '../../../embed-node-size'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { createCanvasEngine } from '../../../system/canvas-engine'
import { ResourceContentSourceProvider } from '../../../../filesystem/resource-content-context'
import { AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK } from '../../../../embeds/utils/media'
import {
  DOCUMENT_EMBED_ASPECT_RATIO_HEIGHT,
  DOCUMENT_EMBED_ASPECT_RATIO_WIDTH,
} from '../../../../embeds/utils/document-layout'
import type { EmbedMediaLayout } from '../../../../embeds/utils/media'
import { testId } from '../../../../test/id'
import type { ResourcePreviewSurface } from '../../../../previews/resource-preview-surface'
import type {
  ResourceContentSource,
  ResourceContentState,
} from '../../../../filesystem/resource-content-source'

const sidebarItemPreviewSpy = vi.hoisted(() => vi.fn())
const embeddedCanvasSpy = vi.hoisted(() => vi.fn())
const embeddedMapSpy = vi.hoisted(() => vi.fn())
const embedNoteSpy = vi.hoisted(() => vi.fn())
const fileMediaEmbedSpy = vi.hoisted(() => vi.fn())
const resizableNodeWrapperSpy = vi.hoisted(() => vi.fn())
const documentEmbedAspectRatio = Number(
  (DOCUMENT_EMBED_ASPECT_RATIO_WIDTH / DOCUMENT_EMBED_ASPECT_RATIO_HEIGHT).toFixed(6),
)
const setEditingEmbedId = vi.hoisted(() => vi.fn())
const renderModeState = vi.hoisted(() => ({
  interactive: true,
}))
const editableSessionState = vi.hoisted(() => ({
  isExclusivelySelected: false,
}))
const useEmbedDropTargetMock = vi.hoisted(() =>
  vi.fn(() => ({ isDropTarget: false, isFileDropTarget: false })),
)
const canvasRuntimeState = vi.hoisted(() => ({
  canvasId: 'source-canvas',
  flushUpdates: vi.fn(),
  patchNodeData: vi.fn(),
  resizeNode: vi.fn(),
}))
const contentItemState = vi.hoisted((): { data: Record<string, unknown> | undefined } => ({
  data: {},
}))
const embedSidebarItemStateQueue = vi.hoisted(
  (): {
    index: number
    values: Array<ResourceContentState>
  } => ({
    index: 0,
    values: [],
  }),
)

type ResourcePreviewSurfaceProps = Parameters<typeof ResourcePreviewSurface>[0]

vi.mock('../../../../previews/resource-preview-surface', () => {
  return {
    ResourcePreviewSurface: (props: ResourcePreviewSurfaceProps) => {
      const renderPreview = props.renderPreview
      sidebarItemPreviewSpy(props)
      if (props.item.type === RESOURCE_TYPES.notes && renderPreview) {
        return renderPreview({
          kind: 'note',
          item: props.item as Extract<AnyItemWithContent, { type: typeof RESOURCE_TYPES.notes }>,
          allowInnerScroll: props.allowInnerScroll ?? true,
        })
      }
      if (props.item.type === RESOURCE_TYPES.canvases && renderPreview) {
        const rendered = renderPreview({
          kind: 'canvas',
          item: props.item as Extract<AnyItemWithContent, { type: typeof RESOURCE_TYPES.canvases }>,
          fillAvailableHeight: props.fillAvailableHeight ?? false,
        })
        if (rendered !== undefined) return rendered
      }
      if (props.item.type === RESOURCE_TYPES.gameMaps && renderPreview) {
        const rendered = renderPreview({
          kind: 'map',
          item: props.item as Extract<AnyItemWithContent, { type: typeof RESOURCE_TYPES.gameMaps }>,
          onMediaLayout: props.onMediaLayout,
        })
        if (rendered !== undefined) return rendered
      }
      return <div data-testid="shared-sidebar-item-preview">shared-preview</div>
    },
  }
})

vi.mock('../../../../embeds/components/embedded-canvas-content', () => ({
  EmbeddedCanvasContent: (props: unknown) => {
    embeddedCanvasSpy(props)
    return <div data-testid="embedded-canvas-content">embedded-canvas</div>
  },
}))

vi.mock('../../../../files/viewer/file-media-embed-content', () => ({
  FileMediaEmbedContent: (props: {
    allowInnerScroll?: boolean
    onMediaLayout?: (layout: EmbedMediaLayout) => void
  }) => {
    fileMediaEmbedSpy(props)
    return <div data-testid="shared-file-media-embed">shared-file-media</div>
  },
}))

vi.mock('../../../../embeds/components/embedded-map-content', () => ({
  EmbeddedMapContent: (props: unknown) => {
    embeddedMapSpy(props)
    return <div data-testid="embedded-map-content">embedded-map</div>
  },
}))

vi.mock('../../../../notes/embeds/canvas-note-content', () => ({
  EmbedNoteContent: (props: unknown) => {
    embedNoteSpy(props)
    return <div data-testid="embed-note-content">embedded-note</div>
  },
}))

vi.mock('../../../runtime/providers/canvas-runtime', () => ({
  useCanvasDocumentRuntime: () => ({
    canvasId: canvasRuntimeState.canvasId,
    documentWriter: {
      patchNodeData: canvasRuntimeState.patchNodeData,
      resizeNode: canvasRuntimeState.resizeNode,
    },
    provider: {
      flushUpdates: canvasRuntimeState.flushUpdates,
    },
  }),
  useCanvasInteractionRuntime: () => ({
    canEdit: true,
    editSession: {
      editingEmbedId: null,
      setEditingEmbedId,
    },
  }),
  useCanvasViewportRuntime: () => ({
    domRuntime: {
      registerNodeSurfaceElement: vi.fn(() => vi.fn()),
    },
  }),
}))

vi.mock('../../../../embeds/hooks/use-drop-target', () => ({
  useEmbedDropTarget: useEmbedDropTargetMock,
}))

vi.mock('../../../runtime/providers/use-canvas-render-mode', () => ({
  useIsInteractiveCanvasRenderMode: () => renderModeState.interactive,
}))

vi.mock('../../shared/resizable-node-wrapper', () => ({
  ResizableNodeWrapper: (props: {
    children: ReactNode
    chrome: ReactNode
    minHeight?: number
    minWidth?: number
    nodeType: string
  }) => {
    resizableNodeWrapperSpy(props)
    return (
      <div>
        {props.chrome}
        {props.children}
      </div>
    )
  },
}))

vi.mock('../../shared/use-canvas-editable-node-session', () => ({
  useCanvasEditableNodeSession: () => ({
    editable: false,
    isSelected: false,
    isExclusivelySelected: editableSessionState.isExclusivelySelected,
    handleDoubleClick: vi.fn(),
    handleActivated: vi.fn(),
    pendingActivationRef: { current: null },
  }),
}))

vi.mock('../../shared/canvas-node-connection-handles', () => ({
  CanvasNodeConnectionHandles: () => null,
}))

vi.mock('../../shared/canvas-floating-formatting-toolbar', () => ({
  CanvasFloatingFormattingToolbar: () => null,
}))

vi.mock('../../../node-surface-style', () => ({
  getCanvasNodeDefaultTextColor: (data?: { textColor?: string }) =>
    data?.textColor ?? 'var(--foreground)',
  getCanvasNodeTextStyle: () => ({
    color: 'var(--foreground)',
  }),
  getCanvasNodeSurfaceStyle: () => ({}),
  normalizeCanvasNodeSurfaceStyleData: (data?: { textColor?: string }) => ({
    textColor: data?.textColor ?? 'var(--foreground)',
    backgroundColor: 'var(--background)',
    backgroundOpacity: 100,
    borderStroke: 'var(--border)',
    borderOpacity: 100,
    borderWidth: 1,
  }),
}))

describe('EmbedNode', () => {
  beforeEach(() => {
    renderModeState.interactive = true
    editableSessionState.isExclusivelySelected = false
    canvasRuntimeState.canvasId = 'source-canvas'
    canvasRuntimeState.flushUpdates.mockClear()
    canvasRuntimeState.patchNodeData.mockClear()
    canvasRuntimeState.resizeNode.mockClear()
    setEditingEmbedId.mockClear()
    contentItemState.data = {
      id: 'canvas-1',
      type: RESOURCE_TYPES.canvases,
      name: 'Canvas Item',
      previewUrl: 'canvas.png',
    }
    sidebarItemPreviewSpy.mockReset()
    embeddedCanvasSpy.mockReset()
    fileMediaEmbedSpy.mockReset()
    embeddedMapSpy.mockReset()
    embedNoteSpy.mockReset()
    resizableNodeWrapperSpy.mockReset()
    useEmbedDropTargetMock.mockReset()
    useEmbedDropTargetMock.mockReturnValue({ isDropTarget: false, isFileDropTarget: false })
    embedSidebarItemStateQueue.index = 0
    embedSidebarItemStateQueue.values = []
  })

  it('uses the canvas embed resize minimum', () => {
    renderEmbedNode()

    expect(resizableNodeWrapperSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        minHeight: EMBED_NODE_MIN_SIZE.height,
        minWidth: EMBED_NODE_MIN_SIZE.width,
        nodeType: 'embed',
      }),
    )
  })

  it('shows shared drop target chrome on empty canvas embeds during file drags', () => {
    useEmbedDropTargetMock.mockReturnValue({ isDropTarget: true, isFileDropTarget: true })

    renderEmbedNode('node-1', 'canvas-1', { zoom: 1 }, { target: { kind: 'empty' } })

    expect(useEmbedDropTargetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        embedBlockId: 'node-1',
        sourceItemId: 'source-canvas',
      }),
    )
    expect(screen.getByTestId('embed-empty-state')).toHaveClass(
      'ring-2',
      'ring-inset',
      'ring-drop-target-file',
      'bg-drop-target-fill',
    )
  })

  it('renders canvas embeds through the dedicated embedded canvas renderer in interactive mode', () => {
    renderEmbedNode()

    expect(screen.getByTestId('embedded-canvas-content')).toBeInTheDocument()
    expect(embeddedCanvasSpy).toHaveBeenCalledWith({
      canvasId: 'canvas-1',
      previewUrl: 'canvas.png',
      alt: 'Canvas Item',
    })
    expect(sidebarItemPreviewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        item: expect.objectContaining({ id: 'canvas-1' }),
        mode: 'embed',
      }),
    )
  })

  it('renders the editor loading state while the embed resolver is pending', () => {
    embedSidebarItemStateQueue.values = [
      {
        status: 'loading',
        label: 'Canvas Item',
        item: undefined,
        folderChildren: [],
        isLoading: true,
        error: null,
      },
    ]

    renderEmbedNode()

    expect(screen.getByLabelText('Loading Canvas Item')).toBeInTheDocument()
  })

  it('renders map embeds through the dedicated embedded map renderer in interactive mode', () => {
    contentItemState.data = {
      id: 'map-1',
      type: RESOURCE_TYPES.gameMaps,
      name: 'Map Item',
      imageUrl: 'map.png',
      pins: [],
    }
    renderEmbedNode('node-1', 'map-1')

    expect(screen.getByTestId('embedded-map-content')).toBeInTheDocument()
    expect(embeddedMapSpy).toHaveBeenCalledWith({
      map: {
        id: 'map-1',
        type: RESOURCE_TYPES.gameMaps,
        name: 'Map Item',
        imageUrl: 'map.png',
        pins: [],
      },
      onMediaLayout: expect.any(Function),
    })
    expect(sidebarItemPreviewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        item: expect.objectContaining({ id: 'map-1' }),
        mode: 'embed',
      }),
    )
  })

  it('renders file embeds through the shared media embed renderer in interactive mode', () => {
    contentItemState.data = {
      id: 'file-1',
      type: RESOURCE_TYPES.files,
      name: 'File Item',
      contentType: 'application/pdf',
      downloadUrl: 'document.pdf',
      previewUrl: 'preview.png',
    }
    renderEmbedNode('node-1', 'file-1')

    expect(screen.getByTestId('shared-sidebar-item-preview')).toBeInTheDocument()
    expect(sidebarItemPreviewSpy).toHaveBeenCalledWith(expectedFileEmbedPreviewProps())
    expect(fileMediaEmbedSpy).not.toHaveBeenCalled()
  })

  it('locks resolved PDF file embeds to the document aspect ratio before the PDF reports dimensions', async () => {
    contentItemState.data = {
      id: 'file-1',
      type: RESOURCE_TYPES.files,
      name: 'File Item',
      contentType: 'application/pdf',
      downloadUrl: 'document.pdf',
      previewUrl: 'preview.png',
    }

    renderEmbedNode('node-1', 'file-1')

    expect(resizableNodeWrapperSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        lockedAspectRatio: documentEmbedAspectRatio,
      }),
    )
    await waitFor(() => {
      expect(canvasRuntimeState.patchNodeData).toHaveBeenCalledWith(
        new Map([['node-1', { lockedAspectRatio: documentEmbedAspectRatio }]]),
      )
    })
  })

  it('allows inner scrolling for file embeds only when exclusively selected', () => {
    contentItemState.data = {
      id: 'file-1',
      type: RESOURCE_TYPES.files,
      name: 'File Item',
      contentType: 'application/pdf',
      downloadUrl: 'document.pdf',
      previewUrl: 'preview.png',
    }
    editableSessionState.isExclusivelySelected = true

    renderEmbedNode('node-1', 'file-1')

    expect(sidebarItemPreviewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        allowInnerScroll: true,
        mode: 'embed',
      }),
    )
  })

  it('stores the reported media aspect ratio so file embeds resize locked', () => {
    contentItemState.data = {
      id: 'file-1',
      type: RESOURCE_TYPES.files,
      name: 'File Item',
      contentType: 'image/png',
      downloadUrl: 'image.png',
      previewUrl: null,
    }
    renderEmbedNode('node-1', 'file-1')

    const props = getLastResourcePreviewSurfaceProps()
    act(() => {
      props.onMediaLayout?.({ kind: 'intrinsicAspectRatio', aspectRatio: 2 })
    })

    expect(canvasRuntimeState.patchNodeData).toHaveBeenCalledWith(
      new Map([['node-1', { lockedAspectRatio: 2 }]]),
    )
  })

  it('uses fixed-height horizontal resizing for audio file embeds', () => {
    contentItemState.data = {
      id: 'file-1',
      type: RESOURCE_TYPES.files,
      name: 'Audio Item',
      contentType: 'audio/mpeg',
      downloadUrl: 'audio.mp3',
      previewUrl: null,
    }
    renderEmbedNode('node-1', 'file-1', { zoom: 1 }, { lockedAspectRatio: 2 })

    const props = getLastResourcePreviewSurfaceProps()
    act(() => {
      props.onMediaLayout?.({ kind: 'fixedHeight', height: AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK })
    })

    expect(canvasRuntimeState.patchNodeData).toHaveBeenCalledWith(
      new Map([['node-1', { lockedAspectRatio: null }]]),
    )
    expect(canvasRuntimeState.resizeNode).toHaveBeenCalledWith(
      'node-1',
      320,
      AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK,
      { x: 10, y: 20 },
    )
    expect(resizableNodeWrapperSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        minHeight: AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK,
        minWidth: EMBED_NODE_MIN_SIZE.width,
        resizeAxes: 'horizontal',
        lockedAspectRatio: undefined,
      }),
    )
  })

  it('ignores repeated identical media layout reports', () => {
    contentItemState.data = {
      id: 'file-1',
      type: RESOURCE_TYPES.files,
      name: 'Audio Item',
      contentType: 'audio/mpeg',
      downloadUrl: 'audio.mp3',
      previewUrl: null,
    }
    renderEmbedNode('node-1', 'file-1')

    const props = getLastResourcePreviewSurfaceProps()
    act(() => {
      props.onMediaLayout?.({ kind: 'fixedHeight', height: AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK })
    })
    const renderCountAfterFirstReport = sidebarItemPreviewSpy.mock.calls.length
    canvasRuntimeState.patchNodeData.mockClear()
    canvasRuntimeState.resizeNode.mockClear()

    const latestProps = getLastResourcePreviewSurfaceProps()
    act(() => {
      latestProps.onMediaLayout?.({
        kind: 'fixedHeight',
        height: AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK,
      })
    })

    expect(sidebarItemPreviewSpy).toHaveBeenCalledTimes(renderCountAfterFirstReport)
    expect(canvasRuntimeState.patchNodeData).not.toHaveBeenCalled()
    expect(canvasRuntimeState.resizeNode).not.toHaveBeenCalled()
  })

  it('resets reported media layout when the embed target changes', () => {
    contentItemState.data = {
      id: 'file-1',
      type: RESOURCE_TYPES.files,
      name: 'Audio Item',
      contentType: 'audio/mpeg',
      downloadUrl: 'audio.mp3',
      previewUrl: null,
    }
    const view = renderEmbedNodeHarness('node-1', 'file-1')

    const props = getLastResourcePreviewSurfaceProps()
    act(() => {
      props.onMediaLayout?.({ kind: 'fixedHeight', height: AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK })
    })
    expect(resizableNodeWrapperSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        minHeight: AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK,
        resizeAxes: 'horizontal',
      }),
    )

    contentItemState.data = {
      id: 'note-1',
      type: RESOURCE_TYPES.notes,
      name: 'Note Item',
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }
    view.rerender(
      <CanvasEngineProvider engine={view.engine}>
        <ResourceContentSourceProvider source={TestResourceContentSource}>
          <EmbedNode {...createEmbedNodeProps('node-1', 'note-1', {})} />
        </ResourceContentSourceProvider>
      </CanvasEngineProvider>,
    )

    expect(resizableNodeWrapperSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        minHeight: EMBED_NODE_MIN_SIZE.height,
        resizeAxes: 'both',
        lockedAspectRatio: undefined,
      }),
    )
  })

  it('resets reported media layout when the same target resolves to different content', () => {
    contentItemState.data = {
      id: 'file-1',
      type: RESOURCE_TYPES.files,
      name: 'Audio Item',
      contentType: 'audio/mpeg',
      downloadUrl: 'audio.mp3',
      previewUrl: null,
    }
    const view = renderEmbedNodeHarness('node-1', 'file-1')

    const props = getLastResourcePreviewSurfaceProps()
    act(() => {
      props.onMediaLayout?.({ kind: 'fixedHeight', height: AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK })
    })
    expect(resizableNodeWrapperSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        minHeight: AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK,
        resizeAxes: 'horizontal',
      }),
    )

    contentItemState.data = {
      id: 'file-1',
      type: RESOURCE_TYPES.files,
      name: 'Image Item',
      contentType: 'image/png',
      downloadUrl: 'image.png',
      previewUrl: null,
    }
    view.rerender(
      <CanvasEngineProvider engine={view.engine}>
        <ResourceContentSourceProvider source={TestResourceContentSource}>
          <EmbedNode {...createEmbedNodeProps('node-1', 'file-1', {})} />
        </ResourceContentSourceProvider>
      </CanvasEngineProvider>,
    )

    expect(resizableNodeWrapperSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        minHeight: EMBED_NODE_MIN_SIZE.height,
        resizeAxes: 'both',
        lockedAspectRatio: undefined,
      }),
    )
  })

  it('falls back to the shared read-only preview path for nested embedded canvases', () => {
    renderModeState.interactive = false
    renderEmbedNode()

    expect(screen.getByTestId('shared-sidebar-item-preview')).toBeInTheDocument()
    expect(sidebarItemPreviewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        fillAvailableHeight: true,
        folderChildren: [],
        item: expect.objectContaining({
          id: 'canvas-1',
          type: RESOURCE_TYPES.canvases,
          name: 'Canvas Item',
          previewUrl: 'canvas.png',
        }),
        mode: 'embed',
      }),
    )
    expect(embeddedCanvasSpy).not.toHaveBeenCalled()
  })

  it('falls back to the shared read-only preview path for nested embedded maps', () => {
    renderModeState.interactive = false
    contentItemState.data = {
      id: 'map-1',
      type: RESOURCE_TYPES.gameMaps,
      name: 'Map Item',
      imageUrl: 'map.png',
      pins: [],
    }
    renderEmbedNode('node-1', 'map-1')

    expect(screen.getByTestId('shared-sidebar-item-preview')).toBeInTheDocument()
    expect(sidebarItemPreviewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        fillAvailableHeight: true,
        folderChildren: [],
        item: expect.objectContaining({
          id: 'map-1',
          type: RESOURCE_TYPES.gameMaps,
          name: 'Map Item',
          imageUrl: 'map.png',
          pins: [],
        }),
        mode: 'embed',
      }),
    )
    expect(embeddedMapSpy).not.toHaveBeenCalled()
  })

  it('keeps the shared media renderer for read-only nested embedded files', () => {
    renderModeState.interactive = false
    contentItemState.data = {
      id: 'file-1',
      type: RESOURCE_TYPES.files,
      name: 'File Item',
      contentType: 'application/pdf',
      downloadUrl: 'document.pdf',
      previewUrl: 'preview.png',
    }
    renderEmbedNode('node-1', 'file-1')

    expect(screen.getByTestId('shared-sidebar-item-preview')).toBeInTheDocument()
    expect(sidebarItemPreviewSpy).toHaveBeenCalledWith(expectedFileEmbedPreviewProps())
    expect(fileMediaEmbedSpy).not.toHaveBeenCalled()
  })

  it('inverse-scales the floating name label from the current viewport zoom', () => {
    renderEmbedNode('node-1', 'canvas-1', { zoom: 2 })

    // The base line height is 16px; at zoom=2, inverse scale is 0.5, so the frame
    // height is 16 * 0.5 = 8px, the label scales to 0.5, and its width expands to 200%.
    expect(screen.getByTestId('embed-node-floating-label-frame')).toHaveStyle({
      height: '8px',
      transform: 'translateY(calc(-100% - 3px))',
    })
    expect(screen.getByTestId('embed-node-floating-label')).toHaveStyle({
      lineHeight: '16px',
      transform: 'scale(0.5)',
      transformOrigin: 'left bottom',
      width: '200%',
    })
  })

  it('passes node textColor to embedded note content as the default text color', () => {
    contentItemState.data = {
      id: 'note-1',
      type: RESOURCE_TYPES.notes,
      name: 'Note Item',
      content: [],
    }

    renderEmbedNode('node-1', 'note-1', { zoom: 1 }, { textColor: 'var(--t-purple)' })

    expect(screen.getByTestId('embed-note-content')).toBeInTheDocument()
    expect(embedNoteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        textColor: 'var(--t-purple)',
      }),
    )
  })

  it('uses the document shape as the default size for note embeds without locking resize', async () => {
    contentItemState.data = {
      id: 'note-1',
      type: RESOURCE_TYPES.notes,
      name: 'Note Item',
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }

    renderEmbedNode('node-1', 'note-1', { zoom: 1 }, {}, { width: 320, height: 240 })

    expect(resizableNodeWrapperSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        lockedAspectRatio: undefined,
        resizeAxes: 'both',
      }),
    )
    await waitFor(() => {
      expect(canvasRuntimeState.resizeNode).toHaveBeenCalledWith(
        'node-1',
        240 * documentEmbedAspectRatio,
        240,
        { x: 10, y: 20 },
      )
    })
    expect(canvasRuntimeState.patchNodeData).not.toHaveBeenCalled()
  })

  it('clears stale locked aspect ratios from freeform canvas embeds', async () => {
    contentItemState.data = {
      id: 'canvas-1',
      type: RESOURCE_TYPES.canvases,
      name: 'Canvas Item',
      previewUrl: 'canvas.png',
    }

    renderEmbedNode('node-1', 'canvas-1', { zoom: 1 }, { lockedAspectRatio: 2 })

    expect(resizableNodeWrapperSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        lockedAspectRatio: undefined,
        resizeAxes: 'both',
      }),
    )
    await waitFor(() => {
      expect(canvasRuntimeState.patchNodeData).toHaveBeenCalledWith(
        new Map([['node-1', { lockedAspectRatio: null }]]),
      )
    })
  })

  it('passes embedded notes whole to NoteContent so it owns visibility filtering', () => {
    contentItemState.data = {
      id: 'note-1',
      type: RESOURCE_TYPES.notes,
      name: 'Note Item',
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }

    renderEmbedNode('node-1', 'note-1')

    expect(embedNoteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        note: contentItemState.data,
      }),
    )
    expect(embedNoteSpy.mock.calls[0]?.[0]).not.toHaveProperty('content')
  })

  it('renders the shared unavailable state instead of rich content when an embedded item is not shared', () => {
    contentItemState.data = undefined as unknown as Record<string, unknown>

    renderEmbedNode('node-1', 'canvas-1')

    expect(screen.getByText("This embedded item isn't shared with you")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request Access' })).toBeInTheDocument()
    expect(screen.queryByTestId('embedded-canvas-content')).not.toBeInTheDocument()
    expect(embeddedCanvasSpy).not.toHaveBeenCalled()
  })

  it('renders request-access state when the embed resolver marks the item not shared', () => {
    embedSidebarItemStateQueue.values = [
      {
        status: 'unavailable',
        label: 'Canvas Item',
        item: undefined,
        folderChildren: [],
        isLoading: false,
        error: null,
        availabilityState: {
          status: 'not_shared',
          label: 'Canvas Item',
          message: "This item isn't shared with the current viewer.",
        },
      },
    ]

    renderEmbedNode()

    expect(screen.getByText('Canvas Item')).toBeInTheDocument()
    expect(screen.getByText("This embedded item isn't shared with you")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request Access' })).toBeInTheDocument()
    expect(screen.queryByTestId('embedded-canvas-content')).not.toBeInTheDocument()
    expect(embeddedCanvasSpy).not.toHaveBeenCalled()
  })

  it('renders the recursive unavailable state for canvas self-embeds', () => {
    canvasRuntimeState.canvasId = testId<'sidebarItems'>('canvas-1')

    renderEmbedNode('node-1', 'canvas-1')

    expect(screen.getByText('Recursive embed hidden')).toBeInTheDocument()
    expect(screen.queryByTestId('embedded-canvas-content')).not.toBeInTheDocument()
    expect(embeddedCanvasSpy).not.toHaveBeenCalled()
  })
})

function renderEmbedNode(
  id = 'node-1',
  sidebarItemId = 'canvas-1',
  viewport: { zoom: number } = { zoom: 1 },
  data: Record<string, unknown> = {},
  nodeSize: { height: number; width: number } = { width: 320, height: 180 },
) {
  const { engine: _engine, ...view } = renderEmbedNodeHarness(
    id,
    sidebarItemId,
    viewport,
    data,
    nodeSize,
  )
  return view
}

function renderEmbedNodeHarness(
  id = 'node-1',
  sidebarItemId = 'canvas-1',
  viewport: { zoom: number } = { zoom: 1 },
  data: Record<string, unknown> = {},
  nodeSize: { height: number; width: number } = { width: 320, height: 180 },
) {
  const engine = createCanvasEngine()
  engine.setViewport({ x: 0, y: 0, zoom: viewport.zoom })
  const props = createEmbedNodeProps(id, sidebarItemId, data)
  engine.setDocumentSnapshot({
    nodes: [
      {
        id,
        type: 'embed',
        data: props.data,
        position: { x: 10, y: 20 },
        width: nodeSize.width,
        height: nodeSize.height,
      },
    ],
  })

  return {
    engine,
    ...render(
      <CanvasEngineProvider engine={engine}>
        <ResourceContentSourceProvider source={TestResourceContentSource}>
          <EmbedNode {...props} />
        </ResourceContentSourceProvider>
      </CanvasEngineProvider>,
    ),
  }
}

function getLastResourcePreviewSurfaceProps() {
  const props = sidebarItemPreviewSpy.mock.lastCall?.[0] as
    | { onMediaLayout?: (layout: EmbedMediaLayout) => void }
    | undefined
  if (!props) throw new Error('Expected sidebar item preview surface props')
  return props
}

function expectedFileEmbedPreviewProps() {
  return expect.objectContaining({
    allowInnerScroll: false,
    item: expect.objectContaining({
      id: 'file-1',
      type: RESOURCE_TYPES.files,
      name: 'File Item',
      contentType: 'application/pdf',
      downloadUrl: 'document.pdf',
      previewUrl: 'preview.png',
    }),
    mode: 'embed',
    onMediaLayout: expect.any(Function),
  })
}

function createEmbedNodeProps(
  id: string,
  sidebarItemId: string,
  data: Record<string, unknown>,
): Parameters<typeof EmbedNode>[0] {
  return {
    id,
    data: {
      target: { kind: 'resource', resourceId: testId<'sidebarItems'>(sidebarItemId) },
      ...data,
    },
    dragging: false,
  } as unknown as Parameters<typeof EmbedNode>[0]
}

const TestResourceContentSource: ResourceContentSource = {
  status: 'available',
  ensureContentState: () => undefined,
  getContentState: () => resolveTestResourceContentState(),
  resolveItem: () => null,
}

function resolveTestResourceContentState(): ResourceContentState {
  const queued = embedSidebarItemStateQueue.values[embedSidebarItemStateQueue.index]
  embedSidebarItemStateQueue.index += 1
  if (queued) return queued

  const item = contentItemState.data as AnyItemWithContent | undefined
  if (item) {
    return {
      status: 'ready',
      label: item.name,
      item,
      folderChildren: [],
      isLoading: false,
      error: null,
    }
  }

  return {
    status: 'unavailable',
    label: 'Canvas Item',
    item: undefined,
    folderChildren: [],
    isLoading: false,
    error: null,
    availabilityState: {
      status: 'not_shared',
      label: 'Canvas Item',
      message: "This item isn't shared with the current viewer.",
    },
  }
}
