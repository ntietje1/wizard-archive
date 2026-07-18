import { describe, expect, it } from 'vite-plus/test'
import type { MapResourceContent } from '../../resources/content-session-contract'
import { testDomainId } from '../../test/domain-id'
import { resolveMapFocus } from '../map-focus'

const BASE_PIN = testDomainId('mapPin', 'map-focus-base')
const LAYER_PIN = testDomainId('mapPin', 'map-focus-layer')
const ORPHANED_PIN = testDomainId('mapPin', 'map-focus-orphaned')
const MISSING_PIN = testDomainId('mapPin', 'map-focus-missing')

describe('map focus', () => {
  it('projects every navigation target into one exact total state', () => {
    const resourceId = testDomainId('resource', 'map-focus-target')
    const destination = {
      kind: 'internal' as const,
      target: { kind: 'resource' as const, resourceId },
    }
    const content: MapResourceContent = {
      image: { status: 'unattached' },
      layers: [{ id: 'night', image: { status: 'unattached' }, name: 'Night' }],
      pins: [
        { id: BASE_PIN, destination, layerId: null, visible: true, x: 10, y: 10 },
        { id: LAYER_PIN, destination, layerId: 'night', visible: true, x: 20, y: 20 },
        { id: ORPHANED_PIN, destination, layerId: 'missing', visible: true, x: 30, y: 30 },
      ],
    }

    expect(resolveMapFocus(content, null)).toEqual({ kind: 'none' })
    expect(resolveMapFocus(content, BASE_PIN)).toEqual({ kind: 'base', pinId: BASE_PIN })
    expect(resolveMapFocus(content, LAYER_PIN)).toEqual({
      kind: 'layer',
      pinId: LAYER_PIN,
      layerId: 'night',
    })
    expect(resolveMapFocus(content, ORPHANED_PIN)).toEqual({
      kind: 'missing',
      pinId: ORPHANED_PIN,
    })
    expect(resolveMapFocus(content, MISSING_PIN)).toEqual({
      kind: 'missing',
      pinId: MISSING_PIN,
    })
  })
})
