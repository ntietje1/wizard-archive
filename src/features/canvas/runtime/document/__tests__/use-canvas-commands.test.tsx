import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCanvasDocumentCommands } from '../use-canvas-commands'
import { useCanvasClipboardStore } from '../../context-menu/use-canvas-clipboard-store'
import * as canvasDocumentCommands from '../canvas-document-commands'
import type { CanvasReorderDirection } from '../canvas-reorder'
import type { CanvasSelectionSnapshot } from '../../../system/canvas-selection'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from 'convex/canvases/validation'
import * as Y from 'yjs'

function createNode(id: string, zIndex: number, width = 20, height = 10): Node {
  return {
    id,
    type: 'text',
    position: { x: zIndex * 10, y: zIndex * 10 },
    width,
    height,
    data: {},
    zIndex,
  }
}

function createEdge(id: string, source: string, target: string, zIndex: number): Edge {
  return {
    id,
    type: 'bezier',
    source,
    target,
    zIndex,
  }
}

function createSelectionController(initialSelection: CanvasSelectionSnapshot) {
  let selection = initialSelection

  return {
    getSnapshot: vi.fn(() => selection),
    setSelection: vi.fn((nextSelection: CanvasSelectionSnapshot) => {
      selection = nextSelection
    }),
    clearSelection: vi.fn(() => {
      selection = selectionSnapshot()
    }),
  }
}

function selectionSnapshot(
  nodeIds: ReadonlySet<string> = new Set<string>(),
  edgeIds: ReadonlySet<string> = new Set<string>(),
): CanvasSelectionSnapshot {
  return { nodeIds, edgeIds }
}

function createCanvasMaps() {
  const doc = new Y.Doc()
  const nodesMap = doc.getMap<Node>('nodes')
  const edgesMap = doc.getMap<Edge>('edges')

  nodesMap.set('node-1', createNode('node-1', 0))
  nodesMap.set('node-2', createNode('node-2', 1))
  nodesMap.set('node-3', createNode('node-3', 2))
  edgesMap.set('edge-1', createEdge('edge-1', 'node-1', 'node-2', 0))
  edgesMap.set('edge-2', createEdge('edge-2', 'node-2', 'node-3', 1))

  return { doc, nodesMap, edgesMap }
}

function getNodeZIndexes(nodesMap: Y.Map<Node>) {
  return Array.from(nodesMap.values())
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node) => ({ id: node.id, zIndex: node.zIndex }))
}

function getEdgeZIndexes(edgesMap: Y.Map<Edge>) {
  return Array.from(edgesMap.values())
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((edge) => ({ id: edge.id, zIndex: edge.zIndex }))
}

function getNodePositions(nodesMap: Y.Map<Node>) {
  return Array.from(nodesMap.values())
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node) => ({ id: node.id, position: node.position }))
}

afterEach(() => {
  useCanvasClipboardStore.setState({ clipboard: null })
})

