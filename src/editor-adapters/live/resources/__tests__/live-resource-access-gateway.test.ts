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
import type { ResourceAccessPresentation } from '@wizard-archive/editor/resources/access-policy'
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

  it('starts one live sharing projection and disposes its source subscription', () => {
    const dispose = vi.fn()
    let apply:
      | ((value: { presentation: PagePresentation | null; cursor: string | null }) => void)
      | undefined
    const watch = vi.fn((_resourceId, _cursor, publish) => {
      apply = publish
      return dispose
    })
    const gateway = createLiveResourceAccessGateway(
      campaignId,
      resourceIndex('edit'),
      vi.fn(),
      watch,
    )

    const unknown = gateway.getPresentation(resourceId)
    expect(unknown).toEqual({ state: 'unknown' })
    expect(gateway.getPresentation(resourceId)).toBe(unknown)
    const unsubscribeFirst = gateway.subscribe(resourceId, vi.fn())
    const unsubscribeSecond = gateway.subscribe(resourceId, vi.fn())
    apply?.({
      cursor: null,
      presentation: {
        policy: {
          resourceId,
          subject: 'resource',
          audienceAccess: { state: 'default' },
        },
        defaultAccess: { permission: 'none', source: { type: 'none' } },
        participants: [],
      },
    })

    expect(watch).toHaveBeenCalledTimes(1)
    expect(gateway.getPresentation(resourceId)).toMatchObject({
      state: 'known',
      value: { policy: { resourceId } },
    })
    expect(gateway.getPresentation(resourceId)).toBe(gateway.getPresentation(resourceId))
    unsubscribeFirst()
    expect(dispose).not.toHaveBeenCalled()
    unsubscribeSecond()
    expect(dispose).toHaveBeenCalledOnce()
    expect(gateway.getPresentation(resourceId)).toEqual({ state: 'unknown' })
    gateway.dispose()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('caches a synchronous initial projection without notifying during subscription', () => {
    let publish:
      | ((value: { presentation: PagePresentation | null; cursor: string | null }) => void)
      | undefined
    const watch = vi.fn((_resourceId, _cursor, apply) => {
      publish = apply
      apply({ cursor: null, presentation: presentation([memberId]) })
      return vi.fn()
    })
    const gateway = createLiveResourceAccessGateway(
      campaignId,
      resourceIndex('edit'),
      vi.fn(),
      watch,
    )
    const listener = vi.fn()

    const unsubscribe = gateway.subscribe(resourceId, listener)

    expect(listener).not.toHaveBeenCalled()
    expect(gateway.getPresentation(resourceId)).toMatchObject({
      state: 'known',
      value: { participants: [{ id: memberId }] },
    })
    publish?.({ cursor: null, presentation: presentation([]) })
    expect(listener).toHaveBeenCalledOnce()
    unsubscribe()
  })

  it('assembles live participant pages and releases the entire page chain', () => {
    const publishes: Array<
      (value: { presentation: PagePresentation | null; cursor: string | null }) => void
    > = []
    const disposes = [vi.fn(), vi.fn()]
    const watch = vi.fn((_resourceId, _cursor, publish) => {
      const index = publishes.push(publish) - 1
      return disposes[index]!
    })
    const gateway = createLiveResourceAccessGateway(
      campaignId,
      resourceIndex('edit'),
      vi.fn(),
      watch,
    )
    const unsubscribe = gateway.subscribe(resourceId, vi.fn())
    publishes[0]!({
      cursor: 'next',
      presentation: presentation([memberId]),
    })
    expect(gateway.getPresentation(resourceId)).toMatchObject({
      state: 'known',
      value: { participants: [{ id: memberId }], participantsComplete: false },
    })

    gateway.loadMorePresentation(resourceId)
    const secondMember = testDomainId('campaignMember', 'live-access-second-target')
    publishes[1]!({
      cursor: null,
      presentation: presentation([secondMember]),
    })
    expect(gateway.getPresentation(resourceId)).toMatchObject({
      state: 'known',
      value: {
        participants: [{ id: memberId }, { id: secondMember }],
        participantsComplete: true,
      },
    })

    unsubscribe()
    expect(disposes[0]).toHaveBeenCalledOnce()
    expect(disposes[1]).toHaveBeenCalledOnce()
  })

  it('drops descendant pages when an earlier live cursor changes', () => {
    const publishes: Array<
      (value: { presentation: PagePresentation | null; cursor: string | null }) => void
    > = []
    const disposes = [vi.fn(), vi.fn(), vi.fn()]
    const watch = vi.fn((_resourceId, _cursor, publish) => {
      const index = publishes.push(publish) - 1
      return disposes[index]!
    })
    const gateway = createLiveResourceAccessGateway(
      campaignId,
      resourceIndex('edit'),
      vi.fn(),
      watch,
    )
    const unsubscribe = gateway.subscribe(resourceId, vi.fn())
    publishes[0]!({ cursor: 'old-next', presentation: presentation([memberId]) })
    gateway.loadMorePresentation(resourceId)
    const oldSecondMember = testDomainId('campaignMember', 'old-second')
    publishes[1]!({ cursor: null, presentation: presentation([oldSecondMember]) })

    publishes[0]!({ cursor: 'new-next', presentation: presentation([memberId]) })

    expect(disposes[1]).toHaveBeenCalledOnce()
    expect(gateway.getPresentation(resourceId)).toMatchObject({
      state: 'known',
      value: { participants: [{ id: memberId }], participantsComplete: false },
    })
    gateway.loadMorePresentation(resourceId)
    const newSecondMember = testDomainId('campaignMember', 'new-second')
    publishes[2]!({ cursor: null, presentation: presentation([newSecondMember]) })
    expect(gateway.getPresentation(resourceId)).toMatchObject({
      state: 'known',
      value: {
        participants: [{ id: memberId }, { id: newSecondMember }],
        participantsComplete: true,
      },
    })

    unsubscribe()
    expect(disposes[0]).toHaveBeenCalledOnce()
    expect(disposes[2]).toHaveBeenCalledOnce()
  })
})

function presentation(participantIds: ReadonlyArray<typeof memberId>): PagePresentation {
  return {
    policy: {
      resourceId,
      subject: 'resource',
      audienceAccess: { state: 'default' },
    },
    defaultAccess: { permission: 'none', source: { type: 'none' } },
    participants: participantIds.map((id) => ({
      id,
      displayName: id,
      username: id,
      imageUrl: null,
      access: { state: 'default' },
      effectiveAccess: { permission: 'none', source: { type: 'none' } },
    })),
  }
}

type PagePresentation = Omit<ResourceAccessPresentation, 'participantsComplete'>

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
