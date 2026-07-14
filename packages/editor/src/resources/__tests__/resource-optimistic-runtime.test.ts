import { describe, expect, it, vi } from 'vite-plus/test'
import { assertSha256Digest, initialVersion } from '../component-version'
import { DOMAIN_ID_KIND } from '../domain-id'
import type {
  CommandDelivery,
  CommandEnvelope,
  ResourceCommandReceipt,
  ResourceStructureCommand,
  ResourceStructureCommandGateway,
  ResourceStructureCommandResult,
} from '../resource-command-contract'
import { canonicalizeResourceTitle } from '../resource-contract'
import { indexRevision, MutableWorkspaceResourceIndex } from '../workspace-resource-index'
import { createOptimisticResourceStructureRuntime } from '../resource-optimistic-runtime'
import { testDomainId } from '../../test/domain-id'

const campaignId = testDomainId(DOMAIN_ID_KIND.campaign, 'optimistic-runtime-campaign')
const actorId = testDomainId(DOMAIN_ID_KIND.campaignMember, 'optimistic-runtime-actor')
const resourceId = testDomainId(DOMAIN_ID_KIND.resource, 'optimistic-runtime-resource')
const createdId = testDomainId(DOMAIN_ID_KIND.resource, 'optimistic-runtime-created')
const operationId = testDomainId(DOMAIN_ID_KIND.operation, 'optimistic-runtime-operation')
const version1 = initialVersion(assertSha256Digest('1'.repeat(64)))
const version2 = initialVersion(assertSha256Digest('2'.repeat(64)))
const scope = {
  campaignId,
  actorId,
  projection: 'editor',
  schema: 'resource-index-v1',
}

function baseIndex() {
  const index = new MutableWorkspaceResourceIndex(scope, indexRevision('empty'))
  index.replaceSnapshot({
    scope,
    revision: indexRevision('base-1'),
    resources: [
      {
        id: resourceId,
        campaignId,
        displayParentId: null,
        kind: 'folder',
        title: canonicalizeResourceTitle('Resources'),
        icon: null,
        color: null,
        lifecycle: 'active',
        metadataVersion: version1,
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    missingResourceIds: [],
    collections: [],
  })
  return index
}

function envelope(command: ResourceStructureCommand): CommandEnvelope<ResourceStructureCommand> {
  return { campaignId, operationId, command }
}

function receipt(command: ResourceStructureCommand): ResourceCommandReceipt {
  const targetId = command.type === 'create' ? command.resourceId : resourceId
  return {
    campaignId,
    operationId,
    result:
      command.type === 'create'
        ? { type: 'created', resourceId: command.resourceId }
        : { type: 'metadataUpdated', resourceId: targetId },
    postconditions: [{ state: 'present', resourceId: targetId, metadataVersion: version2 }],
  }
}

function gateway(
  execute: (
    input: CommandEnvelope<ResourceStructureCommand>,
  ) =>
    | CommandDelivery<ResourceStructureCommandResult>
    | Promise<CommandDelivery<ResourceStructureCommandResult>>,
): ResourceStructureCommandGateway & { executeMock: ReturnType<typeof vi.fn> } {
  const executeMock = vi.fn(execute)
  return {
    execute: async (input) => await executeMock(input),
    executeMock,
  }
}

describe('optimistic resource structure runtime', () => {
  it('renders final create identity before authoritative delivery and confirms from the receipt', async () => {
    let resolveDelivery!: (delivery: CommandDelivery<ResourceStructureCommandResult>) => void
    const authoritative = gateway(
      () =>
        new Promise<CommandDelivery<ResourceStructureCommandResult>>((resolve) => {
          resolveDelivery = resolve
        }),
    )
    const runtime = createOptimisticResourceStructureRuntime(baseIndex(), authoritative, () => 10)
    const command = {
      type: 'create' as const,
      resourceId: createdId,
      kind: 'note' as const,
      parentId: resourceId,
      title: canonicalizeResourceTitle('Created'),
      icon: null,
      color: null,
    }

    const pending = runtime.structure.execute(envelope(command))
    await vi.waitFor(() => {
      expect(runtime.index.getSnapshot().lookup(createdId)).toEqual({
        state: 'known',
        value: expect.objectContaining({ id: createdId, title: 'Created' }),
      })
    })
    resolveDelivery({
      status: 'received',
      result: { status: 'completed', receipt: receipt(command) },
    })
    await pending

    expect(runtime.index.overlays()).toEqual([
      expect.objectContaining({ status: 'confirmed', operationId }),
    ])
  })

  it('retains indeterminate delivery and retries the same overlay and operation', async () => {
    const command = {
      type: 'updateMetadata' as const,
      resourceId,
      changes: { title: canonicalizeResourceTitle('Retained') },
    }
    const authoritative = gateway(() => ({
      status: 'indeterminate' as const,
      retryable: true as const,
      reason: 'response_lost' as const,
    }))
    const runtime = createOptimisticResourceStructureRuntime(baseIndex(), authoritative)

    await expect(runtime.structure.execute(envelope(command))).resolves.toMatchObject({
      status: 'indeterminate',
    })
    await expect(runtime.structure.execute(envelope(command))).resolves.toMatchObject({
      status: 'indeterminate',
    })

    expect(runtime.index.overlays()).toHaveLength(1)
    expect(authoritative.executeMock).toHaveBeenCalledTimes(2)
  })

  it('removes the matching overlay after definitive rejection', async () => {
    const authoritative = gateway(() => ({
      status: 'received',
      result: { status: 'rejected', reason: 'unauthorized' },
    }))
    const runtime = createOptimisticResourceStructureRuntime(baseIndex(), authoritative)

    await runtime.structure.execute(
      envelope({
        type: 'updateMetadata',
        resourceId,
        changes: { title: canonicalizeResourceTitle('Rejected') },
      }),
    )

    expect(runtime.index.overlays()).toEqual([])
  })

  it('does not apply optimism to authoritative-only commands', async () => {
    const delivery = {
      status: 'received' as const,
      result: { status: 'rejected' as const, reason: 'content_unavailable' as const },
    }
    const authoritative = gateway(() => delivery)
    const runtime = createOptimisticResourceStructureRuntime(baseIndex(), authoritative)

    await expect(
      runtime.structure.execute(
        envelope({
          type: 'deepCopy',
          sourceRootIds: [resourceId],
          destinationParentId: null,
        }),
      ),
    ).resolves.toEqual(delivery)
    expect(runtime.index.overlays()).toEqual([])
  })

  it('returns typed dependency unavailability without calling the provider', async () => {
    const authoritative = gateway(() => ({
      status: 'not_committed',
      retryable: false,
      reason: 'request_rejected',
    }))
    const runtime = createOptimisticResourceStructureRuntime(baseIndex(), authoritative)

    await expect(
      runtime.structure.execute(
        envelope({
          type: 'updateMetadata',
          resourceId: createdId,
          changes: { title: canonicalizeResourceTitle('Unavailable') },
        }),
      ),
    ).resolves.toEqual({
      status: 'received',
      result: { status: 'unavailable', reason: 'dependency_unavailable' },
    })
    expect(authoritative.executeMock).not.toHaveBeenCalled()
  })
})
