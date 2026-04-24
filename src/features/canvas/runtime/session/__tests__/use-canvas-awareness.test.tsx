import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCanvasAwareness } from '../use-canvas-awareness'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'
import type { ResizingState } from '../../../utils/canvas-awareness-types'

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

function createProvider(awareness: MockAwareness): ConvexYjsProvider {
  return { awareness } as unknown as ConvexYjsProvider
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
            'core.dragging': {
              'node-1': { x: 10, y: 20 },
            },
            'core.resizing': {
              'node-2': { x: 4, y: 8, width: 100, height: 50 },
            },
            'core.selection': ['node-3'],
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
          'core.dragging': {
            'node-1': { x: 10, y: 20 },
          },
          'core.resizing': {
            'node-2': { x: 4, y: 8, width: 100, height: 50 },
          },
          'core.selection': ['node-3'],
          'tool.draw': { color: '#f00' },
        },
        cursor: { x: 5, y: 6 },
        dragging: {
          'node-1': { x: 10, y: 20 },
        },
        resizing: {
          'node-2': { x: 4, y: 8, width: 100, height: 50 },
        },
        selectedNodeIds: ['node-3'],
      },
    ])
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
            'core.dragging': {
              'node-1': { x: 10, y: 'bad' },
            },
            'core.resizing': {
              'node-2': { x: 4, y: 8, width: -1, height: 50 },
            },
            'core.selection': ['node-3', 4],
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
          'core.dragging': {
            'node-1': { x: 10, y: 'bad' },
          },
          'core.resizing': {
            'node-2': { x: 4, y: 8, width: -1, height: 50 },
          },
          'core.selection': ['node-3', 4],
        },
        cursor: null,
        dragging: null,
        resizing: null,
        selectedNodeIds: null,
      },
      {
        clientId: 3,
        user: { name: 'Remote 2', color: '#0f0' },
        presence: {},
        cursor: null,
        dragging: null,
        resizing: null,
        selectedNodeIds: null,
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
      result.current.core.setLocalDragging({
        'node-1': { x: 30, y: 40 },
      })
      result.current.core.setLocalSelection(new Set(['node-1']))
      result.current.core.setLocalResizing({
        'node-1': { x: 10, y: 20, width: 30, height: 40 },
      })
    })

    expect(awareness.lastPresence).toEqual({
      'tool.draw': { color: '#000' },
      'core.cursor': { x: 10, y: 20 },
      'core.dragging': {
        'node-1': { x: 30, y: 40 },
      },
      'core.selection': ['node-1'],
      'core.resizing': {
        'node-1': { x: 10, y: 20, width: 30, height: 40 },
      },
    })

    act(() => {
      result.current.core.setLocalDragging({
        'node-1': { x: Number.NaN, y: 40 },
      } as unknown as Record<string, { x: number; y: number }>)
      result.current.core.setLocalSelection(new Set(['node-1', 2]) as unknown as Set<string>)
      result.current.core.setLocalResizing({
        'node-1': { x: 10, y: 20, width: -1, height: 40 },
      } as unknown as ResizingState)
    })

    expect(awareness.lastPresence).toEqual({
      'tool.draw': { color: '#000' },
      'core.cursor': { x: 10, y: 20 },
      'core.dragging': {
        'node-1': { x: 30, y: 40 },
      },
      'core.selection': ['node-1'],
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
          dragging: null,
          resizing: null,
          selectedNodeIds: null,
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
