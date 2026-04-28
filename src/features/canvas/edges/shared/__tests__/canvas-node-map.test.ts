import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCanvasNodesById } from '../canvas-node-map'
import { logger } from '~/shared/utils/logger'
import type { CanvasDocumentNode as Node } from '~/features/canvas/types/canvas-domain-types'

vi.mock('~/shared/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}))

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an empty map for empty input', () => {
    const nodesById = createCanvasNodesById([])

    expect(nodesById.size).toBe(0)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('returns a single node entry without warnings', () => {
    const node = createNode('single', 5)
    const nodesById = createCanvasNodesById([node])

    expect(nodesById.size).toBe(1)
    expect(nodesById.get('single')).toEqual(node)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('returns unique node ids without warnings', () => {
    const nodesById = createCanvasNodesById([createNode('a', 0), createNode('b', 10)])

    expect(nodesById.size).toBe(2)
    expect(nodesById.get('a')?.position).toEqual({ x: 0, y: 0 })
    expect(nodesById.get('b')?.position).toEqual({ x: 10, y: 0 })
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('warns on duplicate node ids and keeps the last entry', () => {
    const nodesById = createCanvasNodesById([createNode('node-1', 0), createNode('node-1', 20)])

    expect(logger.warn).toHaveBeenCalledWith(
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
    expect(logger.warn).toHaveBeenCalledTimes(2)
    expect(logger.warn).toHaveBeenCalledWith(
      'createCanvasNodesById: skipping invalid node entry at index 0',
    )
    expect(logger.warn).toHaveBeenCalledWith(
      'createCanvasNodesById: skipping invalid node entry at index 1',
    )
  })
})
