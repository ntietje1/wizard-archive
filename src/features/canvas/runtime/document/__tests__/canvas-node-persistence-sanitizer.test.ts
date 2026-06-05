import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanitizeNodeForPersistence } from '../canvas-node-persistence-sanitizer'
import { logger } from '~/shared/utils/logger'
import type { CanvasDocumentNode as Node } from '~/features/canvas/domain/canvas-document'
vi.mock('~/shared/utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe('sanitizeNodeForPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preserves valid persisted node fields after stripping ephemeral state', () => {
    expect(
      sanitizeNodeForPersistence(
        {
          id: 'node-1',
          type: 'text',
          position: { x: 10, y: 20 },
          width: 120,
          height: 40,
          data: { content: [{ type: 'paragraph' }] },
          selected: true,
        } as Node,
        'test',
      ),
    ).toEqual({
      id: 'node-1',
      type: 'text',
      position: { x: 10, y: 20 },
      width: 120,
      height: 40,
      data: { content: [{ type: 'paragraph' }] },
    })
  })

  it('rejects malformed nodes instead of persisting fallback content', () => {
    expect(() =>
      sanitizeNodeForPersistence(
        {
          id: 'node-1',
          position: { x: Number.NaN, y: 20 },
          data: 'bad',
        } as unknown as Node,
        'test',
      ),
    ).toThrow('Invalid canvas document node rejected at persistence boundary')
    expect(logger.error).toHaveBeenCalledWith(
      'Canvas node persistence rejected invalid document node',
      expect.objectContaining({
        operation: 'test',
        nodeId: 'node-1',
      }),
    )
  })
})
