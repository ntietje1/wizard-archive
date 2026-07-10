import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { CanvasScene } from '../canvas-scene'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import { createCanvasRuntime } from '../../runtime/__tests__/canvas-runtime-test-utils'
import { CanvasRuntimeProvider } from '../../runtime/providers/canvas-runtime'
import { createCanvasDomRuntime } from '../../system/canvas-dom-runtime'
import { createCanvasEngine } from '../../system/canvas-engine'
import type { CanvasDocumentNode } from '../../document-contract'

vi.mock('../canvas-background', () => ({
  CanvasBackground: () => null,
}))

vi.mock('../canvas-edge-renderer', () => ({
  CanvasEdgeRenderer: () => null,
}))

vi.mock('../canvas-local-overlays-host', () => ({
  CanvasLocalOverlaysHost: () => null,
}))

vi.mock('../canvas-awareness-host', () => ({
  CanvasAwarenessHost: () => null,
}))

const sourceNode: CanvasDocumentNode = {
  id: 'source',
  type: 'text',
  position: { x: 0, y: 0 },
  width: 100,
  height: 50,
  data: {},
}

let engine: ReturnType<typeof createCanvasEngine> | null = null
let domRuntime: ReturnType<typeof createCanvasDomRuntime> | null = null

describe('CanvasScene node events', () => {
  afterEach(() => {
    engine?.destroy()
    domRuntime?.destroy()
    engine = null
    domRuntime = null
  })

  it('routes node shell clicks through the scene handler', () => {
    const { getNodeShell, onNodeClick } = renderScene()

    fireEvent.click(getNodeShell())

    expect(onNodeClick).toHaveBeenCalledWith(expect.any(Object), sourceNode)
  })

  it('routes node shell context menus through the scene handler', () => {
    const { getNodeShell, onNodeContextMenu } = renderScene()

    fireEvent.contextMenu(getNodeShell())

    expect(onNodeContextMenu).toHaveBeenCalledWith(expect.any(Object), sourceNode)
  })

  it('lets editable node content handle its own context menu', () => {
    const { getEditableContent, onNodeContextMenu } = renderScene()

    fireEvent.contextMenu(getEditableContent())

    expect(onNodeContextMenu).not.toHaveBeenCalled()
  })
})

function renderScene() {
  domRuntime = createCanvasDomRuntime()
  engine = createCanvasEngine({ domRuntime })
  engine.setDocumentSnapshot({ nodes: [sourceNode] })
  const onNodeClick = vi.fn()
  const onNodeContextMenu = vi.fn()
  render(
    <CanvasEngineProvider engine={engine}>
      <CanvasRuntimeProvider
        {...createCanvasRuntime({
          canvasEngine: engine,
          domRuntime,
        })}
      >
        <CanvasScene
          canEdit
          remoteUsers={[]}
          sceneHandlers={{
            createEdgeFromConnection: vi.fn(),
            onNodeClick,
          }}
          NodeContentComponent={TestNodeContent}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={vi.fn()}
          onPaneContextMenu={vi.fn()}
        />
      </CanvasRuntimeProvider>
    </CanvasEngineProvider>,
  )

  return {
    getEditableContent: () => screen.getByText('Editable text'),
    getNodeShell: () => screen.getByLabelText('text node'),
    onNodeClick,
    onNodeContextMenu,
  }
}

function TestNodeContent() {
  return (
    <div>
      <span contentEditable suppressContentEditableWarning>
        Editable text
      </span>
    </div>
  )
}
