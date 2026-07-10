import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { useCanvasAwareness } from '../use-canvas-awareness'
import type { ResizingState } from '../../../utils/canvas-awareness-types'
import type { CanvasCollaborationProvider } from '../../../session-contract'

type AwarenessState = Record<string, unknown>
type AwarenessChange = {
  added: Array<number>
  updated: Array<number>
  removed: Array<number>
}
type AwarenessChangeHandler = (change: AwarenessChange) => void

class MockAwareness {
  clientID = 1
  private readonly handlers = new Set<AwarenessChangeHandler>()
  private readonly states = new Map<number, AwarenessState>()
  private localState: AwarenessState | null = null
  lastPresence: unknown = null

  constructor(initialStates: Array<[number, AwarenessState]>) {
    for (const [clientId, state] of initialStates) {
      this.states.set(clientId, state)
    }
    this.localState = this.states.get(this.clientID) ?? null
  }

  getStates() {
    return this.states
  }

  getLocalState() {
    return this.localState
  }

  setLocalStateField(field: string, value: unknown) {
    const nextState = {
      ...this.localState,
      [field]: value,
    }
    this.localState = nextState
    this.states.set(this.clientID, nextState)
    if (field === 'presence') {
      this.lastPresence = value
    }
  }

  on(_event: 'change', handler: AwarenessChangeHandler) {
    this.handlers.add(handler)
  }

  off(_event: 'change', handler: AwarenessChangeHandler) {
    this.handlers.delete(handler)
  }

  getHandlerCount() {
    return this.handlers.size
  }

  setRemoteState(clientId: number, state: AwarenessState) {
    this.states.set(clientId, state)
  }

  emit(change: AwarenessChange) {
    for (const handler of this.handlers) {
      handler(change)
    }
  }
}

function createProvider(awareness: MockAwareness): CanvasCollaborationProvider {
  return { awareness } as unknown as CanvasCollaborationProvider
}

