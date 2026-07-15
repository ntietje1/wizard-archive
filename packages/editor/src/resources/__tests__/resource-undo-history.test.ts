import { describe, expect, it } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import { RESOURCE_INDEX_SCHEMA } from '../resource-index-contract'
import type {
  AuthorizedResourceSummary,
  WorkspaceResourceIndex,
  WorkspaceResourceIndexSnapshot,
  ResourceProjectionScope,
} from '../resource-index-contract'
import { indexRevision } from '../workspace-resource-index'
import { canonicalizeResourceTitle } from '../resource-record'
import { initialResourceMetadataVersion } from '../resource-metadata-version'
import { createResourceUndoHistory } from '../resource-undo-history'
import type { ResourceCompensationEnvelope } from '../resource-command-contract'

describe('resource undo history', () => {
  it('retains original inverse facts across an indeterminate command retry', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const scope = {
      campaignId,
      actorId,
      projection: 'local' as const,
      schema: RESOURCE_INDEX_SCHEMA,
    } satisfies ResourceProjectionScope
    const original = await summary('Original')
    const renamed = await summary('Renamed')
    let current = snapshot(original, 'original')
    const index: WorkspaceResourceIndex = {
      getSnapshot: () => current,
      subscribe: () => () => undefined,
    }
    let attempts = 0
    const structure = {
      execute: () => {
        attempts += 1
        current = snapshot(renamed, 'renamed')
        if (attempts === 1) {
          return Promise.resolve({
            status: 'indeterminate' as const,
            retryable: true as const,
            reason: 'response_lost' as const,
          })
        }
        return Promise.resolve({
          status: 'received' as const,
          result: {
            status: 'completed' as const,
            receipt: {
              campaignId,
              operationId,
              result: { type: 'metadataUpdated' as const, resourceId },
              postconditions: [
                {
                  state: 'present' as const,
                  resourceId,
                  metadataVersion: renamed.metadataVersion,
                },
              ],
            },
          },
        })
      },
    }
    const compensations: Array<ResourceCompensationEnvelope> = []
    const compensation = {
      executeCompensation: (envelope: ResourceCompensationEnvelope) => {
        compensations.push(envelope)
        return Promise.resolve({
          status: 'received' as const,
          result: {
            status: 'completed' as const,
            receipt: {
              campaignId,
              operationId: envelope.operationId,
              result: { type: 'metadataUpdated' as const, resourceId },
              postconditions: [
                {
                  state: 'present' as const,
                  resourceId,
                  metadataVersion: original.metadataVersion,
                },
              ],
            },
          },
        })
      },
    }
    const undo = createResourceUndoHistory(index, structure, compensation)
    const envelope = {
      campaignId,
      operationId,
      command: {
        type: 'updateMetadata' as const,
        resourceId,
        changes: { title: canonicalizeResourceTitle('Renamed') },
      },
    }

    await undo.structure.execute(envelope)
    await undo.structure.execute(envelope)
    await undo.history.undo()

    expect(compensations).toHaveLength(1)
    expect(compensations[0]?.command).toEqual({
      type: 'updateMetadata',
      resourceId,
      changes: { title: 'Original' },
    })

    async function summary(title: string): Promise<AuthorizedResourceSummary> {
      const metadata = {
        parentId: null,
        kind: 'folder' as const,
        title: canonicalizeResourceTitle(title),
        icon: null,
        color: null,
        lifecycle: 'active' as const,
      }
      return {
        id: resourceId,
        campaignId,
        displayParentId: null,
        kind: metadata.kind,
        title: metadata.title,
        icon: null,
        color: null,
        lifecycle: 'active',
        metadataVersion: await initialResourceMetadataVersion(metadata),
        createdAt: 1,
        updatedAt: 1,
      }
    }

    function snapshot(
      resource: AuthorizedResourceSummary,
      revision: string,
    ): WorkspaceResourceIndexSnapshot {
      return {
        scope,
        revision: indexRevision(revision),
        lookup: (id) =>
          id === resourceId ? { state: 'known', value: resource } : { state: 'missing' },
        list: () => ({ state: 'unknown' }),
        ancestors: () => ({ state: 'known', value: [] }),
      }
    }
  })
})
