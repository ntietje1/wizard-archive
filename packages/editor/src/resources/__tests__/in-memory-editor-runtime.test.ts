import { describe, expect, it } from 'vite-plus/test'
import * as Y from 'yjs'
import { initialVersion, sha256Digest } from '../component-version'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import { canonicalizeResourceTitle } from '../resource-contract'
import type { ResourceNavigation } from '../editor-runtime-contract'
import type { ResourceCatalogSnapshot } from '../resource-catalog-contract'
import { RESOURCE_INDEX_SCHEMA } from '../resource-index-contract'
import { createInMemoryEditorRuntime } from '../in-memory-editor-runtime'

function emptySnapshot(): ResourceCatalogSnapshot {
  return {
    campaignId: generateDomainId(DOMAIN_ID_KIND.campaign),
    resources: [],
    tombstones: [],
    aliases: [],
    roles: [],
  }
}

function navigation(): ResourceNavigation {
  return {
    current: () => null,
    open: () => undefined,
    subscribe: () => () => undefined,
  }
}

describe('createInMemoryEditorRuntime', () => {
  it('uses the canonical index, loader, and structure command contract', async () => {
    const snapshot = emptySnapshot()
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const core = createInMemoryEditorRuntime({
      scope: {
        campaignId: snapshot.campaignId,
        actorId,
        projection: 'dm',
        schema: RESOURCE_INDEX_SCHEMA,
      },
      snapshot,
      navigation: navigation(),
    })

    await core.runtime.resources.loader.ensureCollection({ parentId: null, lifecycle: 'active' })
    const delivery = await core.runtime.resources.structure.execute({
      campaignId: snapshot.campaignId,
      operationId,
      command: {
        type: 'create',
        resourceId,
        kind: 'folder',
        parentId: null,
        title: canonicalizeResourceTitle('Duplicate-safe folder'),
        icon: null,
        color: null,
      },
    })

    expect(delivery).toEqual(
      expect.objectContaining({
        status: 'received',
        result: expect.objectContaining({ status: 'completed' }),
      }),
    )
    expect(core.runtime.resources.index.getSnapshot().lookup(resourceId)).toEqual(
      expect.objectContaining({ state: 'known' }),
    )
    core.dispose()
  })

  it('keeps final-ID local note state across same-operation retry', async () => {
    const snapshot = emptySnapshot()
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const core = createInMemoryEditorRuntime({
      scope: {
        campaignId: snapshot.campaignId,
        actorId: generateDomainId(DOMAIN_ID_KIND.campaignMember),
        projection: 'dm',
        schema: RESOURCE_INDEX_SCHEMA,
      },
      snapshot,
      navigation: navigation(),
    })
    const document = new Y.Doc()
    document.getText('body').insert(0, 'Local edit')
    const envelope = {
      campaignId: snapshot.campaignId,
      operationId,
      command: {
        type: 'create' as const,
        resourceId,
        kind: 'note' as const,
        parentId: null,
        title: canonicalizeResourceTitle('Note'),
        icon: null,
        color: null,
      },
    }

    await core.runtime.content.notes.create(envelope, document)
    const ready = core.runtime.content.notes.get(resourceId)
    expect(ready).toEqual(expect.objectContaining({ status: 'ready', content: document }))
    await core.runtime.content.notes.create(envelope, document)
    expect(core.runtime.content.notes.get(resourceId)).toEqual(ready)
    core.dispose()
  })

  it('exposes ready content without mixing it into the metadata index', async () => {
    const snapshot = emptySnapshot()
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const document = new Y.Doc()
    const version = initialVersion(await sha256Digest(new Uint8Array([1])))
    const core = createInMemoryEditorRuntime({
      scope: {
        campaignId: snapshot.campaignId,
        actorId: generateDomainId(DOMAIN_ID_KIND.campaignMember),
        projection: 'dm',
        schema: RESOURCE_INDEX_SCHEMA,
      },
      snapshot,
      content: { notes: [{ resourceId, content: document, version }] },
      navigation: navigation(),
    })

    expect(core.runtime.resources.index.getSnapshot().lookup(resourceId)).toEqual({
      state: 'unknown',
    })
    expect(core.runtime.content.notes.get(resourceId)).toEqual({
      status: 'ready',
      content: document,
      version,
    })
    core.dispose()
  })
})
