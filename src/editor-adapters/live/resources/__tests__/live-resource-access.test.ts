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
import { createLiveResourceAccess } from '../live-resource-access'

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

describe('createLiveResourceAccess', () => {
  it('reads effective access from the authorized index projection', () => {
    const index = resourceIndex('view')
    const access = createLiveResourceAccess(index, { mode: 'readonly' })

    expect(access.source.get(resourceId)).toEqual({ state: 'known', value: 'view' })
    expect(access.source.get(testDomainId('resource', 'unknown-access'))).toEqual({
      state: 'unknown',
    })
    expect(access.mode).toBe('readonly')
  })

  it('normalizes commands and validates completed receipt identity', async () => {
    const execute = vi.fn(() =>
      Promise.resolve({
        status: 'completed' as const,
        receipt: { campaignId, operationId, resourceIds: [resourceId] },
      }),
    )
    const access = editableAccess(execute)

    await expect(
      access.commands.execute({
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

  it('does not expose mutation or sharing presentation outside an editable runtime', () => {
    const access = createLiveResourceAccess(resourceIndex('view'), { mode: 'readonly' })

    expect(access).toMatchObject({ mode: 'readonly', source: expect.any(Object) })
    expect('commands' in access).toBe(false)
    expect('presentation' in access).toBe(false)
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
    const access = editableAccess(vi.fn(), watch)
    const { presentation: source } = access

    const unknown = source.getPresentation(resourceId)
    expect(unknown).toEqual({ state: 'unknown' })
    expect(source.getPresentation(resourceId)).toBe(unknown)
    const unsubscribeFirst = source.subscribe(resourceId, vi.fn())
    const unsubscribeSecond = source.subscribe(resourceId, vi.fn())
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
    expect(source.getPresentation(resourceId)).toMatchObject({
      state: 'known',
      value: { policy: { resourceId } },
    })
    expect(source.getPresentation(resourceId)).toBe(source.getPresentation(resourceId))
    unsubscribeFirst()
    expect(dispose).not.toHaveBeenCalled()
    unsubscribeSecond()
    expect(dispose).toHaveBeenCalledOnce()
    expect(source.getPresentation(resourceId)).toEqual({ state: 'unknown' })
    access.dispose()
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
    const access = editableAccess(vi.fn(), watch)
    const { presentation: source } = access
    const listener = vi.fn()

    const unsubscribe = source.subscribe(resourceId, listener)

    expect(listener).not.toHaveBeenCalled()
    expect(source.getPresentation(resourceId)).toMatchObject({
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
    const access = editableAccess(vi.fn(), watch)
    const { presentation: source } = access
    const unsubscribe = source.subscribe(resourceId, vi.fn())
    publishes[0]!({
      cursor: 'next',
      presentation: presentation([memberId]),
    })
    expect(source.getPresentation(resourceId)).toMatchObject({
      state: 'known',
      value: { participants: [{ id: memberId }], participantsComplete: false },
    })

    source.loadMorePresentation(resourceId)
    const secondMember = testDomainId('campaignMember', 'live-access-second-target')
    publishes[1]!({
      cursor: null,
      presentation: presentation([secondMember]),
    })
    expect(source.getPresentation(resourceId)).toMatchObject({
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
    const access = editableAccess(vi.fn(), watch)
    const { presentation: source } = access
    const unsubscribe = source.subscribe(resourceId, vi.fn())
    publishes[0]!({ cursor: 'old-next', presentation: presentation([memberId]) })
    source.loadMorePresentation(resourceId)
    const oldSecondMember = testDomainId('campaignMember', 'old-second')
    publishes[1]!({ cursor: null, presentation: presentation([oldSecondMember]) })

    publishes[0]!({ cursor: 'new-next', presentation: presentation([memberId]) })

    expect(disposes[1]).toHaveBeenCalledOnce()
    expect(source.getPresentation(resourceId)).toMatchObject({
      state: 'known',
      value: { participants: [{ id: memberId }], participantsComplete: false },
    })
    source.loadMorePresentation(resourceId)
    const newSecondMember = testDomainId('campaignMember', 'new-second')
    publishes[2]!({ cursor: null, presentation: presentation([newSecondMember]) })
    expect(source.getPresentation(resourceId)).toMatchObject({
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

type EditableAccessInput = Extract<
  Parameters<typeof createLiveResourceAccess>[1],
  { mode: 'editable' }
>

function editableAccess(
  execute: EditableAccessInput['execute'],
  watchPresentation: EditableAccessInput['watchPresentation'] = () => () => undefined,
) {
  const access = createLiveResourceAccess(resourceIndex('edit'), {
    mode: 'editable',
    campaignId,
    execute,
    watchPresentation,
  })
  if (access.mode !== 'editable') throw new TypeError('Expected editable resource access')
  return access
}

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
