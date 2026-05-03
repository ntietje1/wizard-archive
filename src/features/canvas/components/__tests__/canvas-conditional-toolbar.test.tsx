import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasConditionalToolbar } from '../canvas-conditional-toolbar'
import { registerCanvasRichTextFormattingSession } from '../../nodes/shared/canvas-rich-text-formatting-session'
import type { CanvasRichTextFormattingEditor } from '../../nodes/shared/canvas-rich-text-formatting-session'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import {
  createCanvasRuntime,
  createCanvasRuntimeEnginePair,
} from '../../runtime/__tests__/canvas-runtime-test-utils'
import { CanvasRuntimeProvider } from '../../runtime/providers/canvas-runtime-context'
import type { CanvasEngine } from '../../system/canvas-engine'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
  CanvasNodeType,
} from '~/features/canvas/types/canvas-domain-types'
import type { CanvasEdgePatch, CanvasEdgeType } from '../../edges/canvas-edge-types'
import type { CanvasCommands } from '../../runtime/document/use-canvas-commands'
import type { CanvasSelectionSnapshot } from '../../tools/canvas-tool-types'

const nodesMock = vi.hoisted(() => ({
  nodes: [] as Array<Node>,
}))

const edgesMock = vi.hoisted(() => ({
  edges: [] as Array<Edge>,
}))

const colorPickerMock = vi.hoisted(() => ({
  props: [] as Array<Record<string, unknown>>,
}))

let toolbarEngine: CanvasEngine | null = null

vi.mock('~/features/shadcn/components/slider', () => ({
  Slider: ({
    value,
    min,
    max,
    step,
    onValueChange,
    onValueCommitted,
    ...props
  }: {
    value?: Array<number>
    min?: number
    max?: number
    step?: number
    onValueChange?: (value: Array<number>) => void
    onValueCommitted?: (value: Array<number>) => void
    'aria-label'?: string
  }) => (
    <input
      type="range"
      aria-label={props['aria-label']}
      max={max}
      min={min}
      onChange={(event) => onValueChange?.([Number(event.currentTarget.value)])}
      onMouseUp={(event) => onValueCommitted?.([Number(event.currentTarget.value)])}
      step={step}
      value={value?.[0] ?? min ?? 0}
    />
  ),
}))

vi.mock('~/shared/components/color-picker-popover', () => ({
  ColorPickerPopover: (props: Record<string, unknown>) => {
    colorPickerMock.props.push(props)
    return (
      <button
        type="button"
        aria-label="Open color picker"
        data-testid="color-picker-popover"
        disabled={Boolean(props.disabled)}
      />
    )
  },
}))

function emitSelection(nodes: Array<Node>) {
  act(() => {
    const engine = getToolbarEngine()
    colorPickerMock.props = []
    nodesMock.nodes = nodes
    engine.setDocumentSnapshot({ nodes, edges: edgesMock.edges })
    engine.setSelection({
      nodeIds: new Set(nodes.map((node) => node.id)),
      edgeIds: new Set<string>(),
    })
  })
}

function selectionSnapshot(
  nodeIds: ReadonlySet<string> = new Set<string>(),
  edgeIds: ReadonlySet<string> = new Set<string>(),
): CanvasSelectionSnapshot {
  return { nodeIds, edgeIds }
}

function emitSelectionState(selection: CanvasSelectionSnapshot) {
  act(() => {
    const engine = getToolbarEngine()
    colorPickerMock.props = []
    engine.setDocumentSnapshot({ nodes: nodesMock.nodes, edges: edgesMock.edges })
    engine.setSelection(selection)
  })
}

function getToolbarEngine() {
  if (!toolbarEngine) {
    throw new Error('Canvas conditional toolbar test rendered without an engine')
  }

  return toolbarEngine
}

function renderToolbar({
  updateNodeData = vi.fn(),
  patchNodeData = vi.fn((updates: ReadonlyMap<string, Record<string, unknown>>) => {
    for (const [nodeId, data] of updates) {
      updateNodeData(nodeId, data)
    }
  }),
  patchEdge = vi.fn(),
  patchEdges = vi.fn((updates: ReadonlyMap<string, CanvasEdgePatch>) => {
    for (const [edgeId, patch] of updates) {
      patchEdge(edgeId, patch)
    }
  }),
  transact = vi.fn((fn: () => void) => fn()),
  commands,
}: {
  updateNodeData?: (nodeId: string, data: Record<string, unknown>) => void
  patchNodeData?: (updates: ReadonlyMap<string, Record<string, unknown>>) => void
  patchEdge?: (edgeId: string, patch: CanvasEdgePatch) => void
  patchEdges?: (updates: ReadonlyMap<string, CanvasEdgePatch>) => void
  transact?: (fn: () => void) => void
  commands?: CanvasCommands
} = {}) {
  toolbarEngine?.destroy()
  const runtimePair = createCanvasRuntimeEnginePair()
  const currentEngine = runtimePair.canvasEngine
  toolbarEngine = currentEngine
  currentEngine.setDocumentSnapshot({ nodes: nodesMock.nodes, edges: edgesMock.edges })
  const baseRuntime = createCanvasRuntime()
  const runtime = createCanvasRuntime({
    canvasEngine: currentEngine,
    domRuntime: runtimePair.domRuntime,
    nodeActions: {
      transact,
      onResize: vi.fn(),
      onResizeEnd: vi.fn(),
    },
    documentWriter: {
      ...baseRuntime.documentWriter,
      patchNodeData,
      patchEdges,
    },
    editSession: {
      editingEmbedId: null,
      setEditingEmbedId: vi.fn(),
      pendingEditNodeId: null,
      pendingEditNodePoint: null,
      setPendingEditNodeId: vi.fn(),
      setPendingEditNodePoint: vi.fn(),
    },
    history: {
      canUndo: false,
      canRedo: false,
      undo: vi.fn(),
      redo: vi.fn(),
    },
    commands,
  })

  const view = render(
    <CanvasEngineProvider engine={currentEngine}>
      <CanvasRuntimeProvider {...runtime}>
        <CanvasConditionalToolbar canEdit />
      </CanvasRuntimeProvider>
    </CanvasEngineProvider>,
  )

  return {
    ...view,
    updateNodeData,
    patchNodeData,
    patchEdge,
    patchEdges,
    transact,
  }
}