describe('useCanvasDocumentCommands', () => {
  it('copies the live selection snapshot into the shared clipboard', () => {
    const { doc, nodesMap, edgesMap } = createCanvasMaps()
    const selection = createSelectionController(selectionSnapshot(new Set(['node-1', 'node-2'])))

    const { result, unmount } = renderHook(() =>
      useCanvasDocumentCommands({
        canEdit: true,
        nodesMap,
        edgesMap,
        selection,
      }),
    )

    expect(result.current.copy.canRun()).toBe(true)

    act(() => {
      expect(result.current.copy.run()).toBe(true)
    })

    expect(useCanvasClipboardStore.getState().clipboard).toMatchObject({
      nodes: [{ id: 'node-1' }, { id: 'node-2' }],
      edges: [{ id: 'edge-1' }],
      pasteCount: 0,
    })

    unmount()
    doc.destroy()
  })

  it('cuts an override selection, clears selection, and deletes the selected content', () => {
    const { doc, nodesMap, edgesMap } = createCanvasMaps()
    const selection = createSelectionController(selectionSnapshot(new Set(['node-3'])))

    const { result, unmount } = renderHook(() =>
      useCanvasDocumentCommands({
        canEdit: true,
        nodesMap,
        edgesMap,
        selection,
      }),
    )

    act(() => {
      expect(
        result.current.cut.run({
          selection: selectionSnapshot(new Set(['node-1', 'node-2'])),
        }),
      ).toBe(true)
    })

    expect(selection.clearSelection).toHaveBeenCalledTimes(1)
    expect(nodesMap.has('node-1')).toBe(false)
    expect(nodesMap.has('node-2')).toBe(false)
    expect(edgesMap.has('edge-1')).toBe(false)
    expect(useCanvasClipboardStore.getState().clipboard).toMatchObject({
      nodes: [{ id: 'node-1' }, { id: 'node-2' }],
      edges: [{ id: 'edge-1' }],
    })

    unmount()
    doc.destroy()
  })

  it('does not clear selection or update the clipboard when cut deletion fails', () => {
    const deleteSelectionSpy = vi
      .spyOn(canvasDocumentCommands, 'deleteCanvasSelectionCommand')
      .mockReturnValue(false)
    const { doc, nodesMap, edgesMap } = createCanvasMaps()
    const selection = createSelectionController(selectionSnapshot(new Set(['node-1', 'node-2'])))

    const { result, unmount } = renderHook(() =>
      useCanvasDocumentCommands({
        canEdit: true,
        nodesMap,
        edgesMap,
        selection,
      }),
    )

    act(() => {
      expect(result.current.cut.run()).toBe(false)
    })

    expect(selection.clearSelection).not.toHaveBeenCalled()
    expect(useCanvasClipboardStore.getState().clipboard).toBeNull()
    expect(nodesMap.has('node-1')).toBe(true)
    expect(nodesMap.has('node-2')).toBe(true)

    deleteSelectionSpy.mockRestore()
    unmount()
    doc.destroy()
  })

  it('pastes the clipboard contents, advances pasteCount, and replaces the selection', () => {
    const randomUuidSpy = vi
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000003')
    const { doc, nodesMap, edgesMap } = createCanvasMaps()
    const selection = createSelectionController(selectionSnapshot(new Set(['node-1'])))

    useCanvasClipboardStore.getState().setClipboard({
      nodes: [nodesMap.get('node-1')!, nodesMap.get('node-2')!],
      edges: [edgesMap.get('edge-1')!],
      pasteCount: 0,
    })

    const { result, unmount } = renderHook(() =>
      useCanvasDocumentCommands({
        canEdit: true,
        nodesMap,
        edgesMap,
        selection,
      }),
    )

    let pastedSelection: CanvasSelectionSnapshot | null = null
    act(() => {
      pastedSelection = result.current.paste.run()
    })

    expect(pastedSelection).toEqual({
      nodeIds: new Set([
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
      ]),
      edgeIds: new Set([
        'e-00000000-0000-4000-8000-000000000001-00000000-0000-4000-8000-000000000002-00000000-0000-4000-8000-000000000003',
      ]),
    })
    expect(selection.setSelection).toHaveBeenCalledWith(pastedSelection)
    expect(useCanvasClipboardStore.getState().clipboard?.pasteCount).toBe(1)

    randomUuidSpy.mockRestore()
    unmount()
    doc.destroy()
  })

  it('deletes the live selection and clears it when content was removed', () => {
    const { doc, nodesMap, edgesMap } = createCanvasMaps()
    const selection = createSelectionController(selectionSnapshot(new Set(['node-1', 'node-2'])))

    const { result, unmount } = renderHook(() =>
      useCanvasDocumentCommands({
        canEdit: true,
        nodesMap,
        edgesMap,
        selection,
      }),
    )

    act(() => {
      expect(result.current.delete.run()).toBe(true)
    })

    expect(selection.clearSelection).toHaveBeenCalledTimes(1)
    expect(nodesMap.has('node-1')).toBe(false)
    expect(nodesMap.has('node-2')).toBe(false)
    expect(edgesMap.has('edge-1')).toBe(false)

    unmount()
    doc.destroy()
  })

  it('duplicates the live selection and replaces the selection with the duplicated content', () => {
    const randomUuidSpy = vi
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000011')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000012')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000013')
    const { doc, nodesMap, edgesMap } = createCanvasMaps()
    const selection = createSelectionController(selectionSnapshot(new Set(['node-1', 'node-2'])))

    const { result, unmount } = renderHook(() =>
      useCanvasDocumentCommands({
        canEdit: true,
        nodesMap,
        edgesMap,
        selection,
      }),
    )

    let duplicateSelection: CanvasSelectionSnapshot | null = null
    act(() => {
      duplicateSelection = result.current.duplicate.run()
    })

    expect(duplicateSelection).toEqual({
      nodeIds: new Set([
        '00000000-0000-4000-8000-000000000011',
        '00000000-0000-4000-8000-000000000012',
      ]),
      edgeIds: new Set([
        'e-00000000-0000-4000-8000-000000000011-00000000-0000-4000-8000-000000000012-00000000-0000-4000-8000-000000000013',
      ]),
    })
    expect(selection.setSelection).toHaveBeenCalledWith(duplicateSelection)
    expect(useCanvasClipboardStore.getState().clipboard).toMatchObject({
      nodes: [{ id: 'node-1' }, { id: 'node-2' }],
      edges: [{ id: 'edge-1' }],
      pasteCount: 1,
    })

    randomUuidSpy.mockRestore()
    unmount()
    doc.destroy()
  })

  it.each([
    [
      'sendToBack',
      { id: 'node-1', zIndex: 2 },
      { id: 'node-2', zIndex: 1 },
      { id: 'node-3', zIndex: 5 },
    ],
    [
      'sendBackward',
      { id: 'node-1', zIndex: 1 },
      { id: 'node-2', zIndex: 2 },
      { id: 'node-3', zIndex: 5 },
    ],
    [
      'bringForward',
      { id: 'node-1', zIndex: 1 },
      { id: 'node-2', zIndex: 4 },
      { id: 'node-3', zIndex: 5 },
    ],
    [
      'bringToFront',
      { id: 'node-1', zIndex: 1 },
      { id: 'node-2', zIndex: 5 },
      { id: 'node-3', zIndex: 4 },
    ],
  ] satisfies Array<
    [
      CanvasReorderDirection,
      { id: string; zIndex: number },
      { id: string; zIndex: number },
      { id: string; zIndex: number },
    ]
  >)('reorders node selections with %s', (direction, firstNode, secondNode, thirdNode) => {
    const { doc, nodesMap, edgesMap } = createCanvasMaps()
    const selection = createSelectionController(selectionSnapshot(new Set(['node-2'])))

    const { result, unmount } = renderHook(() =>
      useCanvasDocumentCommands({
        canEdit: true,
        nodesMap,
        edgesMap,
        selection,
      }),
    )

    act(() => {
      expect(result.current.reorder.run({ direction })).toBe(true)
    })

    expect(getNodeZIndexes(nodesMap)).toEqual([firstNode, secondNode, thirdNode])

    unmount()
    doc.destroy()
  })

  it('returns false when reorder is requested without any selected nodes or edges', () => {
    const { doc, nodesMap, edgesMap } = createCanvasMaps()
    const selection = createSelectionController(selectionSnapshot())

    const { result, unmount } = renderHook(() =>
      useCanvasDocumentCommands({
        canEdit: true,
        nodesMap,
        edgesMap,
        selection,
      }),
    )

    expect(result.current.reorder.canRun({ direction: 'bringToFront' })).toBe(false)

    act(() => {
      expect(result.current.reorder.run({ direction: 'bringToFront' })).toBe(false)
    })

    unmount()
    doc.destroy()
  })

  it('arranges selected nodes and ignores selected edges for eligibility', () => {
    const { doc, nodesMap, edgesMap } = createCanvasMaps()
    nodesMap.set('node-1', {
      ...nodesMap.get('node-1')!,
      position: { x: 30, y: 10 },
      width: 20,
      height: 10,
    })
    nodesMap.set('node-2', {
      ...nodesMap.get('node-2')!,
      position: { x: 10, y: 50 },
      width: 40,
      height: 20,
    })
    const selection = createSelectionController(
      selectionSnapshot(new Set(['node-1', 'node-2']), new Set(['edge-1'])),
    )

    const { result, unmount } = renderHook(() =>
      useCanvasDocumentCommands({
        canEdit: true,
        nodesMap,
        edgesMap,
        selection,
      }),
    )

    expect(result.current.arrange.canRun({ action: 'alignLeft' })).toBe(true)

    act(() => {
      expect(result.current.arrange.run({ action: 'alignLeft' })).toBe(true)
    })

    expect(getNodePositions(nodesMap)).toEqual([
      { id: 'node-1', position: { x: 10, y: 10 } },
      { id: 'node-2', position: { x: 10, y: 50 } },
      { id: 'node-3', position: { x: 20, y: 20 } },
    ])

    unmount()
    doc.destroy()
  })

  it('requires enough selected nodes for each arrangement action', () => {
    const { doc, nodesMap, edgesMap } = createCanvasMaps()
    const twoNodeSelection = createSelectionController(
      selectionSnapshot(new Set(['node-1', 'node-2'])),
    )

    const { result, unmount } = renderHook(() =>
      useCanvasDocumentCommands({
        canEdit: true,
        nodesMap,
        edgesMap,
        selection: twoNodeSelection,
      }),
    )

    expect(result.current.arrange.canRun({ action: 'distributeHorizontal' })).toBe(false)
    act(() => {
      expect(result.current.arrange.run({ action: 'distributeHorizontal' })).toBe(false)
    })

    unmount()
    doc.destroy()
  })

  it('does not arrange edge-only selections', () => {
    const { doc, nodesMap, edgesMap } = createCanvasMaps()
    const selection = createSelectionController(
      selectionSnapshot(new Set<string>(), new Set(['edge-1'])),
    )

    const { result, unmount } = renderHook(() =>
      useCanvasDocumentCommands({
        canEdit: true,
        nodesMap,
        edgesMap,
        selection,
      }),
    )

    expect(result.current.arrange.canRun({ action: 'alignLeft' })).toBe(false)

    act(() => {
      expect(result.current.arrange.run({ action: 'alignLeft' })).toBe(false)
    })

    unmount()
    doc.destroy()
  })

  it('reorders edge selections with the same plan used by canRun', () => {
    const { doc, nodesMap, edgesMap } = createCanvasMaps()
    const selection = createSelectionController(
      selectionSnapshot(new Set<string>(), new Set(['edge-1'])),
    )

    const { result, unmount } = renderHook(() =>
      useCanvasDocumentCommands({
        canEdit: true,
        nodesMap,
        edgesMap,
        selection,
      }),
    )

    expect(result.current.reorder.canRun({ direction: 'bringToFront' })).toBe(true)

    act(() => {
      expect(result.current.reorder.run({ direction: 'bringToFront' })).toBe(true)
    })

    expect(getEdgeZIndexes(edgesMap)).toEqual([
      { id: 'edge-1', zIndex: 5 },
      { id: 'edge-2', zIndex: 3 },
    ])

    unmount()
    doc.destroy()
  })
})
