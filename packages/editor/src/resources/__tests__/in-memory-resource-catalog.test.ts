import { describe, expect, it, vi } from 'vite-plus/test'
import {
  InMemoryResourceCatalog,
  InMemoryResourceOperationExecutor,
} from '../in-memory-resource-catalog'
import { defineResourceCatalogConformance } from './resource-catalog-conformance'
import { DOMAIN_ID_KIND, assertDomainId } from '../domain-id'
import { canonicalizeResourceTitle } from '../resource-contract'

defineResourceCatalogConformance('in-memory', (options) => {
  const catalog = new InMemoryResourceCatalog()
  return { catalog, operations: new InMemoryResourceOperationExecutor(catalog, options) }
})

const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, '01890f47-f6c8-7a5b-8c9d-000000000001')
const actorId = assertDomainId(
  DOMAIN_ID_KIND.campaignMember,
  '01890f47-f6c8-7a5b-8c9d-000000000002',
)
const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, '01890f47-f6c8-7a5b-8c9d-000000000003')

describe('InMemoryResourceCatalog snapshots', () => {
  it('keeps authorization, operation execution, and transaction writers off the catalog', () => {
    const catalog = new InMemoryResourceCatalog()

    expect(catalog).not.toHaveProperty('execute')
    expect(catalog).not.toHaveProperty('appendAlias')
    expect(catalog).not.toHaveProperty('setRole')
    expect(catalog).not.toHaveProperty('removeRole')
  })

  it('hydrates an authoritative snapshot and publishes committed changes', async () => {
    const source = new InMemoryResourceCatalog()
    const sourceOperations = new InMemoryResourceOperationExecutor(source, {
      authorize: () => true,
      now: () => 10,
    })
    await sourceOperations.execute(actorId, {
      campaignId,
      operationId: assertDomainId(DOMAIN_ID_KIND.operation, '01890f47-f6c8-7a5b-8c9d-000000000004'),
      command: {
        type: 'create',
        resourceId,
        parentId: null,
        kind: 'note',
        title: canonicalizeResourceTitle('Seeded note'),
        icon: null,
        color: null,
      },
    })
    const catalog = new InMemoryResourceCatalog({
      initialSnapshot: source.getSnapshot(campaignId),
    })
    const operations = new InMemoryResourceOperationExecutor(catalog, {
      authorize: () => true,
      now: () => 20,
    })
    const listener = vi.fn()
    const unsubscribe = catalog.subscribe(campaignId, listener)
    const initial = catalog.getSnapshot(campaignId)

    expect(catalog.getSnapshot(campaignId)).toBe(initial)
    expect(initial.resources).toEqual([
      expect.objectContaining({ id: resourceId, title: 'Seeded note' }),
    ])

    await operations.execute(actorId, {
      campaignId,
      operationId: assertDomainId(DOMAIN_ID_KIND.operation, '01890f47-f6c8-7a5b-8c9d-000000000005'),
      command: {
        type: 'updateMetadata',
        resourceId,
        changes: { title: canonicalizeResourceTitle('Renamed note') },
      },
    })

    expect(listener).toHaveBeenCalledOnce()
    expect(catalog.getSnapshot(campaignId)).not.toBe(initial)
    expect(catalog.getSnapshot(campaignId).resources[0]?.title).toBe('Renamed note')

    unsubscribe()
    await operations.removeRole(campaignId, 'missing-role')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('rejects invalid hydrated ownership and hierarchy', async () => {
    const source = new InMemoryResourceCatalog()
    const sourceOperations = new InMemoryResourceOperationExecutor(source, {
      authorize: () => true,
      now: () => 10,
    })
    await sourceOperations.execute(actorId, {
      campaignId,
      operationId: assertDomainId(DOMAIN_ID_KIND.operation, '01890f47-f6c8-7a5b-8c9d-000000000006'),
      command: {
        type: 'create',
        resourceId,
        parentId: null,
        kind: 'note',
        title: canonicalizeResourceTitle('Seeded note'),
        icon: null,
        color: null,
      },
    })
    const snapshot = source.getSnapshot(campaignId)

    expect(
      () =>
        new InMemoryResourceCatalog({
          initialSnapshot: {
            ...snapshot,
            resources: [{ ...snapshot.resources[0]!, parentId: resourceId }],
          },
        }),
    ).toThrow('hierarchy')
    expect(
      () =>
        new InMemoryResourceCatalog({
          initialSnapshot: {
            ...snapshot,
            resources: [snapshot.resources[0]!, snapshot.resources[0]!],
          },
        }),
    ).toThrow('snapshot')
  })
})
