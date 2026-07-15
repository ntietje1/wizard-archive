import { describe, expect, it } from 'vite-plus/test'
import { parseSafeHttpsUrl } from '../authored-destination-contract'
import { assertSha256Digest, initialVersion, sha256Digest } from '../component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '../domain-id'
import type { PortableRelativePath } from '../portable-path-contract'
import { PORTABLE_PATH_VERSION } from '../portable-path-contract'
import { canonicalizeResourceTitle } from '../resource-record'
import { createSourcePathAlias } from '../source-path-alias'
import {
  encodeWizardArchiveManifest,
  parseWizardArchiveManifest,
  validateWizardArchivePackage,
} from '../wizard-archive-codec'
import type { WizardArchivePackageEntry } from '../wizard-archive-codec'
import {
  WIZARD_ARCHIVE_CANVAS_SECTION_VERSION,
  WIZARD_ARCHIVE_FILE_SECTION_VERSION,
  WIZARD_ARCHIVE_MANIFEST_PATH,
  WIZARD_ARCHIVE_MAP_SECTION_VERSION,
  WIZARD_ARCHIVE_NOTE_SECTION_VERSION,
  WIZARD_ARCHIVE_SCHEMA_VERSION,
  WIZARD_ARCHIVE_VERSION,
} from '../wizard-archive-contract'
import type { WizardArchiveManifest, WizardArchiveResource } from '../wizard-archive-contract'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const campaignId = domainId(DOMAIN_ID_KIND.campaign, '01890f40-f6c8-7a5b-8c9d-0123456789ab')
const snapshotId = domainId(DOMAIN_ID_KIND.snapshot, '01890f41-f6c8-7a5b-8c9d-0123456789ab')
const folderId = domainId(DOMAIN_ID_KIND.resource, '01890f42-f6c8-7a5b-8c9d-0123456789ab')
const noteId = domainId(DOMAIN_ID_KIND.resource, '01890f43-f6c8-7a5b-8c9d-0123456789ab')
const fileId = domainId(DOMAIN_ID_KIND.resource, '01890f44-f6c8-7a5b-8c9d-0123456789ab')
const mapId = domainId(DOMAIN_ID_KIND.resource, '01890f45-f6c8-7a5b-8c9d-0123456789ab')
const canvasId = domainId(DOMAIN_ID_KIND.resource, '01890f46-f6c8-7a5b-8c9d-0123456789ab')
const tombstoneId = domainId(DOMAIN_ID_KIND.resource, '01890f47-f6c8-7a5b-8c9d-0123456789ab')
const blockId = domainId(DOMAIN_ID_KIND.noteBlock, '01890f48-f6c8-7a5b-8c9d-0123456789ab')
const assetId = domainId(DOMAIN_ID_KIND.asset, '01890f49-f6c8-7a5b-8c9d-0123456789ab')
const pinId = domainId(DOMAIN_ID_KIND.mapPin, '01890f50-f6c8-7a5b-8c9d-0123456789ab')
const nodeId = domainId(DOMAIN_ID_KIND.canvasNode, '01890f51-f6c8-7a5b-8c9d-0123456789ab')
const importJobId = domainId(DOMAIN_ID_KIND.importJob, '01890f52-f6c8-7a5b-8c9d-0123456789ab')
const version = initialVersion(assertSha256Digest('a'.repeat(64)))

