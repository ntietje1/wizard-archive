import { afterEach, describe, expect, it, vi } from 'vitest'
import { readRemoteDrawState, setDrawToolAwareness } from '../draw-tool-awareness'
import type { RemoteUser } from '../../../utils/canvas-awareness-types'

describe('draw tool awareness', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null for invalid remote draw awareness payloads', () => {
    const remoteUser = createRemoteUser({
      'tool.draw': {
        points: [[0, 0, 'bad']],
        color: '#f00',
        size: 4,
        opacity: 50,
      },
    })

    expect(readRemoteDrawState(remoteUser)).toBeNull()
  })

  it('writes valid draw awareness payloads', () => {
    const setPresence = vi.fn()

    setDrawToolAwareness(
      { setPresence },
      {
        points: [
          [0, 0, 0.5],
          [20, 20, 0.5],
        ],
        color: '#f00',
        size: 4,
        opacity: 50,
      },
    )

    expect(setPresence).toHaveBeenCalledWith('tool.draw', {
      points: [
        [0, 0, 0.5],
        [20, 20, 0.5],
      ],
      color: '#f00',
      size: 4,
      opacity: 50,
    })
  })

  it('clears draw awareness on null', () => {
    const setPresence = vi.fn()

    setDrawToolAwareness({ setPresence }, null)

    expect(setPresence).toHaveBeenCalledOnce()
    expect(setPresence).toHaveBeenCalledWith('tool.draw', null)
  })

  it.each([
    {
      label: 'zero size',
      payload: { points: [[0, 0, 0.5]], color: '#f00', size: 0, opacity: 50 },
    },
    {
      label: 'negative size',
      payload: { points: [[0, 0, 0.5]], color: '#f00', size: -1, opacity: 50 },
    },
    {
      label: 'non-string color',
      payload: { points: [[0, 0, 0.5]], color: 42, size: 4, opacity: 50 },
    },
    {
      label: 'malformed point tuple',
      payload: { points: [[0, 0, 'bad']], color: '#f00', size: 4, opacity: 50 },
    },
    {
      label: 'empty points',
      payload: { points: [], color: '#f00', size: 4, opacity: 50 },
    },
  ])('ignores invalid draw payloads with a warning: $label', ({ payload }) => {
    const setPresence = vi.fn()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    setDrawToolAwareness({ setPresence }, payload as never)

    expect(setPresence).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith('Ignoring invalid draw tool awareness payload', payload)
  })
})

function createRemoteUser(presence: RemoteUser['presence']): RemoteUser {
  return {
    clientId: 1,
    user: { name: 'Tester', color: '#f00' },
    presence,
    cursor: null,
    resizing: null,
    selectedNodeIds: null,
  }
}
