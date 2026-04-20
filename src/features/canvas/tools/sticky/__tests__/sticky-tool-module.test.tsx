import { describe, expect, it, vi } from 'vitest'
import { stickyToolModule } from '../sticky-tool-module'
import {
  createMouseEvent,
  createPlacementEnvironment,
} from '../../shared/__tests__/placement-tool-test-utils'
import type { Node } from '@xyflow/react'

describe('stickyToolModule', () => {
  it('places a sticky node with defaults through the production tool path', () => {
    const { createdNodes, setPendingEditNodeId, setActiveTool, replaceSelection, controller } =
      setupStickyToolTest('sticky')

    expect(controller.onPaneClick).toBeDefined()
    controller.onPaneClick!(createMouseEvent(40, 60))

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
    expect(replaceSelection).toHaveBeenCalledWith({ nodeIds: [createdNodes[0].id], edgeIds: [] })
    expect(setPendingEditNodeId).toHaveBeenCalledWith(createdNodes[0].id)
    expect(setActiveTool).toHaveBeenCalledWith('select')
    expect(createdNodes[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  it('supports placing a sticky node at the canvas origin', () => {
    const { createdNodes, setPendingEditNodeId, setActiveTool, replaceSelection, controller } =
      setupStickyToolTest('sticky')

    expect(controller.onPaneClick).toBeDefined()
    controller.onPaneClick!(createMouseEvent(0, 0))

    expect(createdNodes).toHaveLength(1)
    expect(createdNodes[0]).toMatchObject({
      position: { x: -80, y: -80 },
    })
    expect(replaceSelection).toHaveBeenCalledWith({ nodeIds: [createdNodes[0].id], edgeIds: [] })
    expect(setPendingEditNodeId).toHaveBeenCalledWith(createdNodes[0].id)
    expect(setActiveTool).toHaveBeenCalledWith('select')
  })

  it('does nothing when sticky is not the active tool', () => {
    const { createdNodes, setPendingEditNodeId, setActiveTool, replaceSelection, controller } =
      setupStickyToolTest('select')

    expect(controller.onPaneClick).toBeDefined()
    controller.onPaneClick!(createMouseEvent(40, 60))

    expect(createdNodes).toHaveLength(0)
    expect(replaceSelection).not.toHaveBeenCalled()
    expect(setPendingEditNodeId).not.toHaveBeenCalled()
    expect(setActiveTool).not.toHaveBeenCalled()
  })
})

function setupStickyToolTest(activeTool: 'select' | 'sticky') {
  const createdNodes: Array<Node> = []
  const setPendingEditNodeId = vi.fn()
  const setActiveTool = vi.fn()
  const replaceSelection = vi.fn()
  const controller = stickyToolModule.create(
    createPlacementEnvironment({
      activeTool,
      createNode: (node) => {
        createdNodes.push(node)
      },
      replaceSelection,
      setPendingEditNodeId,
      setActiveTool,
    }),
  )

  return {
    createdNodes,
    setPendingEditNodeId,
    setActiveTool,
    replaceSelection,
    controller,
  }
}