let nodeIdCounter = 0
let edgeIdCounter = 0

function createNode(
  type: CanvasNodeType,
  options: {
    color?: string
    opacity?: number
    size?: number
    backgroundColor?: string | null
    backgroundOpacity?: number
    borderStroke?: string | null
    borderOpacity?: number
    borderWidth?: number
    textColor?: string | null
    sidebarItemId?: string
  } = {},
): Node {
  const strokeData =
    type === 'stroke'
      ? {
          points: [
            [0, 0, 0.5],
            [24, 0, 0.5],
          ],
          bounds: { x: 0, y: 0, width: 24, height: 1 },
          color: options.color ?? 'var(--foreground)',
          size: options.size ?? 4,
        }
      : {}

  return {
    id: `${type}-${nodeIdCounter++}`,
    type,
    position: { x: 0, y: 0 },
    width: 100,
    height: 100,
    data: {
      ...strokeData,
      ...(type !== 'stroke' && options.color !== undefined ? { color: options.color } : {}),
      ...(options.opacity !== undefined ? { opacity: options.opacity } : {}),
      ...(type !== 'stroke' && options.size !== undefined ? { size: options.size } : {}),
      ...(options.backgroundColor !== undefined
        ? { backgroundColor: options.backgroundColor }
        : {}),
      ...(options.backgroundOpacity !== undefined
        ? { backgroundOpacity: options.backgroundOpacity }
        : {}),
      ...(options.borderStroke !== undefined ? { borderStroke: options.borderStroke } : {}),
      ...(options.borderOpacity !== undefined ? { borderOpacity: options.borderOpacity } : {}),
      ...(options.borderWidth !== undefined ? { borderWidth: options.borderWidth } : {}),
      ...(options.textColor !== undefined ? { textColor: options.textColor } : {}),
      ...(options.sidebarItemId !== undefined ? { sidebarItemId: options.sidebarItemId } : {}),
    },
  } as Node
}

function createEdge(
  options: {
    stroke?: string
    strokeWidth?: number
    source?: string
    target?: string
    type?: CanvasEdgeType
  } = {},
): Edge {
  return {
    id: `edge-${edgeIdCounter++}`,
    type: options.type ?? 'bezier',
    source: options.source ?? 'source-node',
    target: options.target ?? 'target-node',
    style:
      options.stroke !== undefined || options.strokeWidth !== undefined
        ? {
            ...(options.stroke !== undefined ? { stroke: options.stroke } : {}),
            ...(options.strokeWidth !== undefined ? { strokeWidth: options.strokeWidth } : {}),
          }
        : undefined,
  }
}

function createFormattingEditor({
  hasTextSelection = true,
  selectedCutContent,
  selectedFullContent,
  textColor,
}: {
  hasTextSelection?: boolean
  selectedCutContent?: Array<unknown>
  selectedFullContent?: Array<unknown>
  textColor: string
}) {
  const listeners = new Set<() => void>()
  const block = {
    id: 'paragraph-1',
    type: 'paragraph',
    props: {},
    content: selectedFullContent ?? [{ type: 'text', text: 'selection', styles: { textColor } }],
  }
  const cutBlock = {
    ...block,
    content: selectedCutContent ?? block.content,
  }

  return {
    _tiptapEditor: {
      view: {
        dispatch: vi.fn(),
        focus: vi.fn(),
        state: {
          doc: {},
          selection: {
            toJSON: vi.fn(() => null),
          },
          tr: {
            setSelection: vi.fn((selection: unknown) => selection),
          },
        },
      },
    },
    addStyles: vi.fn(),
    document: [block],
    focus: vi.fn(),
    getActiveStyles: vi.fn(() => ({ textColor })),
    getSelection: vi.fn(() => (hasTextSelection ? { blocks: [block] } : undefined)),
    getSelectionCutBlocks: vi.fn(() => ({
      _meta: { endPos: 0, startPos: 0 },
      blockCutAtEnd: undefined,
      blockCutAtStart: undefined,
      blocks: [cutBlock],
    })),
    getTextCursorPosition: vi.fn(() => ({
      block,
      nextBlock: undefined,
      parentBlock: undefined,
      prevBlock: undefined,
    })),
    isEditable: true,
    onChange: vi.fn((callback: () => void) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    }),
    onSelectionChange: vi.fn((callback: () => void) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    }),
    replaceBlocks: vi.fn(),
    schema: {
      styleSchema: {
        textColor: { propSchema: 'string', type: 'textColor' },
      },
    },
  }
}

function getStrokeSizeSlider() {
  return screen.getByRole('slider', { name: 'Stroke size' })
}

function getStrokeSizeInput() {
  return screen.getByRole('textbox', { name: 'Stroke size input' })
}

function previewStrokeSize(value: number) {
  fireEvent.input(getStrokeSizeSlider(), { target: { value: String(value) } })
}

function commitStrokeSize(value: number) {
  const slider = getStrokeSizeSlider()
  fireEvent.input(slider, { target: { value: String(value) } })
  fireEvent.pointerUp(slider)
}

