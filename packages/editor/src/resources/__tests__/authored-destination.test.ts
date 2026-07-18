import { describe, expect, it } from 'vite-plus/test'
import type { AuthoredDestination, CanonicalTarget } from '../authored-destination-contract'
import { parseSafeHttpsUrl } from '../authored-destination-contract'
import {
  MAX_RESOURCE_REFERENCE_TARGETS,
  backlinksForResource,
  projectReferenceGraph,
  parseSerializedAuthoredDestination,
  remapAuthoredDestination,
  resolveAuthoredDestination,
  resolveSourceAuthoredDestination,
  serializeAuthoredDestination,
} from '../authored-destination'
import { VERSION_SCHEME, assertSha256Digest } from '../component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '../domain-id'
import type { ResourceId } from '../domain-id'
import { createSourcePathAlias } from '../source-path-alias'

const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, '01890f40-f6c8-7a5b-8c9d-0123456789ab')
const otherCampaignId = assertDomainId(
  DOMAIN_ID_KIND.campaign,
  '01890f41-f6c8-7a5b-8c9d-0123456789ab',
)
const sourceId = asResourceId('01890f42-f6c8-7a5b-8c9d-0123456789ab')
const targetId = asResourceId('01890f43-f6c8-7a5b-8c9d-0123456789ab')
const copiedTargetId = asResourceId('01890f44-f6c8-7a5b-8c9d-0123456789ab')
const version = { scheme: VERSION_SCHEME, revision: 3, digest: assertSha256Digest('a'.repeat(64)) }

