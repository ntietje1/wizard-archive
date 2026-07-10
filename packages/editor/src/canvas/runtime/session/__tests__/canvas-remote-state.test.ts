import { describe, expect, it } from 'vite-plus/test'
import {
  getRemoteEdgeHighlights,
  getRemoteNodeHighlights,
  getRemoteResizeDimensions,
} from '../canvas-remote-state'
import type { RemoteUser } from '../../../utils/canvas-awareness-types'

describe('canvas remote state', () => {
  it('returns fresh empty fallback objects that callers cannot poison globally', () => {
    const firstResizeDimensions = getRemoteResizeDimensions([])
    firstResizeDimensions['node-1'] = { x: 1, y: 2, width: 3, height: 4 }

    const secondResizeDimensions = getRemoteResizeDimensions([])
    expect(secondResizeDimensions).toEqual({})

    const firstHighlights = getRemoteNodeHighlights([])
    firstHighlights.set('node-1', { color: '#000', name: 'Remote' })

    const secondHighlights = getRemoteNodeHighlights([])
    expect(secondHighlights.size).toBe(0)
  })

  it('keeps remote node and edge selections in distinct highlight maps', () => {
    const remoteUsers: Array<RemoteUser> = [
      {
        clientId: 2,
        cursor: null,
        presence: {},
        resizing: null,
        selection: { version: 1, nodeIds: ['node-1'], edgeIds: ['edge-1'] },
        user: { color: '#f00', name: 'Remote' },
      },
    ]

    expect(getRemoteNodeHighlights(remoteUsers)).toEqual(
      new Map([['node-1', { color: '#f00', name: 'Remote' }]]),
    )
    expect(getRemoteEdgeHighlights(remoteUsers)).toEqual(
      new Map([['edge-1', { color: '#f00', name: 'Remote' }]]),
    )
  })
})
