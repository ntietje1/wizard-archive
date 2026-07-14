import { act, renderHook } from '@testing-library/react'
import { testCanvasNodeId } from 'shared/test/canvas-node-id'
import { describe, expect, it, vi } from 'vite-plus/test'
import { useRef } from 'react'
import { CANVAS_HANDLE_POSITION } from '../../../types/canvas-domain-types'
import { createCanvasEngine } from '../../../system/canvas-engine'
import { useCanvasConnectionGesture } from '../canvas-connection-gesture'

describe('useCanvasConnectionGesture', () => {
  it('cancels an active connection draft when edit permission is revoked', () => {
    const canvasEngine = createCanvasEngine()
    const createEdgeFromConnection = vi.fn()
    const { pane, sourceHandle, targetHandle } = createConnectionDom()
    const { result, rerender } = renderHook(
      ({ canEdit }: { canEdit: boolean }) => {
        const paneRef = useRef<HTMLDivElement | null>(pane)
        return useCanvasConnectionGesture({
          canEdit,
          canvasEngine,
          createEdgeFromConnection,
          paneRef,
        })
      },
      { initialProps: { canEdit: true } },
    )

    act(() => {
      result.current.onPointerDownCapture(
        createReactPointerEvent(sourceHandle, { clientX: 10, clientY: 10 }),
      )
    })
    expect(result.current.draft).not.toBeNull()

    rerender({ canEdit: false })
    act(() => {
      window.dispatchEvent(
        createPointerEvent('pointerup', targetHandle, { clientX: 40, clientY: 10 }),
      )
    })

    expect(result.current.draft).toBeNull()
    expect(createEdgeFromConnection).not.toHaveBeenCalled()

    canvasEngine.destroy()
  })
})

function createConnectionDom() {
  const pane = document.createElement('div')
  document.body.append(pane)
  const sourceNode = document.createElement('div')
  sourceNode.dataset.nodeId = testCanvasNodeId('source')
  const sourceHandle = createHandle('right', CANVAS_HANDLE_POSITION.Right, {
    left: 0,
    top: 0,
    width: 20,
    height: 20,
  })
  const targetNode = document.createElement('div')
  targetNode.dataset.nodeId = testCanvasNodeId('target')
  const targetHandle = createHandle('left', CANVAS_HANDLE_POSITION.Left, {
    left: 30,
    top: 0,
    width: 20,
    height: 20,
  })

  sourceNode.append(sourceHandle)
  targetNode.append(targetHandle)
  pane.append(sourceNode, targetNode)
  vi.spyOn(pane, 'getBoundingClientRect').mockReturnValue(createDomRect())

  return { pane, sourceHandle, targetHandle }
}

function createHandle(
  handleId: string,
  handlePosition: string,
  rect: { left: number; top: number; width: number; height: number },
) {
  const handle = document.createElement('div')
  handle.dataset.canvasNodeHandle = 'true'
  handle.dataset.handleId = handleId
  handle.dataset.handlePosition = handlePosition
  vi.spyOn(handle, 'getBoundingClientRect').mockReturnValue(createDomRect(rect))
  return handle
}

function createReactPointerEvent(
  target: EventTarget,
  {
    clientX,
    clientY,
    pointerId = 1,
  }: {
    clientX: number
    clientY: number
    pointerId?: number
  },
) {
  return {
    button: 0,
    clientX,
    clientY,
    pointerId,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target,
  } as never
}

function createPointerEvent(
  type: string,
  target: EventTarget,
  {
    clientX,
    clientY,
    pointerId = 1,
  }: {
    clientX: number
    clientY: number
    pointerId?: number
  },
) {
  const event = new Event(type) as PointerEvent
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: pointerId },
    target: { value: target },
  })
  return event
}

function createDomRect({ left = 0, top = 0, width = 0, height = 0 } = {}): DOMRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}
