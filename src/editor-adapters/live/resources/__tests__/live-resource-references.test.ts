import { describe, expect, it, vi } from 'vite-plus/test'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { createLiveResourceReferenceSource } from '../live-resource-references'

const campaignId = testDomainId('campaign', 'live-references')
const actorId = testDomainId('campaignMember', 'live-references')
const sourceResourceId = testDomainId('resource', 'live-reference-source')
const targetResourceId = testDomainId('resource', 'live-reference-target')
const version = {
  scheme: 'authoritative-revision-v1' as const,
  revision: 1,
  digest: '0'.repeat(64),
}

describe('createLiveResourceReferenceSource', () => {
  it('preserves explicit direction capacity and exact canonical edges', () => {
    let publish: Parameters<Parameters<typeof createLiveResourceReferenceSource>[1]>[1] | undefined
    const disposeWatch = vi.fn()
    const references = createLiveResourceReferenceSource(
      () => ({ status: 'completed' }),
      (_resourceId, apply) => {
        publish = apply
        return disposeWatch
      },
    )
    const listener = vi.fn()
    const unsubscribe = references.source.subscribe(sourceResourceId, listener)

    publish?.({
      status: 'ready',
      outgoing: { status: 'capacity_exceeded' },
      backlinks: {
        status: 'ready',
        edges: [
          {
            sourceResourceId,
            sourceVersion: version,
            target: { kind: 'resource', resourceId: targetResourceId },
          },
        ],
      },
      snapshot: {
        scope: {
          campaignId,
          actorId,
          projection: 'dm',
          schema: RESOURCE_INDEX_SCHEMA,
        },
        revision: 'references-1',
        resources: [],
        missingResourceIds: [],
        collections: [],
      },
    })

    expect(references.source.get(sourceResourceId)).toEqual({
      status: 'ready',
      outgoing: { status: 'capacity_exceeded' },
      backlinks: {
        status: 'ready',
        edges: [
          {
            sourceResourceId,
            sourceVersion: version,
            target: { kind: 'resource', resourceId: targetResourceId },
          },
        ],
      },
    })
    expect(listener).toHaveBeenCalledOnce()

    unsubscribe()
    expect(disposeWatch).toHaveBeenCalledOnce()
    references.dispose()
  })
})