describe('CanvasConditionalToolbar', () => {
  beforeEach(() => {
    useCanvasToolStore.getState().reset()
    nodesMock.nodes = []
    edgesMock.edges = []
    colorPickerMock.props = []
    nodeIdCounter = 0
    edgeIdCounter = 0
  })

  afterEach(() => {
    toolbarEngine?.destroy()
    toolbarEngine = null
  })

  it('shows draw tool properties when nothing is selected', () => {
    useCanvasToolStore.getState().setActiveTool('draw')

    renderToolbar()
    emitSelection([])

    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toHaveClass(
      'select-none',
    )
    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toHaveClass(
      'cursor-default',
    )
    expect(getStrokeSizeSlider()).toBeVisible()
    expect(getStrokeSizeSlider()).toHaveAttribute('min', '1')
    expect(getStrokeSizeSlider()).toHaveAttribute('max', '50')
    expect(getStrokeSizeInput()).toHaveValue('4')
    expect(getStrokeSizeInput()).toHaveClass('cursor-text')
    expect(screen.getByRole('button', { name: 'Select Reverse primary color' })).toHaveClass(
      'cursor-pointer',
    )
    expect(screen.getByTestId('color-picker-popover')).toBeVisible()
  })

  it('shows edge tool defaults when nothing is selected and updates the tool edge type', () => {
    useCanvasToolStore.getState().setActiveTool('edge')

    renderToolbar()
    emitSelection([])

    expect(screen.getByText('Edge type')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Change edge type to Bezier' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Change edge type to Step' })).toHaveClass(
      'cursor-pointer',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Change edge type to Step' }))

    expect(useCanvasToolStore.getState().edgeType).toBe('step')
  })

  it('updates tool property state after changing tool color and stroke size', () => {
    useCanvasToolStore.getState().setActiveTool('draw')

    renderToolbar()
    emitSelection([])

    const reversePrimaryColorButton = screen.getByRole('button', {
      name: 'Select Reverse primary color',
    })
    const redColorButton = screen.getByRole('button', { name: 'Select Red color' })

    expect(reversePrimaryColorButton).toHaveAttribute('aria-pressed', 'true')
    expect(redColorButton).toHaveAttribute('aria-pressed', 'false')
    expect(getStrokeSizeInput()).toHaveValue('4')

    fireEvent.click(redColorButton)
    commitStrokeSize(8)

    expect(reversePrimaryColorButton).toHaveAttribute('aria-pressed', 'false')
    expect(redColorButton).toHaveAttribute('aria-pressed', 'true')
    expect(useCanvasToolStore.getState().strokeSize).toBe(8)
    expect(getStrokeSizeInput()).toHaveValue('8')
  })

  it('refreshes draw tool defaults immediately when the tool store changes externally', () => {
    useCanvasToolStore.getState().setActiveTool('draw')

    renderToolbar()
    emitSelection([])

    expect(getStrokeSizeInput()).toHaveValue('4')
    expect(screen.getByRole('button', { name: 'Select Reverse primary color' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    act(() => {
      useCanvasToolStore.getState().setStrokeColor('var(--t-red)')
      useCanvasToolStore.getState().setStrokeSize(12)
    })

    expect(getStrokeSizeInput()).toHaveValue('12')
    expect(screen.getByRole('button', { name: 'Select Red color' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('shows single-node properties for editable nodes only', () => {
    useCanvasToolStore.getState().setActiveTool('draw')

    renderToolbar()
    emitSelection([
      createNode('text', {
        backgroundColor: '#FFEBA1',
        borderStroke: null,
      }),
    ])

    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
    expect(screen.getByText('Stroke size')).toBeVisible()

    emitSelection([
      createNode('text', {
        backgroundColor: 'var(--background)',
        borderStroke: 'var(--border)',
      }),
    ])
    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
  })

  it('shows stroke size controls for a selected stroke and updates the node size', () => {
    const { updateNodeData } = renderToolbar()

    const stroke = createNode('stroke', {
      color: 'var(--foreground)',
      opacity: 75,
      size: 4,
    })
    emitSelection([stroke])

    expect(getStrokeSizeInput()).toHaveValue('4')
    expect(getStrokeSizeSlider()).toHaveAttribute('min', '1')
    commitStrokeSize(8)

    expect(updateNodeData).toHaveBeenCalledWith(stroke.id, { size: 8 })
  })

  it('previews selected stroke size changes without writing until slider commit', () => {
    const { updateNodeData } = renderToolbar()

    const stroke = createNode('stroke', {
      color: 'var(--foreground)',
      opacity: 75,
      size: 4,
    })
    emitSelection([stroke])

    previewStrokeSize(9)
    expect(updateNodeData).not.toHaveBeenCalled()

    fireEvent.pointerUp(getStrokeSizeSlider())
    expect(updateNodeData).toHaveBeenCalledWith(stroke.id, { size: 9 })
  })

  it('shows shared properties for compatible multi-select and hides tool-only controls', () => {
    useCanvasToolStore.getState().setActiveTool('draw')

    renderToolbar()
    emitSelection([
      createNode('text', { backgroundColor: '#FFEBA1', borderStroke: null }),
      createNode('text', { backgroundColor: '#FFEBA1', borderStroke: null }),
    ])

    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
    expect(getStrokeSizeSlider()).toBeVisible()
  })

  it('fans out shared color updates to every selected node', () => {
    const { transact, updateNodeData } = renderToolbar()

    const firstText = createNode('text', { backgroundColor: '#FFEBA1', borderStroke: null })
    const secondText = createNode('text', { backgroundColor: '#FFEBA1', borderStroke: null })
    emitSelection([firstText, secondText])

    const fillGroup = screen.getByText('Fill').parentElement
    expect(fillGroup).not.toBeNull()

    fireEvent.click(within(fillGroup!).getByRole('button', { name: 'Select Red color' }))

    expect(updateNodeData).toHaveBeenCalledWith(firstText.id, {
      backgroundColor: 'var(--t-red)',
      backgroundOpacity: 100,
    })
    expect(updateNodeData).toHaveBeenCalledWith(secondText.id, {
      backgroundColor: 'var(--t-red)',
      backgroundOpacity: 100,
    })
    expect(transact).toHaveBeenCalledTimes(1)
  })

  it('shows and updates text color for selected text nodes', () => {
    const { updateNodeData } = renderToolbar()
    const text = createNode('text', { textColor: 'var(--t-blue)' })
    emitSelection([text])

    const textGroup = screen.getByText('Text').parentElement
    expect(textGroup).not.toBeNull()
    expect(within(textGroup!).getByRole('button', { name: 'Select Blue color' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(within(textGroup!).getByRole('button', { name: 'Select Red color' }))

    expect(updateNodeData).toHaveBeenCalledWith(text.id, { textColor: 'var(--t-red)' })
  })

  it('renders mixed text color state for selected text nodes with different defaults', () => {
    renderToolbar()
    emitSelection([
      createNode('text', { textColor: 'var(--t-blue)' }),
      createNode('text', { textColor: 'var(--t-red)' }),
    ])

    const textGroup = screen.getByText('Text').parentElement
    expect(textGroup).not.toBeNull()
    expect(within(textGroup!).getByRole('button', { name: 'Select Blue color' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(within(textGroup!).getByRole('button', { name: 'Select Red color' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(colorPickerMock.props[0]?.mixed).toBe(true)
  })

  it('applies text color to the active rich-text selection instead of the node default', () => {
    const { updateNodeData } = renderToolbar()
    const editor = createFormattingEditor({
      textColor: 'var(--t-blue)',
    }) as unknown as CanvasRichTextFormattingEditor
    let unregister: () => void = () => undefined
    act(() => {
      unregister = registerCanvasRichTextFormattingSession({
        nodeId: 'text-0',
        editor,
        defaultTextColor: 'var(--t-purple)',
        setDefaultTextColor: vi.fn(),
      })
    })

    try {
      emitSelection([createNode('text', { textColor: 'var(--t-purple)' })])

      const textGroup = screen.getByText('Text').parentElement
      expect(textGroup).not.toBeNull()
      expect(within(textGroup!).getByRole('button', { name: 'Select Blue color' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )

      fireEvent.click(within(textGroup!).getByRole('button', { name: 'Select Red color' }))

      expect(editor.addStyles).toHaveBeenCalledWith({ textColor: 'var(--t-red)' })
      expect(editor.focus).toHaveBeenCalled()
      expect(updateNodeData).not.toHaveBeenCalledWith('text-0', { textColor: 'var(--t-red)' })
    } finally {
      act(() => {
        unregister()
      })
    }
  })

  it('applies custom picker text color to the active rich-text selection', () => {
    const { updateNodeData } = renderToolbar()
    const setDefaultTextColor = vi.fn()
    const editor = createFormattingEditor({
      textColor: 'var(--t-blue)',
    }) as unknown as CanvasRichTextFormattingEditor
    let unregister: () => void = () => undefined
    act(() => {
      unregister = registerCanvasRichTextFormattingSession({
        nodeId: 'text-0',
        editor,
        defaultTextColor: 'var(--t-purple)',
        setDefaultTextColor,
      })
    })

    try {
      emitSelection([createNode('text', { textColor: 'var(--t-purple)' })])

      const textColorPicker = colorPickerMock.props[0]
      expect(textColorPicker).toBeDefined()

      act(() => {
        ;(textColorPicker?.onChange as (value: { color: string; opacity: number }) => void)?.({
          color: '#123456',
          opacity: 100,
        })
      })

      expect(editor.addStyles).toHaveBeenCalledWith({ textColor: '#123456' })
      expect(editor.focus).toHaveBeenCalled()
      expect(setDefaultTextColor).not.toHaveBeenCalled()
      expect(updateNodeData).not.toHaveBeenCalledWith('text-0', { textColor: '#123456' })
    } finally {
      act(() => {
        unregister()
      })
    }
  })

  it('uses the sliced text selection colors instead of the full selected block colors', () => {
    renderToolbar()
    const editor = createFormattingEditor({
      selectedFullContent: [
        { type: 'text', text: 'blue', styles: { textColor: 'var(--t-blue)' } },
        { type: 'text', text: 'red', styles: { textColor: 'var(--t-red)' } },
      ],
      selectedCutContent: [{ type: 'text', text: 'blue', styles: { textColor: 'var(--t-blue)' } }],
      textColor: 'var(--t-blue)',
    }) as unknown as CanvasRichTextFormattingEditor
    let unregister: () => void = () => undefined
    act(() => {
      unregister = registerCanvasRichTextFormattingSession({
        nodeId: 'text-0',
        editor,
        defaultTextColor: 'var(--foreground)',
        setDefaultTextColor: vi.fn(),
      })
    })

    try {
      emitSelection([createNode('text', { textColor: 'var(--foreground)' })])

      const textGroup = screen.getByText('Text').parentElement
      expect(textGroup).not.toBeNull()
      expect(within(textGroup!).getByRole('button', { name: 'Select Blue color' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(colorPickerMock.props[0]?.mixed).toBe(false)
    } finally {
      act(() => {
        unregister()
      })
    }
  })

  it('preserves existing unstyled rich text when changing the active editor default color', () => {
    const { updateNodeData } = renderToolbar()
    const editor = createFormattingEditor({
      hasTextSelection: false,
      selectedFullContent: [
        { type: 'text', text: 'existing default' },
        { type: 'text', text: 'existing red', styles: { textColor: 'var(--t-red)' } },
      ],
      textColor: 'var(--t-purple)',
    }) as unknown as CanvasRichTextFormattingEditor
    let unregister: () => void = () => undefined
    act(() => {
      unregister = registerCanvasRichTextFormattingSession({
        nodeId: 'text-0',
        editor,
        defaultTextColor: 'var(--t-purple)',
        setDefaultTextColor: vi.fn((textColor: string) => {
          updateNodeData('text-0', { textColor })
        }),
      })
    })

    try {
      emitSelection([createNode('text', { textColor: 'var(--t-purple)' })])

      const textGroup = screen.getByText('Text').parentElement
      expect(textGroup).not.toBeNull()

      fireEvent.click(within(textGroup!).getByRole('button', { name: 'Select Red color' }))

      expect(editor.replaceBlocks).toHaveBeenCalledWith(editor.document, [
        {
          id: 'paragraph-1',
          type: 'paragraph',
          props: {},
          content: [
            {
              type: 'text',
              text: 'existing default',
              styles: { textColor: 'var(--t-purple)' },
            },
            { type: 'text', text: 'existing red', styles: { textColor: 'var(--t-red)' } },
          ],
        },
      ])
      expect(editor.addStyles).toHaveBeenCalledWith({ textColor: 'var(--t-red)' })
      expect(editor.focus).toHaveBeenCalled()
      expect(updateNodeData).toHaveBeenCalledWith('text-0', { textColor: 'var(--t-red)' })
    } finally {
      act(() => {
        unregister()
      })
    }
  })

  it('preserves existing default-colored rich text through the BlockNote document state', () => {
    const { updateNodeData } = renderToolbar()
    const editor = createFormattingEditor({
      hasTextSelection: false,
      selectedFullContent: [{ type: 'text', text: 'existing default' }],
      textColor: 'var(--t-purple)',
    }) as unknown as CanvasRichTextFormattingEditor & {
      _tiptapEditor: {
        view: {
          dispatch: ReturnType<typeof vi.fn>
          state: {
            doc: {
              descendants: (
                callback: (
                  node: { isText: boolean; marks: Array<never>; nodeSize: number },
                  position: number,
                ) => void,
              ) => void
            }
            schema: {
              marks: {
                textColor: {
                  create: ReturnType<typeof vi.fn>
                }
              }
            }
            tr: {
              addMark: ReturnType<typeof vi.fn>
              setSelection: ReturnType<typeof vi.fn>
            }
          }
        }
      }
    }
    editor._tiptapEditor.view.state.doc = {
      descendants: vi.fn((callback) => {
        callback({ isText: true, marks: [], nodeSize: 16 }, 1)
      }),
    }
    editor._tiptapEditor.view.state.schema = {
      marks: {
        textColor: {
          create: vi.fn((attributes: { stringValue: string }) => attributes),
        },
      },
    }
    editor._tiptapEditor.view.state.tr = {
      ...editor._tiptapEditor.view.state.tr,
      addMark: vi.fn((from: number, to: number, mark: unknown) => ({ from, mark, to })),
    }
    let unregister: () => void = () => undefined
    act(() => {
      unregister = registerCanvasRichTextFormattingSession({
        nodeId: 'text-0',
        editor,
        defaultTextColor: 'var(--t-purple)',
        setDefaultTextColor: vi.fn((textColor: string) => {
          updateNodeData('text-0', { textColor })
        }),
      })
    })

    try {
      emitSelection([createNode('text', { textColor: 'var(--t-purple)' })])

      const textGroup = screen.getByText('Text').parentElement
      expect(textGroup).not.toBeNull()

      fireEvent.click(within(textGroup!).getByRole('button', { name: 'Select Red color' }))

      expect(editor._tiptapEditor.view.state.doc.descendants).not.toHaveBeenCalled()
      expect(editor._tiptapEditor.view.state.schema.marks.textColor.create).not.toHaveBeenCalled()
      expect(editor._tiptapEditor.view.state.tr.addMark).not.toHaveBeenCalled()
      expect(editor._tiptapEditor.view.dispatch).not.toHaveBeenCalled()
      expect(editor.replaceBlocks).toHaveBeenCalledWith(editor.document, [
        {
          id: 'paragraph-1',
          type: 'paragraph',
          props: {},
          content: [
            {
              type: 'text',
              text: 'existing default',
              styles: { textColor: 'var(--t-purple)' },
            },
          ],
        },
      ])
      expect(updateNodeData).toHaveBeenCalledWith('text-0', { textColor: 'var(--t-red)' })
    } finally {
      act(() => {
        unregister()
      })
    }
  })

  it('preserves existing default-colored rich text when changing to a custom default color', () => {
    const { updateNodeData } = renderToolbar()
    const editor = createFormattingEditor({
      hasTextSelection: false,
      selectedFullContent: [{ type: 'text', text: 'existing default' }],
      textColor: 'var(--t-purple)',
    }) as unknown as CanvasRichTextFormattingEditor
    let unregister: () => void = () => undefined
    act(() => {
      unregister = registerCanvasRichTextFormattingSession({
        nodeId: 'text-0',
        editor,
        defaultTextColor: 'var(--t-purple)',
        setDefaultTextColor: vi.fn((textColor: string) => {
          updateNodeData('text-0', { textColor })
        }),
      })
    })

    try {
      emitSelection([createNode('text', { textColor: 'var(--t-purple)' })])

      const textColorPicker = colorPickerMock.props[0]
      expect(textColorPicker).toBeDefined()

      act(() => {
        ;(textColorPicker?.onChange as (value: { color: string; opacity: number }) => void)?.({
          color: '#123456',
          opacity: 100,
        })
      })

      expect(editor.replaceBlocks).toHaveBeenCalledWith(editor.document, [
        {
          id: 'paragraph-1',
          type: 'paragraph',
          props: {},
          content: [
            {
              type: 'text',
              text: 'existing default',
              styles: { textColor: 'var(--t-purple)' },
            },
          ],
        },
      ])
      expect(editor.addStyles).toHaveBeenCalledWith({ textColor: '#123456' })
      expect(updateNodeData).toHaveBeenCalledWith('text-0', { textColor: '#123456' })
    } finally {
      act(() => {
        unregister()
      })
    }
  })

  it('supports selecting the border stroke preset', () => {
    const { updateNodeData } = renderToolbar()

    const text = createNode('text', {
      backgroundColor: 'var(--background)',
      borderStroke: 'var(--foreground)',
      borderOpacity: 100,
    })
    emitSelection([text])

    const strokeGroup = screen.getByText('Stroke').parentElement
    expect(strokeGroup).not.toBeNull()

    fireEvent.click(within(strokeGroup!).getByRole('button', { name: 'Select Border color' }))

    expect(updateNodeData).toHaveBeenCalledWith(text.id, {
      borderOpacity: 100,
      borderStroke: 'var(--border)',
    })
  })

  it('prevents text color swatch pointer down from taking focus from the active editor', () => {
    renderToolbar()
    emitSelection([createNode('text', { textColor: 'var(--t-blue)' })])

    const textGroup = screen.getByText('Text').parentElement
    expect(textGroup).not.toBeNull()

    const redButton = within(textGroup!).getByRole('button', { name: 'Select Red color' })
    const event = new MouseEvent('pointerdown', { bubbles: true, cancelable: true })

    redButton.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('fans out shared opacity updates to every selected node', () => {
    const { transact, updateNodeData } = renderToolbar()

    const firstStroke = createNode('stroke', { color: 'var(--foreground)', opacity: 20 })
    const secondStroke = createNode('stroke', { color: 'var(--foreground)', opacity: 20 })
    emitSelection([firstStroke, secondStroke])

    act(() => {
      // props[0] is the stroke color picker for the selected stroke nodes.
      ;(
        colorPickerMock.props[0]?.onChange as
          | ((value: { color: string; opacity: number }) => void)
          | undefined
      )?.({
        color: 'var(--foreground)',
        opacity: 42,
      })
    })

    expect(updateNodeData).toHaveBeenCalledWith(firstStroke.id, {
      color: 'var(--foreground)',
      opacity: 42,
    })
    expect(updateNodeData).toHaveBeenCalledWith(secondStroke.id, {
      color: 'var(--foreground)',
      opacity: 42,
    })
    expect(transact).toHaveBeenCalledTimes(1)
  })

  it('fans out shared fill opacity updates to every selected node', () => {
    const { updateNodeData } = renderToolbar()

    const firstText = createNode('text', {
      backgroundColor: 'var(--background)',
      backgroundOpacity: 40,
      borderStroke: 'var(--border)',
      borderOpacity: 100,
      borderWidth: 1,
    })
    const secondText = createNode('text', {
      backgroundColor: 'var(--background)',
      backgroundOpacity: 40,
      borderStroke: 'var(--border)',
      borderOpacity: 100,
      borderWidth: 1,
    })
    emitSelection([firstText, secondText])

    act(() => {
      // props[1] is the fill color picker; text color is rendered before fill.
      ;(
        colorPickerMock.props[1]?.onChange as
          | ((value: { color: string; opacity: number }) => void)
          | undefined
      )?.({
        color: 'var(--background)',
        opacity: 65,
      })
    })

    expect(updateNodeData).toHaveBeenCalledWith(firstText.id, {
      backgroundColor: 'var(--background)',
      backgroundOpacity: 65,
    })
    expect(updateNodeData).toHaveBeenCalledWith(secondText.id, {
      backgroundColor: 'var(--background)',
      backgroundOpacity: 65,
    })
  })

  it('shows the reverse primary swatch for fill and applies it to selected nodes', () => {
    const { updateNodeData } = renderToolbar()

    const text = createNode('text', {
      backgroundColor: 'var(--background)',
      backgroundOpacity: 100,
      borderStroke: 'var(--border)',
      borderOpacity: 100,
      borderWidth: 1,
    })
    emitSelection([text])

    const fillGroup = screen.getByText('Fill').parentElement
    expect(fillGroup).not.toBeNull()

    fireEvent.click(
      within(fillGroup!).getByRole('button', { name: 'Select Reverse primary color' }),
    )

    expect(updateNodeData).toHaveBeenCalledWith(text.id, {
      backgroundColor: 'var(--foreground)',
      backgroundOpacity: 100,
    })
  })

  it('shows a primary border preset instead of a default preset', () => {
    renderToolbar()

    emitSelection([
      createNode('text', {
        backgroundColor: 'var(--background)',
        backgroundOpacity: 100,
        borderStroke: 'var(--border)',
        borderOpacity: 100,
        borderWidth: 1,
      }),
    ])

    const strokeGroup = screen.getByText('Stroke').parentElement
    expect(strokeGroup).not.toBeNull()

    expect(within(strokeGroup!).queryByRole('button', { name: 'Select Default color' })).toBeNull()
    expect(within(strokeGroup!).getByRole('button', { name: 'Select Primary color' })).toBeVisible()
    expect(within(strokeGroup!).getByRole('button', { name: 'Select Border color' })).toBeVisible()
    expect(within(strokeGroup!).queryByRole('button', { name: 'Select Clear color' })).toBeNull()
  })

  it('shows fill, border, and stroke size controls for embed nodes', () => {
    renderToolbar()

    emitSelection([
      createNode('embed', {
        sidebarItemId: 'sidebar-item-1',
        backgroundColor: 'var(--background)',
        backgroundOpacity: 100,
        borderStroke: 'var(--border)',
        borderOpacity: 100,
        borderWidth: 1,
      }),
    ])

    expect(screen.getByText('Fill')).toBeVisible()
    expect(screen.getAllByText('Stroke')).toHaveLength(1)
    expect(screen.getByText('Stroke size')).toBeVisible()
  })

  it('fans out shared border width updates to selected text and embed nodes', () => {
    const { transact, updateNodeData } = renderToolbar()

    const text = createNode('text', {
      backgroundColor: 'var(--background)',
      borderStroke: 'var(--border)',
      borderWidth: 1,
    })
    const embed = createNode('embed', {
      sidebarItemId: 'sidebar-item-1',
      backgroundColor: 'var(--background)',
      borderStroke: 'var(--border)',
      borderWidth: 1,
    })
    emitSelection([text, embed])

    commitStrokeSize(7)

    expect(updateNodeData).toHaveBeenCalledWith(text.id, { borderWidth: 7 })
    expect(updateNodeData).toHaveBeenCalledWith(embed.id, { borderWidth: 7 })
    expect(transact).toHaveBeenCalledTimes(1)
  })

  it('renders mixed state for shared properties with different values', () => {
    renderToolbar()

    emitSelection([
      createNode('text', { backgroundColor: '#FFEBA1', borderStroke: null }),
      createNode('text', { backgroundColor: 'var(--t-red)', borderStroke: null }),
    ])

    const fillGroup = screen.getByText('Fill').parentElement
    expect(fillGroup).not.toBeNull()

    expect(
      within(fillGroup!).getByRole('button', { name: 'Select Primary color' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(within(fillGroup!).getByRole('button', { name: 'Select Red color' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getAllByTestId('color-picker-popover')).toHaveLength(3)
  })

  it('does not select a color preset for an opacity-zero custom color', () => {
    useCanvasToolStore.getState().setActiveTool('draw')
    renderToolbar()

    act(() => {
      useCanvasToolStore.getState().setStrokeColor('var(--t-red)')
      useCanvasToolStore.getState().setStrokeOpacity(0)
    })
    emitSelection([])

    const strokeGroup = screen.getByText('Stroke').parentElement
    expect(strokeGroup).not.toBeNull()

    expect(within(strokeGroup!).getByRole('button', { name: 'Select Red color' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('selecting border then a color unselects the border preset', () => {
    useCanvasToolStore.getState().setActiveTool('draw')
    renderToolbar()
    emitSelection([])

    const strokeGroup = screen.getByText('Stroke').parentElement
    expect(strokeGroup).not.toBeNull()

    const borderButton = within(strokeGroup!).getByRole('button', { name: 'Select Border color' })
    const redButton = within(strokeGroup!).getByRole('button', { name: 'Select Red color' })

    fireEvent.click(borderButton)
    expect(borderButton).toHaveAttribute('aria-pressed', 'true')
    expect(redButton).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(redButton)
    expect(borderButton).toHaveAttribute('aria-pressed', 'false')
    expect(redButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows only the shared stroke size control when a mixed selection has no shared paint properties', () => {
    renderToolbar()

    emitSelection([
      createNode('text', { backgroundColor: 'var(--background)', borderStroke: 'var(--border)' }),
      createNode('stroke', { color: 'var(--foreground)' }),
    ])

    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
    expect(screen.getByText('Stroke size')).toBeVisible()
    expect(getStrokeSizeSlider()).toBeVisible()
    expect(screen.queryByText('Fill')).toBeNull()
    expect(screen.getByText('Stroke')).toBeVisible()
  })

  it('shows edge stroke controls for an edge-only selection', () => {
    useCanvasToolStore.getState().setActiveTool('draw')

    renderToolbar()
    const edge = createEdge()
    edgesMock.edges = [edge]
    emitSelectionState(selectionSnapshot(new Set<string>(), new Set([edge.id])))

    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
    expect(screen.getByText('Stroke')).toBeVisible()
    expect(screen.getByText('Stroke size')).toBeVisible()
    expect(getStrokeSizeSlider()).toHaveAttribute('min', '1')
    expect(screen.getByText('Reorder')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Send to back' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Bring to front' })).toHaveClass('cursor-pointer')
    expect(screen.queryByText('Fill')).toBeNull()
  })

  it('updates selected edge stroke color and width through the document writer', () => {
    const patchEdge = vi.fn()
    renderToolbar({ patchEdge })
    const edge = createEdge({ stroke: 'var(--foreground)', strokeWidth: 1.5 })
    edgesMock.edges = [edge]
    emitSelectionState(selectionSnapshot(new Set<string>(), new Set([edge.id])))

    fireEvent.click(screen.getByRole('button', { name: 'Select Red color' }))
    commitStrokeSize(8)

    expect(patchEdge).toHaveBeenNthCalledWith(1, edge.id, {
      style: {
        opacity: undefined,
        stroke: 'var(--t-red)',
      },
    })
    expect(patchEdge).toHaveBeenNthCalledWith(2, edge.id, {
      style: {
        strokeWidth: 8,
      },
    })
  })

  it('commits one-digit and two-digit stroke sizes from the numeric input', () => {
    useCanvasToolStore.getState().setActiveTool('draw')

    renderToolbar()
    emitSelection([])

    let input = getStrokeSizeInput()

    fireEvent.change(input, { target: { value: '9' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useCanvasToolStore.getState().strokeSize).toBe(9)
    expect(getStrokeSizeInput()).toHaveValue('9')

    input = getStrokeSizeInput()
    fireEvent.change(input, { target: { value: '99' } })
    fireEvent.blur(input)
    expect(useCanvasToolStore.getState().strokeSize).toBe(99)
    expect(getStrokeSizeInput()).toHaveValue('99')
  })

  it('clamps the draw tool stroke size to one when the shared store contains zero', () => {
    useCanvasToolStore.getState().setActiveTool('draw')
    useCanvasToolStore.getState().setStrokeSize(0)

    renderToolbar()
    emitSelection([])

    expect(getStrokeSizeSlider()).toHaveAttribute('min', '1')
    expect(getStrokeSizeInput()).toHaveValue('1')
  })

  it('rejects invalid numeric input drafts and restores the current stroke size', () => {
    useCanvasToolStore.getState().setActiveTool('draw')

    renderToolbar()
    emitSelection([])

    const input = getStrokeSizeInput()

    fireEvent.change(input, { target: { value: '7a8' } })
    expect(input).toHaveValue('78')

    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(useCanvasToolStore.getState().strokeSize).toBe(4)
    expect(input).toHaveValue('4')

    fireEvent.change(input, { target: { value: '123' } })
    expect(input).toHaveValue('12')
  })

  it('clamps selected edge stroke size to one when zero is committed', () => {
    const patchEdge = vi.fn((edgeId: string, patch: CanvasEdgePatch) => {
      edgesMock.edges = edgesMock.edges.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              ...patch,
              style: patch.style ? { ...edge.style, ...patch.style } : edge.style,
            }
          : edge,
      )
    })
    renderToolbar({ patchEdge })
    const edge = createEdge({ stroke: 'var(--foreground)', strokeWidth: 2 })
    edgesMock.edges = [edge]
    emitSelectionState(selectionSnapshot(new Set<string>(), new Set([edge.id])))

    const strokeGroup = screen.getByText('Stroke').parentElement
    expect(strokeGroup).not.toBeNull()

    commitStrokeSize(0)
    emitSelectionState(selectionSnapshot(new Set<string>(), new Set([edge.id])))

    const borderButton = within(strokeGroup!).getByRole('button', { name: 'Select Border color' })
    const colorPickerButton = within(strokeGroup!).getByRole('button', {
      name: 'Open color picker',
    })

    expect(patchEdge).toHaveBeenLastCalledWith(edge.id, {
      style: {
        strokeWidth: 1,
      },
    })
    expect(getStrokeSizeInput()).toHaveValue('1')
    expect(borderButton).toBeEnabled()
    expect(colorPickerButton).toBeEnabled()

    commitStrokeSize(6)
    emitSelectionState(selectionSnapshot(new Set<string>(), new Set([edge.id])))

    expect(within(strokeGroup!).getByRole('button', { name: 'Select Border color' })).toBeEnabled()
    expect(
      within(strokeGroup!).getByRole('button', {
        name: 'Open color picker',
      }),
    ).toBeEnabled()
  })

  it('shows an empty mixed stroke size input until a concrete shared value is chosen', () => {
    const firstNode = createNode('text', {
      backgroundColor: 'var(--background)',
      borderStroke: 'var(--border)',
      borderWidth: 2,
    })
    const secondNode = createNode('text', {
      backgroundColor: 'var(--background)',
      borderStroke: 'var(--border)',
      borderWidth: 8,
    })
    const updateNodeData = vi.fn((nodeId: string, data: Record<string, unknown>) => {
      nodesMock.nodes = nodesMock.nodes.map((node) =>
        node.id === nodeId ? ({ ...node, data: { ...node.data, ...data } } as Node) : node,
      )
    })

    renderToolbar({ updateNodeData })

    emitSelection([firstNode, secondNode])

    const input = getStrokeSizeInput()
    expect(input).toHaveValue('')
    expect(input).toHaveAttribute('placeholder', '--')

    commitStrokeSize(11)
    emitSelectionState(selectionSnapshot(new Set([firstNode.id, secondNode.id])))

    expect(updateNodeData).toHaveBeenCalledWith(firstNode.id, { borderWidth: 11 })
    expect(updateNodeData).toHaveBeenCalledWith(secondNode.id, { borderWidth: 11 })
    expect(getStrokeSizeInput()).toHaveValue('11')
  })

  it('shows one shared stroke row for mixed line selections across nodes and edges', () => {
    renderToolbar()
    const text = createNode('text', {
      backgroundColor: 'var(--background)',
      backgroundOpacity: 100,
      borderStroke: 'var(--border)',
      borderOpacity: 100,
      borderWidth: 1,
    })
    const stroke = createNode('stroke', { color: 'var(--foreground)', opacity: 100, size: 4 })
    const edge = createEdge({ stroke: 'var(--foreground)', strokeWidth: 2 })
    nodesMock.nodes = [text, stroke]
    edgesMock.edges = [edge]
    emitSelectionState(selectionSnapshot(new Set([text.id, stroke.id]), new Set([edge.id])))

    expect(screen.queryByText('Fill')).toBeNull()
    expect(screen.getByText('Stroke')).toBeVisible()
    expect(screen.getAllByText('Stroke')).toHaveLength(1)
    expect(screen.getByText('Stroke size')).toBeVisible()
  })

  it('shows edge type controls for selected edges and updates every selected edge type', () => {
    const transact = vi.fn((fn: () => void) => fn())
    const patchEdge = vi.fn()
    renderToolbar({ patchEdge, transact })
    const firstEdge = createEdge({ type: 'bezier' })
    const secondEdge = createEdge({ type: 'straight' })
    edgesMock.edges = [firstEdge, secondEdge]
    emitSelectionState(selectionSnapshot(new Set<string>(), new Set([firstEdge.id, secondEdge.id])))

    expect(screen.getByText('Edge type')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Change edge type to Bezier' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Change edge type to Straight' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Change edge type to Step' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Change edge type to Step' }))

    expect(transact).toHaveBeenCalledTimes(1)
    expect(patchEdge).toHaveBeenCalledTimes(2)
    expect(patchEdge).toHaveBeenNthCalledWith(1, firstEdge.id, { type: 'step' })
    expect(patchEdge).toHaveBeenNthCalledWith(2, secondEdge.id, { type: 'step' })
  })

  it('shows the active edge type when all selected edges match', () => {
    renderToolbar()
    const firstEdge = createEdge({ type: 'straight' })
    const secondEdge = createEdge({ type: 'straight' })
    edgesMock.edges = [firstEdge, secondEdge]
    emitSelectionState(selectionSnapshot(new Set<string>(), new Set([firstEdge.id, secondEdge.id])))

    expect(screen.getByRole('button', { name: 'Change edge type to Straight' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Change edge type to Bezier' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('hides edge type controls for mixed node and edge selections', () => {
    renderToolbar()
    const node = createNode('stroke', { color: 'var(--foreground)', opacity: 100, size: 4 })
    const edge = createEdge({ type: 'straight' })
    nodesMock.nodes = [node]
    edgesMock.edges = [edge]
    emitSelectionState(selectionSnapshot(new Set([node.id]), new Set([edge.id])))

    expect(screen.queryByText('Edge type')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Change edge type to Straight' })).toBeNull()
    expect(screen.getByText('Reorder')).toBeVisible()
  })

  it('runs the shared reorder command from the toolbar for mixed selections', () => {
    const reorderRun = vi.fn(() => true)
    const reorderCanRun = vi.fn(() => true)
    renderToolbar({
      commands: {
        ...createCanvasRuntime().commands,
        reorder: {
          id: 'reorder',
          canRun: reorderCanRun,
          run: reorderRun,
        },
      },
    })

    const node = createNode('stroke', { color: 'var(--foreground)', opacity: 100, size: 4 })
    const edge = createEdge()
    nodesMock.nodes = [node]
    edgesMock.edges = [edge]
    emitSelectionState(selectionSnapshot(new Set([node.id]), new Set([edge.id])))

    fireEvent.click(screen.getByRole('button', { name: 'Bring to front' }))

    expect(reorderCanRun).toHaveBeenCalledWith({
      selection: selectionSnapshot(new Set([node.id]), new Set([edge.id])),
      direction: 'sendToBack',
    })
    expect(reorderCanRun).toHaveBeenCalledWith({
      selection: selectionSnapshot(new Set([node.id]), new Set([edge.id])),
      direction: 'sendBackward',
    })
    expect(reorderCanRun).toHaveBeenCalledWith({
      selection: selectionSnapshot(new Set([node.id]), new Set([edge.id])),
      direction: 'bringForward',
    })
    expect(reorderCanRun).toHaveBeenCalledWith({
      selection: selectionSnapshot(new Set([node.id]), new Set([edge.id])),
      direction: 'bringToFront',
    })
    expect(reorderRun).toHaveBeenCalledWith({
      selection: selectionSnapshot(new Set([node.id]), new Set([edge.id])),
      direction: 'bringToFront',
    })
    expect(screen.getByText('Reorder')).toBeVisible()
  })

  it('hides the toolbar while marquee selection is still provisional', () => {
    renderToolbar()
    emitSelection([createNode('stroke', { color: 'var(--foreground)', opacity: 75 })])

    act(() => {
      getToolbarEngine().beginSelectionGesture('marquee', 'replace')
    })

    expect(screen.queryByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeNull()

    act(() => {
      getToolbarEngine().cancelSelectionGesture()
    })

    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
  })

  it('marks the toolbar content as non-selectable', () => {
    useCanvasToolStore.getState().setActiveTool('draw')

    renderToolbar()
    emitSelection([])

    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toHaveClass(
      'select-none',
    )
  })
})