describe('Wizard Archive manifest codec', () => {
  it('writes stable UTF-8 JSON and parses independently of top-level key order', async () => {
    const fixture = await createFixture()
    const reversed = {
      ...fixture.manifest,
      resources: [...fixture.manifest.resources].reverse(),
      aliases: [...fixture.manifest.aliases].reverse(),
    }
    const encoded = encodeWizardArchiveManifest(fixture.manifest)

    expect(encoded.slice(0, 3)).not.toEqual(Uint8Array.from([0xef, 0xbb, 0xbf]))
    expect(encodeWizardArchiveManifest(reversed)).toEqual(encoded)
    expect(parseWizardArchiveManifest(encoded)).toEqual({
      status: 'valid',
      manifest: expect.objectContaining({ sourceCampaignId: campaignId, scope: 'full_campaign' }),
    })

    const parsed = JSON.parse(decoder.decode(encoded)) as Record<string, unknown>
    const reordered = Object.fromEntries(Object.entries(parsed).reverse())
    expect(parseWizardArchiveManifest(encoder.encode(JSON.stringify(reordered))).status).toBe(
      'valid',
    )
    expect(
      parseWizardArchiveManifest(
        encoder.encode(
          JSON.stringify({
            ...parsed,
            optionalSections: [
              {
                name: 'future-display-hints',
                version: 'display-hints-v2',
                required: false,
                data: {},
              },
            ],
          }),
        ),
      ).status,
    ).toBe('valid')
  })

  it('rejects unsupported versions, BOMs, unknown fields, and invalid package placement', async () => {
    const fixture = await createFixture()
    const raw = JSON.parse(decoder.decode(encodeWizardArchiveManifest(fixture.manifest)))

    expect(
      parseWizardArchiveManifest(
        encoder.encode(JSON.stringify({ ...raw, version: 'wizard-archive-v2' })),
      ),
    ).toEqual({ status: 'invalid', reason: 'unsupported_version' })
    expect(
      parseWizardArchiveManifest(
        Uint8Array.from([0xef, 0xbb, 0xbf, ...encodeWizardArchiveManifest(fixture.manifest)]),
      ),
    ).toEqual({ status: 'invalid', reason: 'invalid_encoding' })
    expect(
      parseWizardArchiveManifest(encoder.encode(JSON.stringify({ ...raw, providerId: 'leak' }))),
    ).toEqual({ status: 'invalid', reason: 'invalid_manifest' })
    expect(
      parseWizardArchiveManifest(
        encoder.encode(
          JSON.stringify({
            ...raw,
            optionalSections: [
              { name: 'future-required', version: 'future-v1', required: true, data: {} },
            ],
          }),
        ),
      ),
    ).toEqual({ status: 'invalid', reason: 'unsupported_version' })

    raw.resources.find((candidate: { id: string }) => candidate.id === noteId).artifact.path =
      '.wizardarchive/active-note.md'
    expect(parseWizardArchiveManifest(encoder.encode(JSON.stringify(raw)))).toEqual({
      status: 'invalid',
      reason: 'invalid_manifest',
    })
  })

  it('rejects hierarchy cycles, noncanonical aliases, and broken internal targets', async () => {
    const fixture = await createFixture()
    const encoded = encodeWizardArchiveManifest(fixture.manifest)
    const cycle = JSON.parse(decoder.decode(encoded))
    cycle.resources.find((candidate: { id: string }) => candidate.id === folderId).parentId = noteId
    expect(parseWizardArchiveManifest(encoder.encode(JSON.stringify(cycle))).status).toBe('invalid')

    const alias = JSON.parse(decoder.decode(encoded))
    alias.aliases[0].normalizedPath = 'lower/note.md'
    expect(parseWizardArchiveManifest(encoder.encode(JSON.stringify(alias))).status).toBe('invalid')

    const reference = JSON.parse(decoder.decode(encoded))
    reference.sections.notes.entries[0].destinations[0].target.resourceId = tombstoneId
    expect(parseWizardArchiveManifest(encoder.encode(JSON.stringify(reference))).status).toBe(
      'invalid',
    )
  })

  it('requires file-owned metadata to match its declared artifact', async () => {
    const fixture = await createFixture()
    const encoded = encodeWizardArchiveManifest(fixture.manifest)
    const byteSize = JSON.parse(decoder.decode(encoded))
    byteSize.sections.files.entries[0].byteSize += 1
    expect(parseWizardArchiveManifest(encoder.encode(JSON.stringify(byteSize))).status).toBe(
      'invalid',
    )

    const viewerState = JSON.parse(decoder.decode(encoded))
    viewerState.sections.files.entries[0].viewerUnavailableReason = 'malformed'
    expect(parseWizardArchiveManifest(encoder.encode(JSON.stringify(viewerState))).status).toBe(
      'invalid',
    )
  })

  it('validates exact declared artifacts, sizes, and digests before application', async () => {
    const fixture = await createFixture()
    const manifestBytes = encodeWizardArchiveManifest(fixture.manifest)
    const entries = packageEntries(fixture, manifestBytes)

    await expect(validateWizardArchivePackage(fixture.manifest, entries)).resolves.toEqual({
      status: 'valid',
    })
    await expect(
      validateWizardArchivePackage(
        fixture.manifest,
        entries.filter((entry) => entry.path !== 'Campaign/Note.md'),
      ),
    ).resolves.toEqual({ status: 'invalid', reason: 'missing_artifact' })
    await expect(
      validateWizardArchivePackage(fixture.manifest, [
        ...entries,
        { kind: 'file', path: 'undeclared.bin', bytes: Uint8Array.of(1) },
      ]),
    ).resolves.toEqual({ status: 'invalid', reason: 'undeclared_artifact' })
    await expect(
      validateWizardArchivePackage(
        fixture.manifest,
        entries.map((entry) =>
          entry.path === 'Campaign/Note.md'
            ? { kind: 'file' as const, path: entry.path, bytes: encoder.encode('changed') }
            : entry,
        ),
      ),
    ).resolves.toEqual({ status: 'invalid', reason: 'artifact_mismatch' })
  })

  it('does not encode a self digest, projection plan, access, sessions, or provider state', async () => {
    const fixture = await createFixture()
    const text = decoder.decode(encodeWizardArchiveManifest(fixture.manifest))

    expect(text).not.toMatch(
      /selfDigest|planDigest|access|bookmark|history|preview|provider|session/,
    )
    expect(text).toContain(WIZARD_ARCHIVE_MANIFEST_PATH.replace('/manifest.json', ''))
  })
})

