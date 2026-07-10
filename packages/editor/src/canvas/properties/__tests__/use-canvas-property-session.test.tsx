import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { useCanvasPropertySession } from '../use-canvas-property-session'
import type { CanvasEngine } from '../../system/canvas-engine-types'
import type { CanvasDomRuntime } from '../../system/canvas-dom-runtime'
import type { CanvasDocumentWriter, CanvasNodeActions } from '../../tools/canvas-tool-types'

describe('useCanvasPropertySession', () => {
  it('commits zero-selection property previews after the preview step', () => {
    const events: Array<string> = []
    const canvasEngine = {
      getSnapshot: () => ({ nodeLookup: new Map(), edgeLookup: new Map() }),
    } as unknown as CanvasEngine
    const domRuntime = {
      scheduleNodeDataPatches: vi.fn(() => {
        events.push('preview')
      }),
      scheduleEdgePatches: vi.fn(),
    } as unknown as CanvasDomRuntime
    const documentWriter = {
      patchNodeData: vi.fn(() => {
        events.push('persist')
      }),
      patchEdges: vi.fn(),
    } as unknown as CanvasDocumentWriter
    const nodeActions = {
      transact: (applyChange: () => void) => applyChange(),
    } as unknown as CanvasNodeActions

    const { result } = renderHook(() =>
      useCanvasPropertySession({
        canvasEngine,
        domRuntime,
        documentWriter,
        nodeActions,
        selectedEdgeCount: 0,
        selectedNodeCount: 0,
      }),
    )

    act(() => {
      result.current.runPropertyPreviewChange(() => {
        result.current.patchNodeData('tool-defaults', { textColor: 'var(--t-red)' })
      })
    })
    events.push('after-preview')

    act(() => {
      result.current.commitPropertyPreviewChange()
    })

    expect(events).toEqual(['preview', 'after-preview', 'preview', 'persist'])
  })

  it('cancels pending property previews on unmount', () => {
    const canvasEngine = {
      getSnapshot: () => ({ nodeLookup: new Map(), edgeLookup: new Map() }),
    } as unknown as CanvasEngine
    const domRuntime = {
      scheduleNodeDataPatches: vi.fn(),
      scheduleEdgePatches: vi.fn(),
    } as unknown as CanvasDomRuntime
    const documentWriter = {
      patchNodeData: vi.fn(),
      patchEdges: vi.fn(),
    } as unknown as CanvasDocumentWriter
    const nodeActions = {
      transact: (applyChange: () => void) => applyChange(),
    } as unknown as CanvasNodeActions

    const { result, unmount } = renderHook(() =>
      useCanvasPropertySession({
        canvasEngine,
        domRuntime,
        documentWriter,
        nodeActions,
        selectedEdgeCount: 0,
        selectedNodeCount: 0,
      }),
    )

    act(() => {
      result.current.runPropertyPreviewChange(() => {
        result.current.patchNodeData('tool-defaults', { textColor: 'var(--t-red)' })
      })
    })

    const commitPreviewAfterUnmount = result.current.commitPropertyPreviewChange

    unmount()

    act(() => {
      commitPreviewAfterUnmount()
    })

    expect(documentWriter.patchNodeData).not.toHaveBeenCalled()
    expect(documentWriter.patchEdges).not.toHaveBeenCalled()
  })

  it('restores authoritative node data when a property preview is cancelled', () => {
    const authoritativeData = { borderWidth: 1 }
    const snapshot = {
      nodeLookup: new Map([['node-1', { node: { data: authoritativeData } }]]),
      edgeLookup: new Map(),
    }
    const canvasEngine = {
      getSnapshot: () => snapshot,
    } as unknown as CanvasEngine
    const domRuntime = {
      scheduleNodeDataPatches: vi.fn(),
      scheduleEdgePatches: vi.fn(),
    } as unknown as CanvasDomRuntime
    const documentWriter = {
      patchNodeData: vi.fn(),
      patchEdges: vi.fn(),
    } as unknown as CanvasDocumentWriter

    const { result } = renderHook(() =>
      useCanvasPropertySession({
        canvasEngine,
        domRuntime,
        documentWriter,
        nodeActions: {} as CanvasNodeActions,
        selectedEdgeCount: 0,
        selectedNodeCount: 1,
      }),
    )

    act(() => {
      result.current.runPropertyPreviewChange(() => {
        result.current.patchNodeData('node-1', { borderWidth: 4 })
      })
      result.current.cancelPropertyPreviewChange()
    })

    expect(domRuntime.scheduleNodeDataPatches).toHaveBeenLastCalledWith(
      snapshot,
      new Map([['node-1', authoritativeData]]),
    )
    expect(documentWriter.patchNodeData).not.toHaveBeenCalled()
  })
})
