import { act, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasRichTextNode } from '../canvas-rich-text-node'
import { createCanvasProviderProps } from '../../../runtime/__tests__/canvas-runtime-test-utils'
import { CanvasProviders } from '../../../runtime/providers/canvas-runtime-context'
import { CanvasRenderModeProvider } from '../../../runtime/providers/canvas-render-mode-context'
import { useCanvasSelectionState } from '../../../runtime/selection/use-canvas-selection-state'

const renderModeState = vi.hoisted(() => ({
  interactive: true,
}))

vi.mock('@xyflow/react', () => ({
  useInternalNode: () => ({
    id: 'text-1',
    position: { x: 0, y: 0 },
    measured: { width: 200, height: 120 },
    internals: { positionAbsolute: { x: 0, y: 0 } },
  }),
  useReactFlow: () => ({
    setNodes: (
      updater: Array<{ id: string }> | ((nodes: Array<{ id: string }>) => Array<{ id: string }>),
    ) => (typeof updater === 'function' ? updater([{ id: 'text-1' }]) : updater),
    setEdges: (updater: Array<never> | ((edges: Array<never>) => Array<never>)) =>
      typeof updater === 'function' ? updater([]) : updater,
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  }),
}))

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

vi.mock('../use-blocknote-activation-lifecycle', () => ({
  useBlockNoteActivationLifecycle: () => undefined,
}))

vi.mock('~/features/editor/hooks/useOwnedBlockNoteEditor', () => ({
  useOwnedBlockNoteEditor: () => null,
}))

vi.mock('~/features/shadcn/components/scroll-area', () => ({
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

describe('CanvasRichTextNode', () => {
  beforeEach(() => {
    renderModeState.interactive = true
    useCanvasSelectionState.getState().setSelection({
      nodeIds: [],
      edgeIds: [],
    })
  })

  afterEach(() => {
    useCanvasSelectionState.getState().reset()
  })

  it('selects the new text node when pending auto-edit starts', async () => {
    render(<CanvasRichTextNodeHarness />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(useCanvasSelectionState.getState().selectedNodeIds).toEqual(['text-1'])
    expect(getCanvasNode()).toHaveAttribute('data-node-selected', 'true')
  })

  it('renders connection handles at the wrapper layer instead of inside the clipped content shell', () => {
    render(<CanvasRichTextNodeHarness />)

    expect(screen.getByTestId('connection-handles').parentElement).toBe(getCanvasNode())
  })

  it('suppresses editable chrome in embedded read-only mode', async () => {
    renderModeState.interactive = false
    render(<CanvasRichTextNodeHarness mode="embedded-readonly" />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.queryByTestId('connection-handles')).toBeNull()
    expect(screen.getByRole('group', { name: 'Empty text node' })).toHaveAttribute('tabindex', '-1')
    expect(useCanvasSelectionState.getState().selectedNodeIds).toEqual([])
  })
})

function CanvasRichTextNodeHarness({
  mode = 'interactive',
}: {
  mode?: 'interactive' | 'embedded-readonly'
}) {
  const [pendingEditNodeId, setPendingEditNodeId] = useState<string | null>('text-1')
  const [pendingEditNodePoint, setPendingEditNodePoint] = useState<{ x: number; y: number } | null>(
    { x: 100, y: 120 },
  )
  const nodeProps = {
    id: 'text-1',
    dragging: false,
    data: { content: [] },
    variant: {
      nodeType: 'text',
      editAriaLabel: 'Edit text node',
      emptyAriaLabel: 'Empty text node',
      minWidth: 160,
      minHeight: 80,
      containerClassName: 'rounded-sm',
      contentClassName: 'h-full',
      textClassName: 'text-sm',
      textColor: 'currentColor',
    },
  } as unknown as Parameters<typeof CanvasRichTextNode>[0]

  return (
    <CanvasRenderModeProvider mode={mode}>
      <CanvasProviders
        {...createCanvasProviderProps({
          editSession: {
            editingEmbedId: null,
            setEditingEmbedId: () => undefined,
            pendingEditNodeId,
            pendingEditNodePoint,
            setPendingEditNodeId,
            setPendingEditNodePoint,
          },
        })}
      >
        <CanvasRichTextNode {...nodeProps} />
      </CanvasProviders>
    </CanvasRenderModeProvider>
  )
}

function getCanvasNode() {
  return screen.getByTestId('canvas-node')
}
