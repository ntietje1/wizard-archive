import { describe, expect, it, vi } from 'vitest'
import { stickyToolModule } from '../sticky-tool-module'
import { textToolModule } from '../text-tool-module'
import type { Node } from '@xyflow/react'

function createMouseEvent(x: number, y: number): React.MouseEvent {
  return {
    clientX: x,
    clientY: y,
  } as React.MouseEvent
}

describe('canvas placement tool modules', () => {
  it('text tool places a text node, requests editing, and completes the action', () => {
    const createdNodes: Array<Node> = []
    const setPendingEditNodeId = vi.fn()
    const completeActiveToolAction = vi.fn()
    const controller = textToolModule.create({
      screenToFlowPosition: ({ x, y }) => ({ x, y }),
      createNode: (node) => {
        createdNodes.push(node)
      },
      completeActiveToolAction,
      setPendingEditNodeId,
    })

    controller.onPaneClick?.(createMouseEvent(100, 200))

    expect(createdNodes).toHaveLength(1)
    expect(createdNodes[0]).toMatchObject({
      type: 'text',
      position: { x: 40, y: 182 },
      selected: true,
      draggable: true,
    })
    expect(setPendingEditNodeId).toHaveBeenCalledWith(createdNodes[0].id)
    expect(completeActiveToolAction).toHaveBeenCalledTimes(1)
  })

  it('sticky tool places a sticky node with defaults through the production tool path', () => {
    const createdNodes: Array<Node> = []
    const setPendingEditNodeId = vi.fn()
    const completeActiveToolAction = vi.fn()
    const controller = stickyToolModule.create({
      screenToFlowPosition: ({ x, y }) => ({ x, y }),
      createNode: (node) => {
        createdNodes.push(node)
      },
      completeActiveToolAction,
      setPendingEditNodeId,
    })

    controller.onPaneClick?.(createMouseEvent(40, 60))

    expect(createdNodes).toHaveLength(1)
    expect(createdNodes[0]).toMatchObject({
      type: 'sticky',
      position: { x: -40, y: -20 },
      selected: true,
      draggable: true,
      data: {
        label: '',
        color: '#FFEBA1',
        opacity: 100,
      },
    })
    expect(setPendingEditNodeId).toHaveBeenCalledWith(createdNodes[0].id)
    expect(completeActiveToolAction).toHaveBeenCalledTimes(1)
  })
})
