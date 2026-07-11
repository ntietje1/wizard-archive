import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { CanvasTextNode } from '../canvas-text-node'
import { normalizeCanvasTextNodeRenderData } from '../../../text/node-data'
import {
  createCanvasRuntime,
  createCanvasRuntimeEnginePair,
} from '../../../runtime/__tests__/canvas-runtime-test-utils'
import { CanvasRuntimeProvider } from '../../../runtime/providers/canvas-runtime'
import { CanvasRenderModeContext } from '../../../runtime/providers/canvas-render-mode-context'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { CanvasNodeResizeMetadataProvider } from '../canvas-node-resize-metadata-provider'
import type { CanvasDomRuntime } from '../../../system/canvas-dom-runtime'
import type { CanvasEngine } from '../../../system/canvas-engine-types'
import type { CanvasSelectionSnapshot } from '../../../system/canvas-selection'

const renderModeState = vi.hoisted(() => ({
  interactive: true,
}))
const ownedEditorState = vi.hoisted((): { editor: unknown } => ({
  editor: null,
}))
const canvasTextViewSpy = vi.hoisted(() => vi.fn())

let canvasTextEngine: CanvasEngine
let canvasTextDomRuntime: CanvasDomRuntime

// This mock bypasses CanvasRenderModeProvider, so the harness mode prop and
// renderModeState.interactive must stay aligned when changing test render mode.
vi.mock('../../../runtime/providers/use-canvas-render-mode', () => ({
  useIsInteractiveCanvasRenderMode: () => renderModeState.interactive,
}))

vi.mock('../../../runtime/interaction/use-canvas-modifier-keys', () => ({
  useCanvasModifierKeys: () => ({ shiftPressed: false }),
}))

vi.mock('../canvas-node-connection-handles', () => ({
  CanvasNodeConnectionHandles: () =>
    renderModeState.interactive ? <div data-testid="connection-handles" /> : null,
}))

vi.mock('../canvas-floating-formatting-toolbar', () => ({
  CanvasFloatingFormattingToolbar: () => null,
}))

vi.mock('../../../../rich-text/blocknote/activation-lifecycle', () => ({
  useBlockNoteActivationLifecycle: () => undefined,
}))

vi.mock('../../../../rich-text/blocknote/use-owned-blocknote-editor', () => ({
  useOwnedBlockNoteEditor: () => ownedEditorState.editor,
}))

vi.mock('../../../text/view', () => ({
  CanvasTextView: (props: { style?: React.CSSProperties }) => {
    canvasTextViewSpy(props)
    return <div data-testid="canvas-text-view" style={props.style} />
  },
}))

vi.mock('@wizard-archive/ui/shadcn/components/scroll-area', () => ({
  ScrollArea: ({
    children,
    className,
    viewportRef,
  }: {
    children: React.ReactNode
    className?: string
    viewportRef?: React.RefObject<HTMLDivElement | null>
  }) => (
    <div className={className}>
      <div ref={viewportRef}>{children}</div>
    </div>
  ),
}))

