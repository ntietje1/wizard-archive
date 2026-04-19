import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasSelectionRect } from '../useCanvasSelectionRect'
import { clearCanvasSelectionState } from '../useCanvasSelectionState'
import { clearSelectToolLocalOverlay } from '../../tools/select/select-tool-local-overlay'

const reactFlowMock = vi.hoisted(() => ({
  screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  getZoom: () => 1,
}))

const storeState = vi.hoisted(() => ({
  userSelectionRect: null as null | { x: number; y: number; width: number; height: number },
  domNode: {
    getBoundingClientRect: () =>
      ({
        left: 0,
        top: 0,
      }) as DOMRect,
  } as HTMLDivElement,
  nodeLookup: new Map(),
}))

const storeApiMock = vi.hoisted(() => {
  let listener: (() => void) | null = null

  return {
    getState: () => storeState,
    subscribe: (nextListener: () => void) => {
      listener = nextListener
      return () => {
        listener = null
      }
    },
    emit: () => listener?.(),
    reset: () => {
      listener = null
      storeState.userSelectionRect = null
      storeState.nodeLookup = new Map()
    },
  }
})

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => reactFlowMock,
  useStoreApi: () => storeApiMock,
}))

describe('useCanvasSelectionRect', () => {
  beforeEach(() => {
    clearSelectToolLocalOverlay()
    clearCanvasSelectionState()
    storeApiMock.reset()
  })

  it('publishes and clears tool.select awareness while marquee selection is active', () => {
    const setPresence = vi.fn()
    const setNodeSelection = vi.fn()
    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      })
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

    const { unmount } = renderHook(() =>
      useCanvasSelectionRect({
        awareness: {
          setPresence,
        },
        setNodeSelection,
        enabled: true,
      }),
    )

    act(() => {
      storeState.userSelectionRect = { x: 10, y: 20, width: 30, height: 40 }
      storeApiMock.emit()
    })

    act(() => {
      storeState.userSelectionRect = null
      storeApiMock.emit()
    })

    expect(setPresence).toHaveBeenCalledWith('tool.select', {
      type: 'rect',
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    })
    expect(setPresence).toHaveBeenLastCalledWith('tool.select', null)
    expect(setNodeSelection).toHaveBeenCalledWith([])

    unmount()
    rafSpy.mockRestore()
    cancelSpy.mockRestore()
  })
})
