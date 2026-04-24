import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCanvasRemoteDragAnimation } from '../use-canvas-remote-drag-animation'

const reactFlowMock = vi.hoisted(() => ({
  setNodes: vi.fn(),
}))

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => reactFlowMock,
}))

describe('useCanvasRemoteDragAnimation', () => {
  it('exposes the spring control API for remote drag animation', () => {
    const { result } = renderHook(() =>
      useCanvasRemoteDragAnimation({
        localDraggingIdsRef: { current: new Set<string>() },
        remoteDragPositions: {},
      }),
    )

    expect(result.current.hasSpring('node-1')).toBe(false)
    expect(() => result.current.setTarget('node-1', { x: 10, y: 20 })).not.toThrow()
    expect(() => result.current.clearNodeSprings(['node-1'])).not.toThrow()
  })
})
