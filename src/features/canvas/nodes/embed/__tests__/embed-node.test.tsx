import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { EmbedNode } from '../embed-node'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { createCanvasEngine } from '../../../system/canvas-engine'
import { testId } from '~/test/helpers/test-id'

const sidebarItemPreviewSpy = vi.hoisted(() => vi.fn())
const embeddedCanvasSpy = vi.hoisted(() => vi.fn())
const embeddedFileSpy = vi.hoisted(() => vi.fn())
const embeddedMapSpy = vi.hoisted(() => vi.fn())
const setEditingEmbedId = vi.hoisted(() => vi.fn())
const renderModeState = vi.hoisted(() => ({
  interactive: true,
}))
const contentItemState = vi.hoisted((): { data: Record<string, unknown> } => ({
  data: {},
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

vi.mock('../embedded-file-content', () => ({
  EmbeddedFileContent: (props: unknown) => {
    embeddedFileSpy(props)
    return <div data-testid="embedded-file-content">embedded-file</div>
  },
}))

vi.mock('../embedded-map-content', () => ({
  EmbeddedMapContent: (props: unknown) => {
    embeddedMapSpy(props)
    return <div data-testid="embedded-map-content">embedded-map</div>
  },
}))

vi.mock('../../../runtime/providers/canvas-runtime', () => ({
  useCanvasRuntime: () => ({
    canEdit: true,
    domRuntime: {
      registerNodeSurfaceElement: vi.fn(() => vi.fn()),
    },
    editSession: {
      editingEmbedId: null,
      setEditingEmbedId,
    },
  }),
}))

vi.mock('../../../runtime/providers/use-canvas-render-mode', () => ({
  useIsInteractiveCanvasRenderMode: () => renderModeState.interactive,
}))

vi.mock('../../shared/resizable-node-wrapper', () => ({
  ResizableNodeWrapper: ({ children, chrome }: { children: ReactNode; chrome: ReactNode }) => (
    <div>
      {chrome}
      {children}
    </div>
  ),
}))

vi.mock('../../shared/use-canvas-editable-node-session', () => ({
  useCanvasEditableNodeSession: () => ({
    editable: false,
    isSelected: false,
    isExclusivelySelected: false,
    lifecycle: {},
    handleDoubleClick: vi.fn(),
    handleActivated: vi.fn(),
  }),
}))

vi.mock('../../shared/canvas-node-connection-handles', () => ({
  CanvasNodeConnectionHandles: () => null,
}))

vi.mock('../../shared/canvas-floating-formatting-toolbar', () => ({
  CanvasFloatingFormattingToolbar: () => null,
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => ({
    // EmbedNode resolves nested content from the active sidebar items map during render.
    itemsMap: new Map([
      ['canvas-1', { name: 'Canvas Item' }],
      ['file-1', { name: 'File Item' }],
      ['map-1', { name: 'Map Item' }],
    ]),
  }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItemById', () => ({
  useSidebarItemById: () => ({
    data: contentItemState.data,
  }),
}))

vi.mock('../../shared/canvas-node-surface-style', () => ({
  getCanvasNodeSurfaceStyle: () => ({}),
  normalizeCanvasNodeSurfaceStyleData: () => ({
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
    setEditingEmbedId.mockClear()
    contentItemState.data = {
      _id: 'canvas-1',
      type: SIDEBAR_ITEM_TYPES.canvases,
      name: 'Canvas Item',
      previewUrl: 'canvas.png',
    }
    sidebarItemPreviewSpy.mockReset()
    embeddedCanvasSpy.mockReset()
    embeddedFileSpy.mockReset()
    embeddedMapSpy.mockReset()
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

  it('renders visual file embeds through the dedicated embedded file renderer in interactive mode', () => {
    contentItemState.data = {
      _id: 'file-1',
      type: SIDEBAR_ITEM_TYPES.files,
      name: 'File Item',
      contentType: 'application/pdf',
      downloadUrl: 'document.pdf',
      previewUrl: 'preview.png',
    }
    renderEmbedNode('node-1', 'file-1')

    expect(screen.getByTestId('embedded-file-content')).toBeInTheDocument()
    expect(embeddedFileSpy).toHaveBeenCalledWith({
      nodeId: 'node-1',
      file: {
        _id: 'file-1',
        type: SIDEBAR_ITEM_TYPES.files,
        name: 'File Item',
        contentType: 'application/pdf',
        downloadUrl: 'document.pdf',
        previewUrl: 'preview.png',
      },
    })
    expect(sidebarItemPreviewSpy).not.toHaveBeenCalled()
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

  it('falls back to the shared read-only preview path for nested embedded files', () => {
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

    expect(screen.getByTestId('shared-sidebar-item-preview')).toBeInTheDocument()
    expect(sidebarItemPreviewSpy).toHaveBeenCalledWith({
      item: {
        _id: 'file-1',
        type: SIDEBAR_ITEM_TYPES.files,
        name: 'File Item',
        contentType: 'application/pdf',
        downloadUrl: 'document.pdf',
        previewUrl: 'preview.png',
      },
    })
    expect(embeddedFileSpy).not.toHaveBeenCalled()
  })

  it('inverse-scales the floating name label from the current viewport zoom', () => {
    renderEmbedNode('node-1', 'canvas-1', { zoom: 2 })

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
})

function renderEmbedNode(
  id = 'node-1',
  sidebarItemId = 'canvas-1',
  viewport: { zoom: number } = { zoom: 1 },
) {
  const engine = createCanvasEngine()
  engine.setViewport({ x: 0, y: 0, zoom: viewport.zoom })

  return render(
    <CanvasEngineProvider engine={engine}>
      <EmbedNode {...createEmbedNodeProps(id, sidebarItemId)} />
    </CanvasEngineProvider>,
  )
}

function createEmbedNodeProps(id: string, sidebarItemId: string): Parameters<typeof EmbedNode>[0] {
  return {
    id,
    data: { sidebarItemId: testId<'sidebarItems'>(sidebarItemId) },
    dragging: false,
  } as unknown as Parameters<typeof EmbedNode>[0]
}