describe('useCanvasAwareness', () => {
  it('parses valid remote core awareness payloads', async () => {
    const awareness = new MockAwareness([
      [
        1,
        {
          user: { name: 'Local', color: '#000' },
          presence: {},
        },
      ],
      [
        2,
        {
          user: { name: 'Remote', color: '#f00' },
          presence: {
            'core.cursor': { x: 5, y: 6 },
            'core.resizing': {
              'node-2': { x: 4, y: 8, width: 100, height: 50 },
            },
            'core.selection': { version: 1, nodeIds: ['node-3'], edgeIds: ['edge-1'] },
            'tool.draw': { color: '#f00' },
          },
        },
      ],
    ])
    const provider = createProvider(awareness)

    const { result } = renderHook(() => useCanvasAwareness(provider))

    await waitFor(() => {
      expect(result.current.remoteUsers).toHaveLength(1)
    })

    expect(result.current.remoteUsers).toEqual([
      {
        clientId: 2,
        user: { name: 'Remote', color: '#f00' },
        presence: {
          'core.cursor': { x: 5, y: 6 },
          'core.resizing': {
            'node-2': { x: 4, y: 8, width: 100, height: 50 },
          },
          'core.selection': { version: 1, nodeIds: ['node-3'], edgeIds: ['edge-1'] },
          'tool.draw': { color: '#f00' },
        },
        cursor: { x: 5, y: 6 },
        resizing: {
          'node-2': { x: 4, y: 8, width: 100, height: 50 },
        },
        selection: { version: 1, nodeIds: ['node-3'], edgeIds: ['edge-1'] },
      },
    ])
  })

  it('keeps local awareness controls stable when the provider does not change', async () => {
    const awareness = new MockAwareness([
      [
        1,
        {
          user: { name: 'Local', color: '#000' },
          presence: {},
        },
      ],
    ])
    const provider = createProvider(awareness)

    const { result, rerender } = renderHook(() => useCanvasAwareness(provider))

    await waitFor(() => {
      expect(awareness.getHandlerCount()).toBe(1)
    })
    const awarenessState = result.current
    const core = result.current.core
    const presence = result.current.presence

    rerender()

    expect(result.current).toBe(awarenessState)
    expect(result.current.core).toBe(core)
    expect(result.current.presence).toBe(presence)
  })

  it('keeps remote clients even when their display user matches the local user', async () => {
    const awareness = new MockAwareness([
      [
        1,
        {
          user: { name: 'Shared', color: '#000' },
          presence: {},
        },
      ],
      [
        2,
        {
          user: { name: 'Shared', color: '#000' },
          presence: {
            'core.selection': { version: 1, nodeIds: ['node-2'], edgeIds: [] },
          },
        },
      ],
    ])
    const provider = createProvider(awareness)

    const { result } = renderHook(() => useCanvasAwareness(provider))

    await waitFor(() => {
      expect(result.current.remoteUsers).toHaveLength(1)
    })
    expect(result.current.remoteUsers[0]).toMatchObject({
      clientId: 2,
      user: { name: 'Shared', color: '#000' },
      selection: { version: 1, nodeIds: ['node-2'], edgeIds: [] },
    })
  })

  it('ignores malformed remote core awareness payloads and invalid presence containers', async () => {
    const awareness = new MockAwareness([
      [
        1,
        {
          user: { name: 'Local', color: '#000' },
          presence: {},
        },
      ],
      [
        2,
        {
          user: { name: 'Remote', color: '#f00' },
          presence: {
            'core.cursor': { x: 'bad', y: 6 },
            'core.resizing': {
              'node-2': { x: 4, y: 8, width: -1, height: 50 },
            },
            'core.selection': { version: 1, nodeIds: ['node-3', 4], edgeIds: [] },
          },
        },
      ],
      [
        3,
        {
          user: { name: 'Remote 2', color: '#0f0' },
          presence: 'bad',
        },
      ],
    ])
    const provider = createProvider(awareness)

    const { result } = renderHook(() => useCanvasAwareness(provider))

    await waitFor(() => {
      expect(result.current.remoteUsers).toHaveLength(2)
    })

    expect(result.current.remoteUsers).toEqual([
      {
        clientId: 2,
        user: { name: 'Remote', color: '#f00' },
        presence: {
          'core.cursor': { x: 'bad', y: 6 },
          'core.resizing': {
            'node-2': { x: 4, y: 8, width: -1, height: 50 },
          },
          'core.selection': { version: 1, nodeIds: ['node-3', 4], edgeIds: [] },
        },
        cursor: null,
        resizing: null,
        selection: null,
      },
      {
        clientId: 3,
        user: { name: 'Remote 2', color: '#0f0' },
        presence: {},
        cursor: null,
        resizing: null,
        selection: null,
      },
    ])
  })

  it('ignores malformed remote user payloads', async () => {
    const awareness = new MockAwareness([
      [
        1,
        {
          user: { name: 'Local', color: '#000' },
          presence: {},
        },
      ],
      [
        2,
        {
          user: { name: 'Remote', color: 42 },
          presence: {
            'core.cursor': { x: 5, y: 6 },
          },
        },
      ],
    ])
    const provider = createProvider(awareness)

    const { result } = renderHook(() => useCanvasAwareness(provider))

    await waitFor(() => {
      expect(result.current.remoteUsers).toEqual([])
    })
  })

  it('clears local core awareness on null and skips invalid writer payloads', async () => {
    const awareness = new MockAwareness([
      [
        1,
        {
          user: { name: 'Local', color: '#000' },
          presence: {
            'core.cursor': { x: 1, y: 2 },
            'tool.draw': { color: '#000' },
          },
        },
      ],
    ])
    const provider = createProvider(awareness)

    const { result } = renderHook(() => useCanvasAwareness(provider))

    await waitFor(() => {
      expect(result.current.remoteUsers).toEqual([])
    })

    act(() => {
      result.current.core.setLocalCursor(null)
    })

    expect(awareness.lastPresence).toEqual({
      'tool.draw': { color: '#000' },
    })

    act(() => {
      result.current.core.setLocalCursor({ x: 10, y: 20 })
      result.current.core.setLocalSelection({
        nodeIds: new Set(['node-1']),
        edgeIds: new Set(['edge-1']),
      })
      result.current.core.setLocalResizing({
        'node-1': { x: 10, y: 20, width: 30, height: 40 },
      })
    })

    expect(awareness.lastPresence).toEqual({
      'tool.draw': { color: '#000' },
      'core.cursor': { x: 10, y: 20 },
      'core.selection': { version: 1, nodeIds: ['node-1'], edgeIds: ['edge-1'] },
      'core.resizing': {
        'node-1': { x: 10, y: 20, width: 30, height: 40 },
      },
    })

    act(() => {
      result.current.core.setLocalSelection({
        nodeIds: new Set(['node-1', 2]) as unknown as Set<string>,
        edgeIds: new Set(),
      })
      result.current.core.setLocalResizing({
        'node-1': { x: 10, y: 20, width: -1, height: 40 },
      } as unknown as ResizingState)
    })

    expect(awareness.lastPresence).toEqual({
      'tool.draw': { color: '#000' },
      'core.cursor': { x: 10, y: 20 },
      'core.selection': { version: 1, nodeIds: ['node-1'], edgeIds: ['edge-1'] },
      'core.resizing': {
        'node-1': { x: 10, y: 20, width: 30, height: 40 },
      },
    })
  })

  it('updates remote users when awareness emits a remote change event', async () => {
    const awareness = new MockAwareness([
      [
        1,
        {
          user: { name: 'Local', color: '#000' },
          presence: {},
        },
      ],
    ])
    const provider = createProvider(awareness)

    const { result } = renderHook(() => useCanvasAwareness(provider))

    await waitFor(() => {
      expect(result.current.remoteUsers).toEqual([])
    })

    act(() => {
      awareness.setRemoteState(2, {
        user: { name: 'Remote', color: '#f00' },
        presence: {
          'core.cursor': { x: 9, y: 12 },
        },
      })
      awareness.emit({ added: [2], updated: [], removed: [] })
    })

    await waitFor(() => {
      expect(result.current.remoteUsers).toEqual([
        {
          clientId: 2,
          user: { name: 'Remote', color: '#f00' },
          presence: {
            'core.cursor': { x: 9, y: 12 },
          },
          cursor: { x: 9, y: 12 },
          resizing: null,
          selection: null,
        },
      ])
    })
  })

  it('unsubscribes from awareness changes on unmount', () => {
    const awareness = new MockAwareness([])
    const provider = createProvider(awareness)

    const { unmount } = renderHook(() => useCanvasAwareness(provider))

    expect(awareness.getHandlerCount()).toBe(1)

    unmount()

    expect(awareness.getHandlerCount()).toBe(0)
  })
})
