import { describe, expect, it, vi } from 'vitest'
import { textToolSpec } from '../text-tool-module'
import {
  createPlacementEnvironment,
  createPointerEvent,
} from '../../shared/__tests__/placement-tool-test-utils'
import type { CanvasNode as Node } from '~/features/canvas/types/canvas-domain-types'

describe('textToolSpec', () => {
  it('creates a default-sized text node on click and requests editing at the click point', () => {
    const createdNodes: Array<Node> = []
    const setPendingEditNodeId = vi.fn()
    const setPendingEditNodePoint = vi.fn()
    const setActiveTool = vi.fn()
    const replaceSelection = vi.fn()
    const controller = textToolSpec.createHandlers(
      createPlacementEnvironment({
        activeTool: 'text',
        createNode: (node) => {
          createdNodes.push(node)
        },
        replaceSelection,
        setPendingEditNodeId,
        setPendingEditNodePoint,
        setActiveTool,
      }),
    )

    controller.onPointerDown?.(createPointerEvent(100, 200))
    controller.onPointerUp?.(createPointerEvent(100, 200))

    expect(createdNodes).toHaveLength(1)
    expect(createdNodes[0]).toMatchObject({
      type: 'text',
      position: { x: -60, y: 80 },
      width: 320,
      height: 240,
      selected: true,
      draggable: true,
    })
    expect(replaceSelection).toHaveBeenCalledWith({
      nodeIds: new Set([createdNodes[0].id]),
      edgeIds: new Set<string>(),
    })
    expect(setPendingEditNodeId).toHaveBeenCalledWith(createdNodes[0].id)
    expect(setPendingEditNodePoint).toHaveBeenCalledWith({ x: 100, y: 200 })
    expect(setActiveTool).toHaveBeenCalledWith('select')
  })

  it('creates a custom-sized text node on drag', () => {
    const createdNodes: Array<Node> = []
    const setActiveTool = vi.fn()
    const controller = textToolSpec.createHandlers(
      createPlacementEnvironment({
        activeTool: 'text',
        createNode: (node) => {
          createdNodes.push(node)
        },
        replaceSelection: vi.fn(),
        setPendingEditNodeId: vi.fn(),
        setPendingEditNodePoint: vi.fn(),
        setActiveTool,
      }),
    )

    controller.onPointerDown?.(createPointerEvent(100, 200))
    controller.onPointerMove?.(createPointerEvent(180, 260))
    controller.onPointerUp?.(createPointerEvent(180, 260))

    expect(createdNodes).toHaveLength(1)
    expect(createdNodes[0]).toMatchObject({
      type: 'text',
      position: { x: 100, y: 200 },
      width: 80,
      height: 60,
    })
    expect(setActiveTool).toHaveBeenCalledWith('select')
  })
})
