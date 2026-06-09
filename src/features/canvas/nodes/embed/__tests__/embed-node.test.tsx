import { act, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { EmbedNode } from '../embed-node'
import { EMBED_NODE_MIN_SIZE } from '../embed-node-size'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { createCanvasEngine } from '../../../system/canvas-engine'
import { AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK } from '~/features/embeds/utils/embed-media'
import {
  DOCUMENT_EMBED_ASPECT_RATIO_HEIGHT,
  DOCUMENT_EMBED_ASPECT_RATIO_WIDTH,
} from '~/features/embeds/utils/document-embed-layout'
import type { EmbedMediaLayout } from '~/features/embeds/utils/embed-media'
import { testId } from '~/test/helpers/test-id'

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
const contentItemState = vi.hoisted((): { data: Record<string, unknown> } => ({
  data: {},
}))
const contentItemQuerySequence = vi.hoisted(
  (): {
    values: Array<{
      data: Record<string, unknown> | null | undefined
      error: unknown
      isLoading: boolean
    }>
  } => ({
    values: [],
  }),
)
const activeItemsState = vi.hoisted(() => ({
  itemsMap: new Map<string, Record<string, unknown>>(),
  status: 'success' as 'pending' | 'error' | 'success',
}))

vi.mock('~/features/previews/components/sidebar-item-preview-content', () => ({
  SidebarItemPreviewContent: (props: unknown) => {
    sidebarItemPreviewSpy(props)
    return <div data-testid="shared-sidebar-item-preview">shared-preview</div>
  },
}))

vi.mock('../embedded-canvas-content', () => ({
  EmbeddedCanvasContent: (props: unknown) => {
    embeddedCanvasSpy(props)
    return <div data-testid="embedded-canvas-content">embedded-canvas</div>
  },
}))

vi.mock('~/features/previews/components/file-media-embed-content', () => ({
  FileMediaEmbedContent: (props: {
    allowInnerScroll?: boolean
    onMediaLayout?: (layout: EmbedMediaLayout) => void
  }) => {
    fileMediaEmbedSpy(props)
    return <div data-testid="shared-file-media-embed">shared-file-media</div>
  },
}))

vi.mock('../embedded-map-content', () => ({
  EmbeddedMapContent: (props: unknown) => {
    embeddedMapSpy(props)
    return <div data-testid="embedded-map-content">embedded-map</div>
  },
}))

vi.mock('../embed-note-content', () => ({
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

vi.mock('~/features/embeds/hooks/use-embed-drop-target', () => ({
  useEmbedDropTarget: useEmbedDropTargetMock,
}))

vi.mock('~/features/embeds/hooks/use-embed-upload', () => ({
  useEmbedUpload: () => ({
    uploadEmbedFile: vi.fn(),
  }),
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

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => activeItemsState,
}))

vi.mock('~/features/sidebar/hooks/useSidebarItemById', () => ({
  useSidebarItemById: () =>
    contentItemQuerySequence.values.shift() ?? {
      data: contentItemState.data,
      error: null,
      isLoading: false,
    },
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaignId: 'campaign_1',
    isDm: true,
  }),
}))

vi.mock('~/features/sidebar/stores/sidebar-ui-store', () => ({
  useSidebarUIStore: (
    selector: (state: { viewAsPlayer: null; setViewAsPlayer: () => void }) => unknown,
  ) => selector({ viewAsPlayer: null, setViewAsPlayer: vi.fn() }),
}))

vi.mock('~/features/campaigns/hooks/useCampaignMembers', () => ({
  useCampaignMembers: () => ({
    data: [],
  }),
}))

vi.mock('../../shared/canvas-node-surface-style', () => ({
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
    activeItemsState.itemsMap = new Map([
      ['canvas-1', { name: 'Canvas Item' }],
      ['file-1', { name: 'File Item' }],
      ['map-1', { name: 'Map Item' }],
      ['note-1', { name: 'Note Item' }],
    ])
    activeItemsState.status = 'success'
    contentItemState.data = {
      _id: 'canvas-1',
      type: SIDEBAR_ITEM_TYPES.canvases,
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
    contentItemQuerySequence.values = []
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
      nodeId: 'node-1',
      canvasId: 'canvas-1',
      previewUrl: 'canvas.png',
      alt: 'Canvas Item',
    })
    expect(sidebarItemPreviewSpy).not.toHaveBeenCalled()
  })

  it('renders canvas embeds from the canvas-resolved item when shared embed lookup is pending', () => {
    contentItemQuerySequence.values = [
      {
        data: {
          _id: 'canvas-1',
          type: SIDEBAR_ITEM_TYPES.canvases,
          name: 'Canvas Item',
          previewUrl: 'canvas.png',
        },
        error: null,
        isLoading: false,
      },
      {
        data: null,
        error: null,
        isLoading: true,
      },
    ]

    renderEmbedNode()

    expect(screen.getByTestId('embedded-canvas-content')).toBeInTheDocument()
    expect(screen.queryByText('Embedded item unavailable')).not.toBeInTheDocument()
  })

  it('renders map embeds through the dedicated embedded map renderer in interactive mode', () => {
    contentItemState.data = {
      _id: 'map-1',
      type: SIDEBAR_ITEM_TYPES.gameMaps,
      name: 'Map Item',
      imageUrl: 'map.png',
      pins: [],
    }
    renderEmbedNode('node-1', 'map-1')

    expect(screen.getByTestId('embedded-map-content')).toBeInTheDocument()
    expect(embeddedMapSpy).toHaveBeenCalledWith({
      nodeId: 'node-1',
      map: {
        _id: 'map-1',
        type: SIDEBAR_ITEM_TYPES.gameMaps,
        name: 'Map Item',
        imageUrl: 'map.png',
        pins: [],
      },
    })
    expect(sidebarItemPreviewSpy).not.toHaveBeenCalled()
  })

  it('renders file embeds through the shared media embed renderer in interactive mode', () => {
    contentItemState.data = {
      _id: 'file-1',
      type: SIDEBAR_ITEM_TYPES.files,
      name: 'File Item',
      contentType: 'application/pdf',
      downloadUrl: 'document.pdf',
      previewUrl: 'preview.png',
    }
    renderEmbedNode('node-1', 'file-1')

    expect(screen.getByTestId('shared-file-media-embed')).toBeInTheDocument()
    expect(fileMediaEmbedSpy).toHaveBeenCalledWith({
      name: 'File Item',
      contentType: 'application/pdf',
      downloadUrl: 'document.pdf',
      previewUrl: 'preview.png',
      allowInnerScroll: false,
      onMediaLayout: expect.any(Function),
    })
    expect(sidebarItemPreviewSpy).not.toHaveBeenCalled()
  })

  it('locks resolved PDF file embeds to the document aspect ratio before the PDF reports dimensions', async () => {
    contentItemState.data = {
      _id: 'file-1',
      type: SIDEBAR_ITEM_TYPES.files,
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
      _id: 'file-1',
      type: SIDEBAR_ITEM_TYPES.files,
      name: 'File Item',
      contentType: 'application/pdf',
      downloadUrl: 'document.pdf',
      previewUrl: 'preview.png',
    }
    editableSessionState.isExclusivelySelected = true

    renderEmbedNode('node-1', 'file-1')

    expect(fileMediaEmbedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        allowInnerScroll: true,
      }),
    )
  })

  it('stores the reported media aspect ratio so file embeds resize locked', () => {
    contentItemState.data = {
      _id: 'file-1',
      type: SIDEBAR_ITEM_TYPES.files,
      name: 'File Item',
      contentType: 'image/png',
      downloadUrl: 'image.png',
      previewUrl: null,
    }
    renderEmbedNode('node-1', 'file-1')

    const props = fileMediaEmbedSpy.mock.calls[0]?.[0] as {
      onMediaLayout?: (layout: EmbedMediaLayout) => void
    }
    act(() => {
      props.onMediaLayout?.({ kind: 'intrinsicAspectRatio', aspectRatio: 2 })
    })

    expect(canvasRuntimeState.patchNodeData).toHaveBeenCalledWith(
      new Map([['node-1', { lockedAspectRatio: 2 }]]),
    )
  })

  it('uses fixed-height horizontal resizing for audio file embeds', () => {
    contentItemState.data = {
      _id: 'file-1',
      type: SIDEBAR_ITEM_TYPES.files,
      name: 'Audio Item',
      contentType: 'audio/mpeg',
      downloadUrl: 'audio.mp3',
      previewUrl: null,
    }
    renderEmbedNode('node-1', 'file-1', { zoom: 1 }, { lockedAspectRatio: 2 })

    const props = fileMediaEmbedSpy.mock.calls[0]?.[0] as {
      onMediaLayout?: (layout: EmbedMediaLayout) => void
    }
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
      _id: 'file-1',
      type: SIDEBAR_ITEM_TYPES.files,
      name: 'Audio Item',
      contentType: 'audio/mpeg',
      downloadUrl: 'audio.mp3',
      previewUrl: null,
    }
    renderEmbedNode('node-1', 'file-1')

    const props = fileMediaEmbedSpy.mock.calls[0]?.[0] as {
      onMediaLayout?: (layout: EmbedMediaLayout) => void
    }
    act(() => {
      props.onMediaLayout?.({ kind: 'fixedHeight', height: AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK })
    })
    const renderCountAfterFirstReport = fileMediaEmbedSpy.mock.calls.length
    canvasRuntimeState.patchNodeData.mockClear()
    canvasRuntimeState.resizeNode.mockClear()

    const latestProps = fileMediaEmbedSpy.mock.lastCall?.[0] as {
      onMediaLayout?: (layout: EmbedMediaLayout) => void
    }
    act(() => {
      latestProps.onMediaLayout?.({
        kind: 'fixedHeight',
        height: AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK,
      })
    })

    expect(fileMediaEmbedSpy).toHaveBeenCalledTimes(renderCountAfterFirstReport)
    expect(canvasRuntimeState.patchNodeData).not.toHaveBeenCalled()
    expect(canvasRuntimeState.resizeNode).not.toHaveBeenCalled()
  })

  it('resets reported media layout when the embed target changes', () => {
    contentItemState.data = {
      _id: 'file-1',
      type: SIDEBAR_ITEM_TYPES.files,
      name: 'Audio Item',
      contentType: 'audio/mpeg',
      downloadUrl: 'audio.mp3',
      previewUrl: null,
    }
    const view = renderEmbedNodeHarness('node-1', 'file-1')

    const props = fileMediaEmbedSpy.mock.calls[0]?.[0] as {
      onMediaLayout?: (layout: EmbedMediaLayout) => void
    }
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
      _id: 'note-1',
      type: SIDEBAR_ITEM_TYPES.notes,
      name: 'Note Item',
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }
    view.rerender(
      <CanvasEngineProvider engine={view.engine}>
        <EmbedNode {...createEmbedNodeProps('node-1', 'note-1', {})} />
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
    expect(sidebarItemPreviewSpy).toHaveBeenCalledWith({
      item: {
        _id: 'canvas-1',
        type: SIDEBAR_ITEM_TYPES.canvases,
        name: 'Canvas Item',
        previewUrl: 'canvas.png',
      },
    })
    expect(embeddedCanvasSpy).not.toHaveBeenCalled()
  })

  it('falls back to the shared read-only preview path for nested embedded maps', () => {
    renderModeState.interactive = false
    contentItemState.data = {
      _id: 'map-1',
      type: SIDEBAR_ITEM_TYPES.gameMaps,
      name: 'Map Item',
      imageUrl: 'map.png',
      pins: [],
    }
    renderEmbedNode('node-1', 'map-1')

    expect(screen.getByTestId('shared-sidebar-item-preview')).toBeInTheDocument()
    expect(sidebarItemPreviewSpy).toHaveBeenCalledWith({
      item: {
        _id: 'map-1',
        type: SIDEBAR_ITEM_TYPES.gameMaps,
        name: 'Map Item',
        imageUrl: 'map.png',
        pins: [],
      },
    })
    expect(embeddedMapSpy).not.toHaveBeenCalled()
  })

  it('keeps the shared media renderer for read-only nested embedded files', () => {
    renderModeState.interactive = false
    contentItemState.data = {
      _id: 'file-1',
      type: SIDEBAR_ITEM_TYPES.files,
      name: 'File Item',
      contentType: 'application/pdf',
      downloadUrl: 'document.pdf',
      previewUrl: 'preview.png',
    }
    renderEmbedNode('node-1', 'file-1')

    expect(screen.getByTestId('shared-file-media-embed')).toBeInTheDocument()
    expect(fileMediaEmbedSpy).toHaveBeenCalledWith({
      name: 'File Item',
      contentType: 'application/pdf',
      downloadUrl: 'document.pdf',
      previewUrl: 'preview.png',
      allowInnerScroll: false,
      onMediaLayout: expect.any(Function),
    })
    expect(sidebarItemPreviewSpy).not.toHaveBeenCalled()
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
      _id: 'note-1',
      type: SIDEBAR_ITEM_TYPES.notes,
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
      _id: 'note-1',
      type: SIDEBAR_ITEM_TYPES.notes,
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
      _id: 'canvas-1',
      type: SIDEBAR_ITEM_TYPES.canvases,
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
      _id: 'note-1',
      type: SIDEBAR_ITEM_TYPES.notes,
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

    expect(screen.getByText('You do not have access to this embedded item')).toBeInTheDocument()
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
  engine.setDocumentSnapshot({
    nodes: [
      {
        id,
        type: 'embed',
        data: {},
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
        <EmbedNode {...createEmbedNodeProps(id, sidebarItemId, data)} />
      </CanvasEngineProvider>,
    ),
  }
}

function createEmbedNodeProps(
  id: string,
  sidebarItemId: string,
  data: Record<string, unknown>,
): Parameters<typeof EmbedNode>[0] {
  return {
    id,
    data: {
      target: { kind: 'sidebarItem', sidebarItemId: testId<'sidebarItems'>(sidebarItemId) },
      ...data,
    },
    dragging: false,
  } as unknown as Parameters<typeof EmbedNode>[0]
}