describe('authored destinations', () => {
  it('serializes one canonical representation and rejects non-canonical stored values', () => {
    const destination = internalResource(targetId)
    const serialized = serializeAuthoredDestination(destination)

    expect(serialized).toBe(
      `{"kind":"internal","target":{"kind":"resource","resourceId":"${targetId}"}}`,
    )
    expect(parseSerializedAuthoredDestination(serialized)).toEqual(destination)
    expect(
      parseSerializedAuthoredDestination(
        `{"target":{"resourceId":"${targetId}","kind":"resource"},"kind":"internal"}`,
      ),
    ).toBeNull()
    expect(parseSerializedAuthoredDestination(` ${serialized}`)).toBeNull()
    expect(
      parseSerializedAuthoredDestination(
        JSON.stringify({ kind: 'externalUrl', url: 'http://example.com' }),
      ),
    ).toBeNull()
    expect(parseSerializedAuthoredDestination('{')).toBeNull()
  })

  it('resolves available display data without persisting it', async () => {
    const destination = internalResource(targetId)

    await expect(
      resolveAuthoredDestination(destination, {
        campaignId,
        lookup: () => ({
          state: 'available',
          campaignId,
          display: { title: 'Current title', breadcrumb: ['Current folder'] },
        }),
      }),
    ).resolves.toEqual({
      status: 'available',
      kind: 'internal',
      target: destination.target,
      display: { title: 'Current title', breadcrumb: ['Current folder'] },
    })
    expect(destination).not.toHaveProperty('display')
  })

  it('keeps missing, redacted, and cross-campaign targets distinct', async () => {
    const destination = internalResource(targetId)
    await expect(
      resolveAuthoredDestination(destination, { campaignId, lookup: () => ({ state: 'missing' }) }),
    ).resolves.toEqual({
      status: 'broken',
      kind: 'internal',
      target: destination.target,
      reason: 'missing',
    })
    await expect(
      resolveAuthoredDestination(destination, {
        campaignId,
        lookup: () => ({ state: 'unavailable' }),
      }),
    ).resolves.toEqual({ status: 'unavailable', kind: 'internal', target: destination.target })
    await expect(
      resolveAuthoredDestination(destination, {
        campaignId,
        lookup: () => ({ state: 'available', campaignId: otherCampaignId, display: {} }),
      }),
    ).resolves.toEqual({
      status: 'broken',
      kind: 'internal',
      target: destination.target,
      reason: 'cross_campaign',
    })
  })

  it('supports HTTPS and explicit unresolved targets while rejecting unsupported syntax', async () => {
    const url = parseSafeHttpsUrl('https://example.com/path')!
    await expect(
      resolveAuthoredDestination({ kind: 'externalUrl', url }, { campaignId, lookup: missing }),
    ).resolves.toEqual({ status: 'external', url })
    await expect(
      resolveAuthoredDestination(
        { kind: 'unresolved', rawTarget: '../missing.md' },
        { campaignId, lookup: missing },
      ),
    ).resolves.toEqual({ status: 'unresolved', rawTarget: '../missing.md' })
    await expect(
      resolveAuthoredDestination(
        { kind: 'externalUrl', url: 'http://example.com' },
        { campaignId, lookup: missing },
      ),
    ).resolves.toEqual({ status: 'unsupported' })
    await expect(
      resolveAuthoredDestination(
        { ...internalResource(targetId), title: 'Persisted display leak' },
        { campaignId, lookup: missing },
      ),
    ).resolves.toEqual({ status: 'unsupported' })
    await expect(
      resolveAuthoredDestination(
        {
          kind: 'internal',
          target: {
            kind: 'noteBlock',
            resourceId: targetId,
            blockId: '01890f47-f6c8-7a5b-8c9d-0123456789ab',
            presentation: 'title',
          },
        },
        { campaignId, lookup: missing },
      ),
    ).resolves.toEqual({ status: 'unsupported' })
  })

  it('consumes exact source-path resolution and preserves ambiguity', () => {
    const importJobId = assertDomainId(
      DOMAIN_ID_KIND.importJob,
      '01890f45-f6c8-7a5b-8c9d-0123456789ab',
    )
    const secondId = asResourceId('01890f46-f6c8-7a5b-8c9d-0123456789ab')
    const aliases = [targetId, secondId].map((id, index) =>
      createSourcePathAlias({
        campaignId,
        importJobId,
        resourceId: id,
        sourceRootId: 'upload',
        rawPath: `${index}/Entry.md`,
      }),
    )

    expect(
      resolveSourceAuthoredDestination(aliases, {
        importJobId,
        sourceRootId: 'upload',
        rawTarget: '0/Entry.md',
      }),
    ).toEqual({ status: 'authored', destination: internalResource(targetId) })
    expect(
      resolveSourceAuthoredDestination(aliases, {
        importJobId,
        sourceRootId: 'upload',
        rawTarget: 'Entry.md',
      }),
    ).toEqual({ status: 'ambiguous', resourceIds: [targetId, secondId].sort() })
    expect(
      resolveSourceAuthoredDestination(aliases, {
        importJobId,
        sourceRootId: 'upload',
        rawTarget: 'Missing.md',
      }),
    ).toEqual({
      status: 'authored',
      destination: { kind: 'unresolved', rawTarget: 'Missing.md' },
    })
  })

  it('remaps copied targets, preserves outside copy targets, and rejects incomplete clone maps', () => {
    const destination = internalResource(targetId)
    const targetMap = [
      {
        source: destination.target,
        destination: { kind: 'resource', resourceId: copiedTargetId } as const,
      },
    ]

    expect(remapAuthoredDestination(destination, targetMap, 'same_campaign_copy')).toEqual({
      status: 'completed',
      destination: internalResource(copiedTargetId),
    })
    expect(remapAuthoredDestination(destination, [], 'same_campaign_copy')).toEqual({
      status: 'completed',
      destination,
    })
    expect(remapAuthoredDestination(destination, [], 'same_campaign_update')).toEqual({
      status: 'completed',
      destination,
    })
    expect(remapAuthoredDestination(destination, [], 'new_campaign_clone')).toEqual({
      status: 'unmapped',
      target: destination.target,
    })
    const external = {
      kind: 'externalUrl',
      url: parseSafeHttpsUrl('https://example.com/reference')!,
    } satisfies AuthoredDestination
    const unresolved = {
      kind: 'unresolved',
      rawTarget: '../missing.md',
    } satisfies AuthoredDestination
    expect(remapAuthoredDestination(external, targetMap, 'new_campaign_clone')).toEqual({
      status: 'completed',
      destination: external,
    })
    expect(remapAuthoredDestination(unresolved, targetMap, 'new_campaign_clone')).toEqual({
      status: 'completed',
      destination: unresolved,
    })
  })

  it('derives deterministic outgoing and backlink rows from exact content versions', () => {
    const blockId = assertDomainId(DOMAIN_ID_KIND.noteBlock, '01890f47-f6c8-7a5b-8c9d-0123456789ab')
    const blockTarget = {
      kind: 'noteBlock',
      resourceId: targetId,
      blockId,
      presentation: 'heading',
    } satisfies CanonicalTarget
    const edges = projectReferenceGraph(sourceId, version, [
      { kind: 'internal', target: blockTarget },
      internalResource(targetId),
      internalResource(targetId),
      { kind: 'unresolved', rawTarget: 'missing' },
    ])

    expect(edges).toHaveLength(2)
    expect(edges.every((edge) => edge.sourceVersion === version)).toBe(true)
    expect(backlinksForResource(edges, targetId)).toEqual(edges)
    expect(backlinksForResource(edges, copiedTargetId)).toEqual([])
  })

  it('rejects reference projections that exceed the synchronous graph bound', () => {
    const destinations = Array.from({ length: MAX_RESOURCE_REFERENCE_TARGETS + 1 }, (_, index) =>
      internalResource(
        asResourceId(
          `01890f47-${(index + 1).toString(16).padStart(4, '0')}-7a5b-8c9d-${index
            .toString(16)
            .padStart(12, '0')}`,
        ),
      ),
    )

    expect(() => projectReferenceGraph(sourceId, version, destinations)).toThrow(RangeError)
  })
})

function asResourceId(value: string): ResourceId {
  return assertDomainId(DOMAIN_ID_KIND.resource, value)
}

function internalResource(id: ResourceId) {
  return {
    kind: 'internal',
    target: { kind: 'resource', resourceId: id },
  } satisfies AuthoredDestination
}

function missing() {
  return { state: 'missing' } as const
}
