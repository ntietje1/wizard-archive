import { describe, expect, it, vi } from 'vitest'
import { textToolModule } from '../text-tool-module'
import {
  createMouseEvent,
  createPlacementEnvironment,
} from '../../shared/__tests__/placement-tool-test-utils'
import type { Node } from '@xyflow/react'

describe('textToolModule', () => {
  it('places a text node, requests editing, and completes the action', () => {
    const createdNodes: Array<Node> = []
    const setPendingEditNodeId = vi.fn()
    const setActiveTool = vi.fn()
    const replaceSelection = vi.fn()
    const controller = textToolModule.create(
      createPlacementEnvironment({
        activeTool: 'text',
        createNode: (node) => {
          createdNodes.push(node)
        },
        replaceSelection,
        setPendingEditNodeId,
        setActiveTool,
      }),
    )

    controller.onPaneClick?.(createMouseEvent(100, 200))

    expect(createdNodes).toHaveLength(1)
    // Text placement centers the default 120x36 node around the click, so (100, 200) becomes
    // (40, 182) after subtracting the half-size offsets of 60 and 18.
    expect(createdNodes[0]).toMatchObject({
      type: 'text',
      position: { x: 40, y: 182 },
      selected: true,
      draggable: true,
    })
    expect(replaceSelection).toHaveBeenCalledWith([createdNodes[0].id])
    expect(setPendingEditNodeId).toHaveBeenCalledWith(createdNodes[0].id)
    expect(setActiveTool).toHaveBeenCalledWith('select')
  })
})
