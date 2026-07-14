import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'
import type { AuthoredDestination } from '../authored-destination-contract'
import { parseSafeHttpsUrl } from '../authored-destination-contract'
import type { ContentSessionState } from '../content-session-contract'
import { assertSha256Digest, initialVersion } from '../component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '../domain-id'
import type { PortablePathProjection } from '../portable-path-contract'
import { PORTABLE_PATH_VERSION } from '../portable-path-contract'
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
import { RESOURCE_KIND, canonicalizeResourceTitle } from '../resource-contract'
import type { WizardArchiveManifest } from '../wizard-archive-contract'
import {
  WIZARD_ARCHIVE_CANVAS_SECTION_VERSION,
  WIZARD_ARCHIVE_FILE_SECTION_VERSION,
  WIZARD_ARCHIVE_MAP_SECTION_VERSION,
  WIZARD_ARCHIVE_NOTE_SECTION_VERSION,
  WIZARD_ARCHIVE_SCHEMA_VERSION,
  WIZARD_ARCHIVE_VERSION,
} from '../wizard-archive-contract'

const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, '01890f47-f6c8-7a5b-8c9d-0123456789a1')
const operationId = assertDomainId(DOMAIN_ID_KIND.operation, '01890f47-f6c8-7a5b-8c9d-0123456789a3')
const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, '01890f47-f6c8-7a5b-8c9d-0123456789a4')
const snapshotId = assertDomainId(DOMAIN_ID_KIND.snapshot, '01890f47-f6c8-7a5b-8c9d-0123456789a5')
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
      local: { edits: 1 },
    } satisfies ContentSessionState<{ edits: number }, Uint8Array>
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

  it('models actual portable paths and one full-campaign manifest without plan identity', () => {
    const projection = {
      version: PORTABLE_PATH_VERSION,
      entries: [],
      warnings: [],
      failures: [],
    } satisfies PortablePathProjection
    const manifest = {
      version: WIZARD_ARCHIVE_VERSION,
      schemaVersion: WIZARD_ARCHIVE_SCHEMA_VERSION,
      scope: 'full_campaign',
      sourceCampaignId: campaignId,
      transferSnapshotId: snapshotId,
      portablePathVersion: PORTABLE_PATH_VERSION,
      resources: [],
      tombstones: [],
      aliases: [],
      roles: [],
      sections: {
        notes: { version: WIZARD_ARCHIVE_NOTE_SECTION_VERSION, entries: [] },
        files: { version: WIZARD_ARCHIVE_FILE_SECTION_VERSION, entries: [] },
        maps: { version: WIZARD_ARCHIVE_MAP_SECTION_VERSION, entries: [] },
        canvases: { version: WIZARD_ARCHIVE_CANVAS_SECTION_VERSION, entries: [] },
      },
    } satisfies WizardArchiveManifest

    expect(projection).not.toHaveProperty('planDigest')
    expect(manifest.sourceCampaignId).toBe(campaignId)
  })
})

describe('removed architecture boundaries', () => {
  it('keeps replaced command, index, version, and archive models out of canonical contracts', () => {
    const command = readFileSync(
      'packages/editor/src/resources/resource-command-contract.ts',
      'utf8',
    )
    const index = readFileSync('packages/editor/src/resources/resource-index-contract.ts', 'utf8')
    const componentVersion = readFileSync(
      'packages/editor/src/resources/component-version.ts',
      'utf8',
    )
    const archive = readFileSync('packages/editor/src/resources/wizard-archive-contract.ts', 'utf8')

    expect(command).not.toMatch(
      /needsDecision|inverse|undo|redo|emptyTrash|ifMatch|clientFingerprint/,
    )
    expect(index).not.toMatch(/ensureSubtree|providerCursor|operationId/)
    expect(componentVersion).not.toMatch(/concurrent|vectorClock|replicaId|codecRegistry/)
    expect(archive).not.toMatch(/signature|attestation|trustClass|selectedResource/)
  })
})