describe('CanvasTextNode', () => {
  beforeEach(() => {
    const runtimePair = createCanvasRuntimeEnginePair()
    canvasTextEngine = runtimePair.canvasEngine
    canvasTextDomRuntime = runtimePair.domRuntime
    renderModeState.interactive = true
    ownedEditorState.editor = null
    canvasTextViewSpy.mockReset()
  })

  afterEach(() => {
    canvasTextEngine.destroy()
    canvasTextDomRuntime.destroy()
  })

  it('selects the new text node when pending auto-edit starts', async () => {
    render(<CanvasTextNodeHarness />)

    await settleCanvasTextNodeEffects()

    expect(canvasTextEngine.getSnapshot().selection.nodeIds).toEqual(new Set(['text-1']))
    expect(getCanvasNode()).toHaveAttribute('data-node-selected', 'true')
  })

  it('narrows multi-selection before pending auto-edit enters editing', async () => {
    canvasTextEngine.setSelection({
      nodeIds: new Set(['text-1', 'text-2']),
      edgeIds: new Set(),
    })

    render(<CanvasTextNodeHarness />)

    await settleCanvasTextNodeEffects()

    expect(canvasTextEngine.getSnapshot().selection.nodeIds).toEqual(new Set(['text-1']))
    expect(getCanvasNode()).toHaveAttribute('data-node-editing', 'false')
  })

  it('renders connection handles at the wrapper layer instead of inside the clipped content shell', () => {
    render(<CanvasTextNodeHarness />)

    expect(screen.getByTestId('connection-handles').parentElement).toBe(getCanvasNode())
  })

  it('suppresses editable chrome in embedded read-only mode', async () => {
    renderModeState.interactive = false
    render(<CanvasTextNodeHarness mode="embedded-readonly" />)

    await settleCanvasTextNodeEffects()

    expect(screen.queryByTestId('connection-handles')).toBeNull()
    expect(screen.getByLabelText('Empty text node')).toBeInTheDocument()
    expect(canvasTextEngine.getSnapshot().selection.nodeIds).toEqual(new Set())
  })

  it('keeps view-only text nodes read-only in an interactive canvas surface', async () => {
    const onPendingEditNodeIdChange = vi.fn()
    const onPendingEditNodePointChange = vi.fn()
    render(
      <CanvasTextNodeHarness
        canEdit={false}
        onPendingEditNodeIdChange={onPendingEditNodeIdChange}
        onPendingEditNodePointChange={onPendingEditNodePointChange}
      />,
    )

    await settleCanvasTextNodeEffects()

    expect(screen.getByLabelText('Empty text node')).toBeInTheDocument()
    expect(canvasTextEngine.getSnapshot().selection.nodeIds).toEqual(new Set())
    expect(onPendingEditNodeIdChange).toHaveBeenCalledWith(null)
    expect(onPendingEditNodePointChange).toHaveBeenCalledWith(null)
  })

  it('exits text editing when edit access is revoked', async () => {
    ownedEditorState.editor = createEditor()
    const view = render(<CanvasTextNodeHarness />)

    await enterPendingEditMode()
    expect(getCanvasNode()).toHaveAttribute('data-node-editing', 'true')

    view.rerender(<CanvasTextNodeHarness canEdit={false} />)

    await enterPendingEditMode()
    expect(getCanvasNode()).toHaveAttribute('data-node-editing', 'false')
    expect(screen.getByTestId('canvas-text-view')).toBeInTheDocument()
  })

  it('exits text editing when selection moves to another node', async () => {
    ownedEditorState.editor = createEditor()
    canvasTextEngine.setSelection({
      nodeIds: new Set(['text-1']),
      edgeIds: new Set(),
    })
    render(<CanvasTextNodeHarness initialPendingEditNodeId={null} />)

    const surface = screen.getByRole('textbox', { name: 'Empty text node' })
    fireEvent.doubleClick(surface, { clientX: 100, clientY: 120 })
    await settleEditModeChange()
    expect(getCanvasNode()).toHaveAttribute('data-node-editing', 'true')

    act(() => {
      canvasTextEngine.setSelection({
        nodeIds: new Set(['text-2']),
        edgeIds: new Set(),
      })
    })
    await settleEditModeChange()

    expect(getCanvasNode()).toHaveAttribute('data-node-editing', 'false')
  })

  it('exits text editing when Escape starts inside the rich text child', async () => {
    ownedEditorState.editor = createEditor()
    canvasTextEngine.setSelection({
      nodeIds: new Set(['text-1']),
      edgeIds: new Set(),
    })
    render(<CanvasTextNodeHarness initialPendingEditNodeId={null} />)

    const surface = screen.getByRole('textbox', { name: 'Empty text node' })
    fireEvent.doubleClick(surface, { clientX: 100, clientY: 120 })
    await settleEditModeChange()
    expect(getCanvasNode()).toHaveAttribute('data-node-editing', 'true')

    fireEvent.keyDown(screen.getByTestId('canvas-text-view'), { key: 'Escape' })
    await settleEditModeChange()

    expect(getCanvasNode()).toHaveAttribute('data-node-editing', 'false')
    expect(surface).toHaveFocus()
  })

  it('narrows multi-selection and enters editing on double-click', async () => {
    ownedEditorState.editor = createEditor()
    canvasTextEngine.setSelection({
      nodeIds: new Set(['text-1', 'text-2']),
      edgeIds: new Set(),
    })
    render(<CanvasTextNodeHarness initialPendingEditNodeId={null} />)

    const surface = screen.getByRole('textbox', { name: 'Empty text node' })
    fireEvent.doubleClick(surface, { clientX: 100, clientY: 120 })

    await settleEditModeChange()

    expect(canvasTextEngine.getSnapshot().selection.nodeIds).toEqual(new Set(['text-1']))
    expect(getCanvasNode()).toHaveAttribute('data-node-editing', 'true')
  })

  it('renders an invalid-content placeholder and does not enter editing for malformed content', async () => {
    const onPendingEditNodeIdChange = vi.fn()
    const onPendingEditNodePointChange = vi.fn()
    render(
      <CanvasTextNodeHarness
        content={[{ type: 'table' }]}
        onPendingEditNodeIdChange={onPendingEditNodeIdChange}
        onPendingEditNodePointChange={onPendingEditNodePointChange}
      />,
    )

    await settleCanvasTextNodeEffects()

    expect(screen.getByText('Invalid text content')).toBeInTheDocument()
    expect(screen.getByLabelText('Invalid text node')).toBeInTheDocument()
    expect(canvasTextEngine.getSnapshot().selection.nodeIds).toEqual(new Set())
    expect(screen.queryByText('Empty text node')).toBeNull()
    expect(onPendingEditNodeIdChange).toHaveBeenCalledWith(null)
    expect(onPendingEditNodePointChange).toHaveBeenCalledWith(null)
  })

  it('renders valid text content as a preview before an editor instance is available', () => {
    render(
      <CanvasTextNodeHarness
        content={[{ type: 'paragraph', content: [{ type: 'text', text: 'Preview text' }] }]}
      />,
    )

    expect(screen.getByText('Preview text')).toBeInTheDocument()
    expect(screen.queryByTestId('canvas-text-view')).toBeNull()
  })

  it('uses node textColor as the default rendered text color', () => {
    render(
      <CanvasTextNodeHarness
        content={[{ type: 'paragraph', content: [{ type: 'text', text: 'Colored text' }] }]}
        textColor="var(--t-red)"
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Colored text' })).toHaveStyle({
      color: 'var(--t-red)',
    })
  })

  it('updates surface registration when the rendered element changes', async () => {
    const registerNodeSurfaceElementSpy = vi.spyOn(
      canvasTextDomRuntime,
      'registerNodeSurfaceElement',
    )
    const { rerender } = render(<CanvasTextNodeHarness canEdit={false} />)

    await settleEditModeChange()

    const readOnlySurface = screen.getByLabelText('Empty text node')
    expect(registerNodeSurfaceElementSpy).toHaveBeenCalledWith('text-1', readOnlySurface)

    rerender(<CanvasTextNodeHarness canEdit />)

    await settleEditModeChange()

    expect(registerNodeSurfaceElementSpy).toHaveBeenCalledWith(
      'text-1',
      screen.getByRole('textbox', { name: 'Empty text node' }),
    )
  })

  it('uses a read-only BlockNote presentation while viewing a valid text node', () => {
    ownedEditorState.editor = createEditor()

    render(
      <CanvasTextNodeHarness
        content={[
          {
            type: 'heading',
            content: [{ type: 'text', text: 'Displayed heading', styles: { bold: true } }],
          },
        ]}
      />,
    )

    expect(screen.getByTestId('canvas-text-view')).toBeInTheDocument()
    expect(canvasTextViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        editable: false,
      }),
    )
  })

  it('passes node textColor to the BlockNote container as the default editor text color while editing', async () => {
    ownedEditorState.editor = createEditor()

    render(
      <CanvasTextNodeHarness
        content={[{ type: 'paragraph', content: [{ type: 'text', text: 'Colored text' }] }]}
        textColor="var(--t-blue)"
      />,
    )

    await enterPendingEditMode()

    expect(canvasTextViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.objectContaining({
          '--bn-colors-editor-text': 'var(--t-blue)',
          color: 'var(--t-blue)',
        }),
      }),
    )
  })
})

