import { describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import type { ResourceProjectionScope } from '@wizard-archive/editor/resources/index-contract'
import {
  MutableWorkspaceResourceIndex,
  indexRevision,
} from '@wizard-archive/editor/resources/workspace-index'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { createLiveResourceAccessGateway } from '../live-resource-access-gateway'

const campaignId = testDomainId('campaign', 'live-access')
const actorId = testDomainId('campaignMember', 'live-access')
const memberId = testDomainId('campaignMember', 'live-access-target')
const resourceId = testDomainId('resource', 'live-access')
const operationId = testDomainId('operation', 'live-access')
const scope = {
  campaignId,
  actorId,
  projection: 'dm' as const,
  schema: RESOURCE_INDEX_SCHEMA,
} satisfies ResourceProjectionScope

describe('createLiveResourceAccessGateway', () => {
  it('reads effective access from the authorized index projection', () => {
    const index = resourceIndex('view')
    const gateway = createLiveResourceAccessGateway(campaignId, index, vi.fn())

    expect(gateway.get(resourceId)).toEqual({ state: 'known', value: 'view' })
    expect(gateway.get(testDomainId('resource', 'unknown-access'))).toEqual({
      state: 'unknown',
    })
  })

  it('normalizes commands and validates completed receipt identity', async () => {
    const execute = vi.fn(() =>
      Promise.resolve({
        status: 'completed' as const,
        receipt: { campaignId, operationId, resourceIds: [resourceId] },
      }),
    )
    const gateway = createLiveResourceAccessGateway(campaignId, resourceIndex('edit'), execute)

    await expect(
      gateway.execute({
        campaignId,
        operationId,
        command: {
          type: 'setMemberAccess',
          resourceIds: [resourceId, resourceId],
          memberId,
          permission: 'view',
        },
      }),
    ).resolves.toEqual({
      status: 'received',
      result: {
        status: 'completed',
        receipt: { campaignId, operationId, resourceIds: [resourceId] },
      },
    })
    expect(execute).toHaveBeenCalledWith({
      campaignId,
      operationId,
      command: {
        type: 'setMemberAccess',
        resourceIds: [resourceId],
        memberId,
        permission: 'view',
      },
    })
  })

  it('rejects access mutation outside an authoritative DM runtime', async () => {
    const gateway = createLiveResourceAccessGateway(campaignId, resourceIndex('view'), null)

    await expect(
      gateway.execute({
        campaignId,
        operationId,
        command: {
          type: 'setAudienceAccess',
          resourceIds: [resourceId],
          permission: 'view',
        },
      }),
    ).resolves.toEqual({
      status: 'received',
      result: { status: 'rejected', reason: 'unauthorized' },
    })
  })
})

function resourceIndex(permission: 'view' | 'edit') {
  const index = new MutableWorkspaceResourceIndex(scope, indexRevision('empty'))
  index.replaceSnapshot({
    scope,
    revision: indexRevision('projection'),
    resources: [
      {
        id: resourceId,
        campaignId,
        displayParentId: null,
        kind: 'note',
        title: canonicalizeResourceTitle('Shared note'),
        icon: null,
        color: null,
        lifecycle: 'active',
        permission,
        metadataVersion: assertVersionStamp({
          scheme: 'authoritative-revision-v1',
          revision: 1,
          digest: '0'.repeat(64),
        }),
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    missingResourceIds: [],
    collections: [],
  })
  return index
}
