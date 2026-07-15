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
})

function navigation(initialResourceId: ResourceRecord['id']): ResourceNavigation {
  return {
    current: () => initialResourceId,
    open: () => {},
    subscribe: () => () => {},
  }
}
