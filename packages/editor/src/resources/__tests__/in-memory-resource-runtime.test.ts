import { describe, expect, it } from 'vite-plus/test'
import { createInMemoryResourceRuntime } from '../in-memory-resource-runtime'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import type { ResourceId } from '../domain-id'
import { RESOURCE_INDEX_SCHEMA } from '../resource-index-contract'
import type { ResourceProjectionScope } from '../resource-index-contract'
import { canonicalizeResourceTitle } from '../resource-record'
import { initialResourceMetadataVersion } from '../resource-metadata-version'
import type { ResourceCatalogSnapshot } from '../resource-catalog-contract'

const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
const scope = {
  campaignId,
  actorId,
  projection: 'local',
  schema: RESOURCE_INDEX_SCHEMA,
} satisfies ResourceProjectionScope

async function resource(
  id: ResourceId,
  parentId: ResourceId | null,
  kind: 'folder' | 'note',
  title: string,
) {
  const metadata = {
    parentId,
    kind,
    title: canonicalizeResourceTitle(title),
    icon: null,
    color: null,
    lifecycle: 'active' as const,
  }
  return {
    id,
    campaignId,
    ...metadata,
    lifecycle: { state: 'active' as const },
    metadataVersion: await initialResourceMetadataVersion(metadata),
    created: { at: 1, by: actorId },
    updated: { at: 1, by: actorId },
  }
}

describe('in-memory resource runtime', () => {
  it('loads only requested knowledge with complete ancestor spines and collections', async () => {
    const folderId = generateDomainId(DOMAIN_ID_KIND.resource)
    const noteId = generateDomainId(DOMAIN_ID_KIND.resource)
    const initialSnapshot: ResourceCatalogSnapshot = {
      campaignId,
      resources: [
        await resource(folderId, null, 'folder', 'Folder'),
        await resource(noteId, folderId, 'note', 'Note'),
      ],
      tombstones: [],
      aliases: [],
    }
    const runtime = createInMemoryResourceRuntime({
      scope,
      initialSnapshot,
    })

    expect(runtime.index.getSnapshot().lookup(noteId)).toEqual({ state: 'unknown' })
    await expect(runtime.loader.ensureResource(noteId)).resolves.toEqual({ status: 'completed' })
    expect(runtime.index.getSnapshot().lookup(noteId)).toEqual({
      state: 'known',
      value: expect.objectContaining({ id: noteId, displayParentId: folderId }),
    })
    expect(runtime.index.getSnapshot().ancestors(noteId)).toEqual({
      state: 'known',
      value: [expect.objectContaining({ id: folderId })],
    })

    const roots = { parentId: null, lifecycle: 'active' as const }
    expect(runtime.index.getSnapshot().list(roots)).toEqual({ state: 'unknown' })
    await expect(runtime.loader.ensureCollection(roots)).resolves.toEqual({ status: 'completed' })
    expect(runtime.index.getSnapshot().list(roots)).toEqual({
      state: 'known',
      items: [expect.objectContaining({ id: folderId })],
      complete: true,
    })
    runtime.dispose()
  })

  it('derives projection permissions and command authority from one scope', async () => {
    const runtime = createInMemoryResourceRuntime({
      scope: { ...scope, projection: 'player', permission: 'view' },
      initialSnapshot: {
        campaignId,
        resources: [
          await resource(generateDomainId(DOMAIN_ID_KIND.resource), null, 'note', 'Note'),
        ],
        tombstones: [],
        aliases: [],
      },
    })
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    await runtime.loader.ensureCollection({ parentId: null, lifecycle: 'active' })
    expect(runtime.index.getSnapshot().list({ parentId: null, lifecycle: 'active' })).toMatchObject(
      {
        state: 'known',
        items: [{ permission: 'view' }],
      },
    )
    await expect(
      runtime.structure.execute({
        campaignId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command: {
          type: 'create',
          resourceId,
          kind: 'note',
          parentId: null,
          title: canonicalizeResourceTitle('Draft'),
          icon: null,
          color: null,
        },
      }),
    ).resolves.toEqual({
      status: 'received',
      result: { status: 'rejected', reason: 'unauthorized' },
    })
    expect(runtime.index.getSnapshot().lookup(resourceId)).toEqual({ state: 'unknown' })
    runtime.dispose()
  })
})
