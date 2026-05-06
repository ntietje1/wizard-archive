import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCanvasSessionState } from '../use-canvas-session-state'

const awarenessMock = vi.hoisted(() => ({
  remoteUsers: [
    {
      clientId: 2,
      user: { name: 'Remote', color: '#f00' },
      presence: {},
      cursor: { x: 5, y: 6 },
      resizing: {
        'node-2': { width: 100, height: 50, x: 4, y: 8 },
      },
      selectedNodeIds: ['node-3'],
    },
  ],
  core: {
    setLocalCursor: vi.fn(),
    setLocalResizing: vi.fn(),
    setLocalSelection: vi.fn(),
  },
  presence: {
    setPresence: vi.fn(),
  },
}))

vi.mock('../use-canvas-awareness', () => ({
  useCanvasAwareness: () => awarenessMock,
}))

describe('useCanvasSessionState', () => {
  it('derives remote session state from shared awareness and exposes edit-session controls', () => {
    const { result } = renderHook(() =>
      useCanvasSessionState({
        provider: null,
      }),
    )

    expect(result.current.awareness).toBe(awarenessMock)
    expect(result.current.remoteUsers).toBe(awarenessMock.remoteUsers)
    expect(result.current.remoteResizeDimensions).toEqual({
      'node-2': { width: 100, height: 50, x: 4, y: 8 },
    })
    expect(result.current.remoteHighlights.has('node-1')).toBe(false)
    expect(result.current.remoteHighlights.get('node-2')).toEqual({
      color: '#f00',
      name: 'Remote',
    })
    expect(result.current.editSession.editingEmbedId).toBeNull()
    expect(result.current.editSession.pendingEditNodeId).toBeNull()
  })
})
