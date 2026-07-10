import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createCanvasNodesById } from '../canvas-node-map'
import type { CanvasDocumentNode as Node } from '../../../document-contract'

function createNode(id: string, x: number): Node {
  return {
    id,
    type: 'text',
    position: { x, y: 0 },
    width: 40,
    height: 40,
    data: {},
  }
}

describe('createCanvasNodesById', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  it('returns an empty map for empty input', () => {
    const nodesById = createCanvasNodesById([])

    expect(nodesById.size).toBe(0)
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('returns a single node entry without warnings', () => {
    const node = createNode('single', 5)
    const nodesById = createCanvasNodesById([node])

    expect(nodesById.size).toBe(1)
    expect(nodesById.get('single')).toEqual(node)
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('returns unique node ids without warnings', () => {
    const nodesById = createCanvasNodesById([createNode('a', 0), createNode('b', 10)])

    expect(nodesById.size).toBe(2)
    expect(nodesById.get('a')?.position).toEqual({ x: 0, y: 0 })
    expect(nodesById.get('b')?.position).toEqual({ x: 10, y: 0 })
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('warns on duplicate node ids and keeps the last entry', () => {
    const nodesById = createCanvasNodesById([createNode('node-1', 0), createNode('node-1', 20)])

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'createCanvasNodesById: duplicate node id "node-1", keeping last entry',
    )
    expect(nodesById.get('node-1')?.position.x).toBe(20)
  })

  it('warns and skips invalid node entries', () => {
    const nodesById = createCanvasNodesById([
      null,
      { id: '' },
      createNode('node-1', 0),
    ] as Array<Node>)

    expect(nodesById.size).toBe(1)
    expect(nodesById.get('node-1')?.position.x).toBe(0)
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'createCanvasNodesById: skipping invalid node entry at index 0',
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'createCanvasNodesById: skipping invalid node entry at index 1',
    )
  })

  it('maps only nodes with anchorable canvas document geometry', () => {
    const anchorableNode = createNode('anchorable', 0)
    const nodesById = createCanvasNodesById([
      anchorableNode,
      {
        id: 'missing-position',
        type: 'text',
        width: 40,
        height: 40,
        data: {},
      },
      {
        id: 'missing-size',
        type: 'text',
        position: { x: 10, y: 0 },
        data: {},
      },
    ] as Array<Node>)

    expect([...nodesById.keys()]).toEqual(['anchorable'])
    expect(nodesById.get('anchorable')).toEqual(anchorableNode)
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2)
  })
})
