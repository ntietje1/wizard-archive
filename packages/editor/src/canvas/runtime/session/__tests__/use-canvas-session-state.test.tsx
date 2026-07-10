import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
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
      selection: { version: 1, nodeIds: ['node-3'], edgeIds: ['edge-1'] },
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
    expect(result.current.remoteNodeHighlights.has('node-1')).toBe(false)
    expect(result.current.remoteNodeHighlights.get('node-2')).toEqual({
      color: '#f00',
      name: 'Remote',
    })
    expect(result.current.remoteEdgeHighlights.get('edge-1')).toEqual({
      color: '#f00',
      name: 'Remote',
    })
    expect(result.current.editSession.editingEmbedId).toBeNull()
    expect(result.current.editSession.pendingEditNodeId).toBeNull()
    expect(result.current.editSession.pendingEditNodePoint).toBeNull()

    act(() => {
      result.current.editSession.setEditingEmbedId('embed-node-1')
      result.current.editSession.setPendingEditNodeId('text-node-1')
      result.current.editSession.setPendingEditNodePoint({ x: 12, y: 34 })
    })

    expect(result.current.editSession.editingEmbedId).toBe('embed-node-1')
    expect(result.current.editSession.pendingEditNodeId).toBe('text-node-1')
    expect(result.current.editSession.pendingEditNodePoint).toEqual({ x: 12, y: 34 })
  })

  it('keeps derived session objects stable when inputs do not change', () => {
    const { result, rerender } = renderHook(() =>
      useCanvasSessionState({
        provider: null,
      }),
    )

    const sessionState = result.current
    const editSession = result.current.editSession
    const remoteResizeDimensions = result.current.remoteResizeDimensions
    const remoteNodeHighlights = result.current.remoteNodeHighlights
    const remoteEdgeHighlights = result.current.remoteEdgeHighlights

    rerender()

    expect(result.current).toBe(sessionState)
    expect(result.current.editSession).toBe(editSession)
    expect(result.current.remoteResizeDimensions).toBe(remoteResizeDimensions)
    expect(result.current.remoteNodeHighlights).toBe(remoteNodeHighlights)
    expect(result.current.remoteEdgeHighlights).toBe(remoteEdgeHighlights)
  })
})
