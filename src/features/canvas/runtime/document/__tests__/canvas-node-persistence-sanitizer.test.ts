import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanitizeNodeForPersistence } from '../canvas-node-persistence-sanitizer'
import { logger } from '~/shared/utils/logger'
import type { Node } from '@xyflow/react'

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

  it('falls back to a parser-safe node when the provided shape is malformed', () => {
    expect(
      sanitizeNodeForPersistence(
        {
          id: 'node-1',
          position: { x: Number.NaN, y: 20 },
          data: 'bad',
        } as unknown as Node,
        'test',
        {
          id: 'fallback-1',
          type: 'embed',
          position: { x: 50, y: 60 },
          data: { sidebarItemId: 'sidebar-1' },
        } as unknown as Node,
      ),
    ).toEqual({
      id: 'fallback-1',
      type: 'embed',
      position: { x: 50, y: 60 },
      data: { sidebarItemId: 'sidebar-1' },
    })
    expect(logger.error).toHaveBeenCalled()
  })

  it('builds a safe fallback from the malformed node when no explicit fallback is provided', () => {
    expect(
      sanitizeNodeForPersistence(
        {
          id: 'node-unsafe',
          type: 'text',
          position: { x: Number.POSITIVE_INFINITY, y: Number.NEGATIVE_INFINITY },
          data: null,
          width: undefined,
          height: null,
        } as unknown as Node,
        'test',
      ),
    ).toEqual({
      id: 'node-unsafe',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    })
    expect(logger.error).toHaveBeenCalled()
  })

  it('strips invalid optional fields from explicit fallback nodes', () => {
    expect(
      sanitizeNodeForPersistence(
        {
          id: 'node-unsafe',
          position: { x: Number.NaN, y: 20 },
          data: 'bad',
        } as unknown as Node,
        'test',
        {
          id: 'fallback-2',
          type: 'text',
          position: { x: Number.MAX_SAFE_INTEGER, y: 3.5 },
          width: undefined,
          height: null,
          data: null,
          selected: true,
        } as unknown as Node,
      ),
    ).toEqual({
      id: 'fallback-2',
      type: 'text',
      position: { x: Number.MAX_SAFE_INTEGER, y: 3.5 },
      data: {},
    })
    expect(logger.error).toHaveBeenCalled()
  })
})
