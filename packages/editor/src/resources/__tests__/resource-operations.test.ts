import { describe, expect, it, vi } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import type { EditorRuntime, ResourceNavigation } from '../editor-runtime-contract'
import { createInMemoryEditorRuntime } from '../in-memory-editor-runtime'
import { RESOURCE_INDEX_SCHEMA } from '../resource-index-contract'
import { initialResourceMetadataVersion } from '../resource-metadata-version'
import { canonicalizeResourceTitle } from '../resource-record'
import type { ResourceRecord } from '../resource-record'
import { createWorkspaceActions } from '../workspace/resource-operations'

describe('resource application workflows', () => {
  it('empties trash roots through bounded canonical command batches', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const resources = await Promise.all(
      Array.from({ length: 51 }, async (_, index): Promise<ResourceRecord> => {
        const title = canonicalizeResourceTitle(`Trashed ${index}`)
        const metadata = {
          parentId: null,
          kind: 'folder' as const,
          title,
          icon: null,
          color: null,
          lifecycle: 'trashed' as const,
        }
        return {
          id: generateDomainId(DOMAIN_ID_KIND.resource),
          campaignId,
          ...metadata,
          lifecycle: { state: 'trashed', at: 1, by: actorId },
          metadataVersion: await initialResourceMetadataVersion(metadata),
          created: { at: 1, by: actorId },
          updated: { at: 1, by: actorId },
        }
      }),
    )
    const core = createInMemoryEditorRuntime({
      canEdit: true,
      scope: { campaignId, actorId, projection: 'dm', schema: RESOURCE_INDEX_SCHEMA },
      snapshot: {
        campaignId,
        resources,
        tombstones: [],
        aliases: [],
        assetsFolderId: null,
      },
      navigation: navigation(resources[0]!.id),
    })
    const structure = core.runtime.resources.structure
    if (structure.status !== 'available') throw new Error('Expected structure capability')
    const execute = vi.fn((envelope) => structure.value.execute(envelope))
    const runtime = {
      ...core.runtime,
      resources: {
        ...core.runtime.resources,
        structure: { status: 'available', value: { execute } },
      },
    } satisfies EditorRuntime
    const report = vi.fn()

    await createWorkspaceActions(runtime, report).emptyTrash(
      resources.map((resource) => resource.id),
    )

    expect(execute).toHaveBeenCalledTimes(3)
    expect(
      execute.mock.calls.map(([envelope]) =>
        envelope.command.type === 'permanentlyDelete' ? envelope.command.resourceIds.length : 0,
      ),
    ).toEqual([25, 25, 1])
    expect(report).toHaveBeenLastCalledWith('Trash emptied')
    expect(
      resources.every(
        (resource) => runtime.resources.index.getSnapshot().lookup(resource.id).state === 'missing',
      ),
    ).toBe(true)
    core.dispose()
  })

  it('submits explicit uploads to the canonical transfer owner without authoring a resource', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const core = createInMemoryEditorRuntime({
      canEdit: true,
      scope: { campaignId, actorId, projection: 'dm', schema: RESOURCE_INDEX_SCHEMA },
      snapshot: {
        campaignId,
        resources: [],
        tombstones: [],
        aliases: [],
        assetsFolderId: null,
      },
      navigation: navigation(generateDomainId(DOMAIN_ID_KIND.resource)),
    })
    const files = core.runtime.content.files
    const executeTransfer = vi.fn((...args: Parameters<typeof files.executeTransfer>) =>
      files.executeTransfer(...args),
    )
    const runtime = {
      ...core.runtime,
      content: {
        ...core.runtime.content,
        files: {
          get: (resourceId) => files.get(resourceId),
          subscribe: (resourceId, listener) => files.subscribe(resourceId, listener),
          export: (resourceId) => files.export(resourceId),
          executeTransfer,
          replace: (resourceId, expectedVersion, source) =>
            files.replace(resourceId, expectedVersion, source),
          dispose: () => files.dispose(),
        },
      },
    } satisfies EditorRuntime
    const report = vi.fn()

    const result = await createWorkspaceActions(runtime, report).createFile(
      null,
      new File(['# Kept as a file'], 'Session.md', { type: 'text/markdown' }),
    )

    expect(result).toMatchObject({ status: 'completed' })
    expect(executeTransfer).toHaveBeenCalledOnce()
    const [intent, source] = executeTransfer.mock.calls[0]!
    expect(intent).toMatchObject({
      campaignId,
      destinationParentId: null,
    })
    expect(source).toMatchObject({
      fileName: 'Session.md',
    })
    if (result.status !== 'completed') throw new TypeError('Expected completed transfer')
    expect(runtime.resources.index.getSnapshot().lookup(result.resourceId)).toMatchObject({
      state: 'known',
      value: { kind: 'file', title: 'Session.md' },
    })
    expect(report).toHaveBeenLastCalledWith('File uploaded')
    core.dispose()
  })

  it('creates authored uploads under one canonical Assets folder', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const core = createInMemoryEditorRuntime({
      canEdit: true,
      scope: { campaignId, actorId, projection: 'dm', schema: RESOURCE_INDEX_SCHEMA },
      snapshot: {
        campaignId,
        resources: [],
        tombstones: [],
        aliases: [],
        assetsFolderId: null,
      },
      navigation: navigation(generateDomainId(DOMAIN_ID_KIND.resource)),
    })
    const actions = createWorkspaceActions(core.runtime, vi.fn())

    const [first, second] = await Promise.all([
      actions.createAssetFile(new File(['first'], 'First.txt', { type: 'text/plain' })),
      actions.createAssetFile(new File(['second'], 'Second.txt', { type: 'text/plain' })),
    ])

    if (first.status !== 'completed' || second.status !== 'completed') {
      throw new TypeError('Expected completed Assets uploads')
    }
    const snapshot = core.runtime.resources.index.getSnapshot()
    const firstFile = snapshot.lookup(first.resourceId)
    const secondFile = snapshot.lookup(second.resourceId)
    if (firstFile.state !== 'known' || secondFile.state !== 'known') {
      throw new TypeError('Expected uploaded resources')
    }
    expect(firstFile.value.displayParentId).toBe(secondFile.value.displayParentId)
    const assetsFolderId = firstFile.value.displayParentId
    if (assetsFolderId === null) throw new TypeError('Expected Assets parent')
    expect(snapshot.lookup(assetsFolderId)).toMatchObject({
      state: 'known',
      value: { kind: 'folder', title: 'Assets', displayParentId: null, icon: 'Box' },
    })
    core.dispose()
  })
})

function navigation(initialResourceId: ResourceRecord['id']): ResourceNavigation {
  return {
    current: () => ({ kind: 'resource', resourceId: initialResourceId }),
    open: () => {},
    subscribe: () => () => {},
  }
}
