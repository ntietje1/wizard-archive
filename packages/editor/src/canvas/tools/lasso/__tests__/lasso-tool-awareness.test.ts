import { describe, expect, it, vi } from 'vite-plus/test'
import { readRemoteLassoState, setLassoToolAwareness } from '../lasso-tool-awareness'
import type { RemoteUser } from '../../../utils/canvas-awareness-types'

describe('lasso tool awareness', () => {
  it('returns parsed lasso state for valid remote lasso awareness payloads', () => {
    const remoteUser = createRemoteUser({
      'tool.lasso': {
        type: 'lasso',
        points: [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 40, y: 40 },
        ],
      },
    })

    expect(readRemoteLassoState(remoteUser)).toEqual({
      type: 'lasso',
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
      ],
    })
  })

  it('returns null for invalid remote lasso awareness payloads', () => {
    const remoteUser = createRemoteUser({
      'tool.lasso': {
        type: 'lasso',
        points: [{ x: 0 }],
      },
    })

    expect(readRemoteLassoState(remoteUser)).toBeNull()
  })

  it('writes valid lasso awareness payloads', () => {
    const setPresence = vi.fn()

    setLassoToolAwareness(setPresenceWriter(setPresence), {
      type: 'lasso',
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
      ],
    })

    expect(setPresence).toHaveBeenCalledWith('tool.lasso', {
      type: 'lasso',
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
      ],
    })
  })

  it('clears lasso awareness on null', () => {
    const setPresence = vi.fn()

    setLassoToolAwareness(setPresenceWriter(setPresence), null)

    expect(setPresence).toHaveBeenCalledWith('tool.lasso', null)
  })

  it('does not publish invalid lasso awareness payloads', () => {
    const setPresence = vi.fn()

    setLassoToolAwareness(setPresenceWriter(setPresence), {
      type: 'lasso',
      points: [{ x: 0 }],
    } as never)

    expect(setPresence).not.toHaveBeenCalled()
  })
})

function createRemoteUser(presence: RemoteUser['presence']): RemoteUser {
  return {
    clientId: 1,
    user: { name: 'Tester', color: '#0f0' },
    presence,
    cursor: null,
    resizing: null,
    selection: null,
  }
}

function setPresenceWriter(setPresence: (namespace: string, value: unknown) => void) {
  return { setPresence }
}