async function createFixture() {
  const bytes = {
    note: encoder.encode('# Note'),
    file: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
    map: encoder.encode('{}'),
    canvas: encoder.encode('{}'),
  }
  const resources: Array<WizardArchiveResource> = [
    archiveResource(folderId, null, 'folder', 'Campaign', 'Campaign', null),
    archiveResource(
      noteId,
      folderId,
      'note',
      'Note',
      'Campaign/Note.md',
      await sha256Digest(bytes.note),
    ),
    archiveResource(
      fileId,
      null,
      'file',
      'Image',
      'Image.png',
      await sha256Digest(bytes.file),
      'image/png',
    ),
    archiveResource(
      mapId,
      null,
      'map',
      'Old',
      '.wizardarchive/trashed/Old.wizardmap',
      await sha256Digest(bytes.map),
      'application/vnd.wizard-archive.map+json',
      'trashed',
    ),
    archiveResource(
      canvasId,
      null,
      'canvas',
      'Board',
      'Board.wizardcanvas',
      await sha256Digest(bytes.canvas),
      'application/vnd.wizard-archive.canvas+json',
    ),
  ]
  const manifest: WizardArchiveManifest = {
    version: WIZARD_ARCHIVE_VERSION,
    schemaVersion: WIZARD_ARCHIVE_SCHEMA_VERSION,
    scope: 'full_campaign',
    sourceCampaignId: campaignId,
    transferSnapshotId: snapshotId,
    portablePathVersion: PORTABLE_PATH_VERSION,
    resources,
    tombstones: [{ resourceId: tombstoneId, campaignId, deletionVersion: version, deletedAt: 10 }],
    aliases: [
      createSourcePathAlias({
        campaignId,
        resourceId: noteId,
        importJobId,
        sourceRootId: 'upload',
        rawPath: 'Notes/Note.md',
      }),
    ],
    assetsFolderId: folderId,
    sections: {
      notes: {
        version: WIZARD_ARCHIVE_NOTE_SECTION_VERSION,
        entries: [
          {
            resourceId: noteId,
            blockIds: [blockId],
            destinations: [{ kind: 'internal', target: { kind: 'resource', resourceId: fileId } }],
          },
        ],
      },
      files: {
        version: WIZARD_ARCHIVE_FILE_SECTION_VERSION,
        entries: [
          {
            resourceId: fileId,
            assetId,
            classification: 'viewable_image',
            byteSize: 4,
            detectedFormat: 'png',
            extension: 'png',
            mediaType: 'image/png',
            viewerUnavailableReason: null,
            destinations: [],
          },
        ],
      },
      maps: {
        version: WIZARD_ARCHIVE_MAP_SECTION_VERSION,
        entries: [
          {
            resourceId: mapId,
            pinIds: [pinId],
            destinations: [{ kind: 'externalUrl', url: parseSafeHttpsUrl('https://example.com')! }],
          },
        ],
      },
      canvases: {
        version: WIZARD_ARCHIVE_CANVAS_SECTION_VERSION,
        entries: [{ resourceId: canvasId, nodeIds: [nodeId], destinations: [] }],
      },
    },
  }
  return { manifest, bytes }
}

function archiveResource(
  resourceId: WizardArchiveResource['id'],
  parentId: WizardArchiveResource['parentId'],
  kind: WizardArchiveResource['kind'],
  title: string,
  path: string,
  digest: ReturnType<typeof assertSha256Digest> | null,
  mediaType = 'text/markdown',
  lifecycle: WizardArchiveResource['lifecycle'] = 'active',
): WizardArchiveResource {
  return {
    id: resourceId,
    parentId,
    kind,
    title: canonicalizeResourceTitle(title),
    icon: null,
    color: null,
    lifecycle,
    metadataVersion: version,
    contentVersion: kind === 'folder' ? null : version,
    artifact:
      digest === null
        ? { kind: 'directory', path: path as PortableRelativePath }
        : {
            kind: 'file',
            path: path as PortableRelativePath,
            mediaType,
            byteSize: kind === 'note' ? 6 : kind === 'file' ? 4 : 2,
            digest,
          },
  }
}

function packageEntries(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  manifestBytes: Uint8Array,
): Array<WizardArchivePackageEntry> {
  return [
    { kind: 'file', path: WIZARD_ARCHIVE_MANIFEST_PATH, bytes: manifestBytes },
    { kind: 'directory', path: 'Campaign' },
    { kind: 'file', path: 'Campaign/Note.md', bytes: fixture.bytes.note },
    { kind: 'file', path: 'Image.png', bytes: fixture.bytes.file },
    {
      kind: 'file',
      path: '.wizardarchive/trashed/Old.wizardmap',
      bytes: fixture.bytes.map,
    },
    { kind: 'file', path: 'Board.wizardcanvas', bytes: fixture.bytes.canvas },
  ]
}

function domainId<T extends (typeof DOMAIN_ID_KIND)[keyof typeof DOMAIN_ID_KIND]>(
  kind: T,
  value: string,
) {
  return assertDomainId(kind, value)
}
