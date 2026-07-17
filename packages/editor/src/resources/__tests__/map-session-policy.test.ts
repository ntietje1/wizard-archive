import { describe, expect, it } from 'vite-plus/test'
import { initialVersion, sha256Digest } from '../component-version'
import type { MapResourceContent } from '../content-session-contract'
import {
  copyMapImageBytes,
  mapImageMediaType,
  reconcileMapSnapshot,
  transitionMapContent,
} from '../map-session-policy'
import { testDomainId } from '../../../../../shared/test/domain-id'

describe('map session policy', () => {
  it('labels map bytes from their authored filename without inspecting content', () => {
    expect(mapImageMediaType('opaque.PNG')).toBe('image/png')
    expect(mapImageMediaType('not-an-image.txt')).toBe('application/octet-stream')
  })

  it('applies one canonical command transition with backend-visible pin defaults', () => {
    const resourceId = testDomainId('resource', 'map-policy')
    const targetId = testDomainId('resource', 'map-policy-target')
    const pinId = testDomainId('mapPin', 'map-policy-pin')
    const transition = transitionMapContent(resourceId, emptyMap(), {
      type: 'createPins',
      pins: [
        {
          id: pinId,
          destination: { kind: 'internal', target: { kind: 'resource', resourceId: targetId } },
          layerId: null,
          x: 25,
          y: 75,
        },
      ],
    })

    expect(transition).toEqual({
      status: 'completed',
      content: {
        ...emptyMap(),
        pins: [
          {
            id: pinId,
            destination: {
              kind: 'internal',
              target: { kind: 'resource', resourceId: targetId },
            },
            layerId: null,
            visible: true,
            x: 25,
            y: 75,
          },
        ],
      },
    })
  })

  it('retains newer frontiers and rejects equal-revision conflicts', async () => {
    const resourceId = testDomainId('resource', 'map-snapshot-policy')
    const first = initialVersion(await sha256Digest(new Uint8Array([1])))
    const second = { ...first, revision: 2, digest: await sha256Digest(new Uint8Array([2])) }
    const conflict = { ...second, digest: await sha256Digest(new Uint8Array([3])) }

    expect(reconcileMapSnapshot(resourceId, second, emptyMap(), first)).toBe('retain')
    expect(reconcileMapSnapshot(resourceId, first, emptyMap(), second)).toBe('apply')
    expect(reconcileMapSnapshot(resourceId, second, emptyMap(), conflict)).toBe('conflict')
  })

  it('copies every attached image byte-for-byte and rejects incomplete bytes', async () => {
    const baseBytes = new Uint8Array([1, 2, 3])
    const layerBytes = new Uint8Array([4, 5])
    const content: MapResourceContent = {
      image: {
        status: 'attached',
        byteSize: baseBytes.byteLength,
        digest: await sha256Digest(baseBytes),
        mediaType: 'image/png',
      },
      layers: [
        {
          id: 'night',
          image: {
            status: 'attached',
            byteSize: layerBytes.byteLength,
            digest: await sha256Digest(layerBytes),
            mediaType: 'image/webp',
          },
          name: 'Night',
        },
      ],
      pins: [],
    }
    const copied = await copyMapImageBytes(content, [
      { layerId: null, bytes: baseBytes },
      { layerId: 'night', bytes: layerBytes },
    ])

    expect(copied.map(({ layerId, bytes }) => ({ layerId, bytes: Array.from(bytes) }))).toEqual([
      { layerId: null, bytes: [1, 2, 3] },
      { layerId: 'night', bytes: [4, 5] },
    ])
    expect(copied[0]!.bytes).not.toBe(baseBytes)
    await expect(copyMapImageBytes(content, [{ layerId: null, bytes: baseBytes }])).rejects.toThrow(
      'Map image bytes are incomplete',
    )
  })
})

function emptyMap(): MapResourceContent {
  return { image: { status: 'unattached' }, layers: [], pins: [] }
}
