import { describe, expect, it, vi } from 'vitest'
import { stickyToolModule } from '../sticky-tool-module'
import { createMouseEvent, createPlacementEnvironment } from '../../shared/__tests__/placement-tool-test-utils'
import type { Node } from '@xyflow/react'

describe('stickyToolModule', () => {
  it('places a sticky node with defaults through the production tool path', () => {
    const createdNodes: Array<Node> = []
    const setPendingEditNodeId = vi.fn()
    const setActiveTool = vi.fn()
    const setNodeSelection = vi.fn()
    const controller = stickyToolModule.create(
      createPlacementEnvironment({
        activeTool: 'sticky',
        createNode: (node) => {
          createdNodes.push(node)
        },
        setNodeSelection,
        setPendingEditNodeId,
        setActiveTool,
      }),
    )

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
    expect(setNodeSelection).toHaveBeenCalledWith([createdNodes[0].id])
    expect(setPendingEditNodeId).toHaveBeenCalledWith(createdNodes[0].id)
    expect(setActiveTool).toHaveBeenCalledWith('select')
  })
})
