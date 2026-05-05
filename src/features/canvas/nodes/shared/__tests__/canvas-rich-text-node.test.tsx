import { act, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasRichTextNode } from '../canvas-rich-text-node'
import { normalizeCanvasRichTextNodeData } from '../canvas-rich-text-node-data'
import {
  createCanvasRuntime,
  createCanvasRuntimeEnginePair,
} from '../../../runtime/__tests__/canvas-runtime-test-utils'
import { CanvasRuntimeProvider } from '../../../runtime/providers/canvas-runtime'
import { CanvasRenderModeProvider } from '../../../runtime/providers/canvas-render-mode-context'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import type { CanvasDomRuntime } from '../../../system/canvas-dom-runtime'
import type { CanvasEngine } from '../../../system/canvas-engine-types'
import type { CanvasSelectionSnapshot } from '../../../system/canvas-selection'

const renderModeState = vi.hoisted(() => ({
  interactive: true,
}))
const ownedEditorState = vi.hoisted((): { editor: unknown } => ({
  editor: null,
}))
const richTextViewSpy = vi.hoisted(() => vi.fn())

let richTextEngine: CanvasEngine
let richTextDomRuntime: CanvasDomRuntime

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
  useOwnedBlockNoteEditor: () => ownedEditorState.editor,
}))

vi.mock('../canvas-rich-text-view', () => ({
  CanvasRichTextView: (props: { style?: React.CSSProperties }) => {
    richTextViewSpy(props)
    return <div data-testid="canvas-rich-text-view" style={props.style} />
  },
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
    const runtimePair = createCanvasRuntimeEnginePair()
    richTextEngine = runtimePair.canvasEngine
    richTextDomRuntime = runtimePair.domRuntime
    renderModeState.interactive = true
    ownedEditorState.editor = null
    richTextViewSpy.mockReset()
  })

  afterEach(() => {
    richTextEngine.destroy()
    richTextDomRuntime.destroy()
  })

  it('selects the new text node when pending auto-edit starts', async () => {
    render(<CanvasRichTextNodeHarness />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(richTextEngine.getSnapshot().selection.nodeIds).toEqual(new Set(['text-1']))
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
    expect(richTextEngine.getSnapshot().selection.nodeIds).toEqual(new Set())
  })

  it('renders an invalid-content placeholder and does not enter editing for malformed content', async () => {
    render(<CanvasRichTextNodeHarness content={[{ type: 'table' }]} />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('Invalid text content')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Invalid text node' })).toBeInTheDocument()
    expect(richTextEngine.getSnapshot().selection.nodeIds).toEqual(new Set())
    expect(screen.queryByText('Empty text node')).toBeNull()
  })

  it('uses node textColor as the default rendered text color', () => {
    render(
      <CanvasRichTextNodeHarness
        content={[{ type: 'paragraph', content: [{ type: 'text', text: 'Colored text' }] }]}
        textColor="var(--t-red)"
      />,
    )

    expect(screen.getByRole('group', { name: 'Colored text' })).toHaveStyle({
      color: 'var(--t-red)',
    })
  })

  it('passes node textColor to the BlockNote container as the default editor text color', () => {
    ownedEditorState.editor = createEditor()

    render(
      <CanvasRichTextNodeHarness
        content={[{ type: 'paragraph', content: [{ type: 'text', text: 'Colored text' }] }]}
        textColor="var(--t-blue)"
      />,
    )

    expect(richTextViewSpy).toHaveBeenCalledWith(
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

function CanvasRichTextNodeHarness({
  content = EMPTY_CONTENT,
  mode = 'interactive',
  textColor,
}: {
  content?: unknown
  mode?: 'interactive' | 'embedded-readonly'
  textColor?: string
}) {
  const defaultSelection = createCanvasRuntime().selection
  const [pendingEditNodeId, setPendingEditNodeId] = useState<string | null>('text-1')
  const [pendingEditNodePoint, setPendingEditNodePoint] = useState<{ x: number; y: number } | null>(
    { x: 100, y: 120 },
  )
  const nodeProps = {
    id: 'text-1',
    dragging: false,
    data: normalizeCanvasRichTextNodeData({ content, textColor }),
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
      textColor: 'currentColor',
    },
  } as unknown as Parameters<typeof CanvasRichTextNode>[0]

  return (
    <CanvasEngineProvider engine={richTextEngine}>
      <CanvasRenderModeProvider mode={mode}>
        <CanvasRuntimeProvider
          {...createCanvasRuntime({
            canvasEngine: richTextEngine,
            domRuntime: richTextDomRuntime,
            editSession: {
              editingEmbedId: null,
              setEditingEmbedId: () => undefined,
              pendingEditNodeId,
              pendingEditNodePoint,
              setPendingEditNodeId,
              setPendingEditNodePoint,
            },
            selection: {
              ...defaultSelection,
              setSelection: (selection: CanvasSelectionSnapshot) =>
                richTextEngine.setSelection(selection),
            },
          })}
        >
          <CanvasRichTextNode {...nodeProps} />
        </CanvasRuntimeProvider>
      </CanvasRenderModeProvider>
    </CanvasEngineProvider>
  )
}

function getCanvasNode() {
  return screen.getByTestId('canvas-node')
}

function createEditor() {
  return {
    document: [],
    onChange: vi.fn(() => () => undefined),
    replaceBlocks: vi.fn(),
  }
}
