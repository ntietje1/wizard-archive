import { describe, expect, it } from 'vite-plus/test'
import type { AuthoredDestination } from '../authored-destination-contract'
import { parseSafeHttpsUrl } from '../authored-destination-contract'
import type { ContentPendingState } from '../content-session-contract'
import { assertSha256Digest, initialVersion } from '../component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '../domain-id'
import type {
  CommandEnvelope,
  ResourceCommandReceipt,
  ResourceStructureCommand,
} from '../resource-command-contract'
import type {
  AuthorizedResourceSummary,
  ResourceCollectionQuery,
  ResourceIndexLoader,
} from '../resource-index-contract'
import { RESOURCE_KIND, canonicalizeResourceTitle } from '../resource-record'

const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, '01890f47-f6c8-7a5b-8c9d-0123456789a1')
const operationId = assertDomainId(DOMAIN_ID_KIND.operation, '01890f47-f6c8-7a5b-8c9d-0123456789a3')
const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, '01890f47-f6c8-7a5b-8c9d-0123456789a4')
const blockId = assertDomainId(DOMAIN_ID_KIND.noteBlock, '01890f47-f6c8-7a5b-8c9d-0123456789a6')
const version = initialVersion(assertSha256Digest('a'.repeat(64)))

describe('canonical contract fixtures', () => {
  it('models the UUID command, receipt, and postcondition path without decisions', () => {
    const command = {
      type: 'create',
      resourceId,
      kind: RESOURCE_KIND.note,
      parentId: null,
      title: canonicalizeResourceTitle('Duplicate'),
      icon: 'Notebook',
      color: '#abcdef',
    } satisfies ResourceStructureCommand
    const envelope = { campaignId, operationId, command } satisfies CommandEnvelope<typeof command>
    const receipt = {
      campaignId,
      operationId,
      result: { type: 'created', resourceId },
      postconditions: [{ state: 'present', resourceId, metadataVersion: version }],
    } satisfies ResourceCommandReceipt

    expect(envelope.command.resourceId).toBe(resourceId)
    expect(receipt.postconditions).toEqual([
      { state: 'present', resourceId, metadataVersion: version },
    ])
  })

  it('keeps partial resource knowledge and loading separate', async () => {
    const query = {
      parentId: null,
      lifecycle: 'active',
      kinds: [RESOURCE_KIND.note],
    } satisfies ResourceCollectionQuery
    const summary = {
      id: resourceId,
      campaignId,
      displayParentId: null,
      kind: RESOURCE_KIND.note,
      title: canonicalizeResourceTitle('Duplicate'),
      icon: null,
      color: null,
      lifecycle: 'active',
      metadataVersion: version,
      createdAt: 1,
      updatedAt: 1,
    } satisfies AuthorizedResourceSummary
    const loader: ResourceIndexLoader = {
      ensureResource: () => Promise.resolve({ status: 'completed' }),
      ensureCollection: () => Promise.resolve({ status: 'completed' }),
    }

    expect(summary.displayParentId).toBeNull()
    await expect(loader.ensureCollection(query)).resolves.toEqual({ status: 'completed' })
  })

  it('keeps initializing content and authored destinations explicit', () => {
    const state = {
      status: 'initializing',
      operationId,
    } satisfies ContentPendingState
    const internal = {
      kind: 'internal',
      target: { kind: 'noteBlock', resourceId, blockId, presentation: 'heading' },
    } satisfies AuthoredDestination
    const url = parseSafeHttpsUrl('https://example.com/path')
    const external = url ? ({ kind: 'externalUrl', url } satisfies AuthoredDestination) : null
    const unresolved = {
      kind: 'unresolved',
      rawTarget: '../missing.md',
    } satisfies AuthoredDestination

    expect(state.status).toBe('initializing')
    expect(internal.target.blockId).toBe(blockId)
    expect(external?.url).toBe('https://example.com/path')
    expect(unresolved.rawTarget).toBe('../missing.md')
  })
})
