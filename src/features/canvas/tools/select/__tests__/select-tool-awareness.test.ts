import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readRemoteSelectRectState, setSelectToolAwareness } from '../select-tool-awareness'
import { logger } from '~/shared/utils/logger'
import type { RemoteUser } from '../../../utils/canvas-awareness-types'

vi.mock('~/shared/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('select tool awareness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    {
      label: 'negative width',
      payload: { type: 'rect', x: 10, y: 20, width: -1, height: 40 },
    },
    {
      label: 'negative height',
      payload: { type: 'rect', x: 10, y: 20, width: 30, height: -1 },
    },
    {
      label: 'non-finite width',
      payload: { type: 'rect', x: 10, y: 20, width: Number.POSITIVE_INFINITY, height: 40 },
    },
    {
      label: 'non-finite height',
      payload: { type: 'rect', x: 10, y: 20, width: 30, height: Number.NaN },
    },
    {
      label: 'non-finite x',
      payload: { type: 'rect', x: Number.NaN, y: 20, width: 30, height: 40 },
    },
    {
      label: 'non-finite y',
      payload: { type: 'rect', x: 10, y: Number.NaN, width: 30, height: 40 },
    },
    {
      label: 'missing height',
      payload: { type: 'rect', x: 10, y: 20, width: 30 },
    },
  ])('returns null for invalid remote select awareness payloads: $label', ({ payload }) => {
    const remoteUser = createRemoteUser({
      'tool.select': payload,
    })

    expect(readRemoteSelectRectState(remoteUser)).toBeNull()
  })

  it('writes valid select awareness payloads and clears on null', () => {
    const setPresence = vi.fn()

    setSelectToolAwareness(setPresenceWriter(setPresence), {
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    })
    setSelectToolAwareness(setPresenceWriter(setPresence), null)

    expect(setPresence).toHaveBeenNthCalledWith(1, 'tool.select', {
      type: 'rect',
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    })
    expect(setPresence).toHaveBeenNthCalledWith(2, 'tool.select', null)
  })

  it.each([
    { label: 'negative width', rect: { x: 10, y: 20, width: -1, height: 40 } },
    { label: 'negative height', rect: { x: 10, y: 20, width: 30, height: -1 } },
    {
      label: 'non-finite width',
      rect: { x: 10, y: 20, width: Number.POSITIVE_INFINITY, height: 40 },
    },
    { label: 'non-finite height', rect: { x: 10, y: 20, width: 30, height: Number.NaN } },
    {
      label: 'non-finite x',
      rect: { x: Number.POSITIVE_INFINITY, y: 20, width: 30, height: 40 },
    },
    {
      label: 'non-finite y',
      rect: { x: 10, y: Number.NaN, width: 30, height: 40 },
    },
    { label: 'missing height', rect: { x: 10, y: 20, width: 30 } },
  ])('does not publish invalid select awareness payloads: $label', ({ rect }) => {
    const setPresence = vi.fn()

    setSelectToolAwareness(setPresenceWriter(setPresence), rect as never)

    expect(setPresence).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalled()
  })
})

function createRemoteUser(presence: RemoteUser['presence']): RemoteUser {
  return {
    clientId: 1,
    user: { name: 'Tester', color: '#00f' },
    presence,
    cursor: null,
    resizing: null,
    selectedNodeIds: null,
  }
}

function setPresenceWriter(setPresence: (namespace: string, value: unknown) => void) {
  return { setPresence }
}