const EMPTY_CONTENT: Array<never> = []

function CanvasTextNodeHarness({
  canEdit = true,
  content = EMPTY_CONTENT,
  initialPendingEditNodeId = 'text-1',
  initialPendingEditNodePoint = { x: 100, y: 120 },
  mode = 'interactive',
  onPendingEditNodeIdChange,
  onPendingEditNodePointChange,
  textColor,
}: {
  canEdit?: boolean
  content?: unknown
  initialPendingEditNodeId?: string | null
  initialPendingEditNodePoint?: { x: number; y: number } | null
  mode?: 'interactive' | 'embedded-readonly'
  onPendingEditNodeIdChange?: (id: string | null) => void
  onPendingEditNodePointChange?: (point: { x: number; y: number } | null) => void
  textColor?: string
}) {
  const defaultSelection = createCanvasRuntime().selection
  const [pendingEditNodeId, setPendingEditNodeId] = useState<string | null>(
    initialPendingEditNodeId,
  )
  const [pendingEditNodePoint, setPendingEditNodePoint] = useState<{ x: number; y: number } | null>(
    initialPendingEditNodePoint,
  )
  const nodeProps = {
    id: 'text-1',
    dragging: false,
    data: normalizeCanvasTextNodeRenderData({ content, textColor }),
    variant: {
      nodeType: 'text',
      editAriaLabel: 'Edit text node',
      emptyAriaLabel: 'Empty text node',
      invalidAriaLabel: 'Invalid text node',
      invalidContentLabel: 'Invalid text content',
      minWidth: 160,
      minHeight: 80,
      containerClassName: 'rounded-sm',
      contentClassName: 'h-full',
      textClassName: 'text-sm',
    },
  } satisfies Parameters<typeof CanvasTextNode>[0]

  return (
    <CanvasEngineProvider engine={canvasTextEngine}>
      <CanvasRenderModeContext value={mode}>
        <CanvasRuntimeProvider
          {...createCanvasRuntime({
            canEdit,
            canvasEngine: canvasTextEngine,
            domRuntime: canvasTextDomRuntime,
            editSession: {
              editingEmbedId: null,
              setEditingEmbedId: () => undefined,
              pendingEditNodeId,
              pendingEditNodePoint,
              setPendingEditNodeId: (nextId) => {
                setPendingEditNodeId(nextId)
                onPendingEditNodeIdChange?.(nextId)
              },
              setPendingEditNodePoint: (nextPoint) => {
                setPendingEditNodePoint(nextPoint)
                onPendingEditNodePointChange?.(nextPoint)
              },
            },
            selection: {
              ...defaultSelection,
              setSelection: (selection: CanvasSelectionSnapshot) =>
                canvasTextEngine.setSelection(selection),
            },
          })}
        >
          <CanvasNodeResizeMetadataProvider>
            <CanvasTextNode {...nodeProps} />
          </CanvasNodeResizeMetadataProvider>
        </CanvasRuntimeProvider>
      </CanvasRenderModeContext>
    </CanvasEngineProvider>
  )
}

function getCanvasNode() {
  return screen.getByTestId('canvas-node')
}

async function enterPendingEditMode() {
  await settleEditModeChange()
}

async function settleEditModeChange() {
  await act(async () => {
    await Promise.resolve()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await Promise.resolve()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

async function settleCanvasTextNodeEffects() {
  await act(async () => {
    await Promise.resolve()
  })
}

function createEditor() {
  return {
    document: [],
    onChange: vi.fn(() => () => undefined),
    replaceBlocks: vi.fn(),
  }
}
