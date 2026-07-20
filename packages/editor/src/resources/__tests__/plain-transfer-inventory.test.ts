import { describe, expect, it } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import {
  PLAIN_TRANSFER_LIMITS,
  buildPlainTransferInventory,
  createPlainTransferManifest,
  digestPlainTransferPlan,
  materializePlainTransferInventory,
  planPlainTransferManifest,
} from '../plain-transfer-inventory'
import type {
  PlainTransferInputEntry,
  PlainTransferIntent,
  PlainTransferManifest,
  PlainTransferSourceDescriptor,
} from '../transfer-job-contract'

const encoder = new TextEncoder()

describe('plain transfer inventory', () => {
  it('derives one canonical resource tree and stable identities from the bounded manifest', async () => {
    const manifest = transferManifest(
      [{ id: 'upload', kind: 'directory', name: 'Campaign' }],
      [
        directory('upload', 'Notes'),
        fileManifest('upload', 'Notes/Session.md', 9),
        fileManifest('upload', 'map.bin', 3),
      ],
    )

    const first = await planPlainTransferManifest(manifest)
    const reordered = await planPlainTransferManifest({
      ...manifest,
      entries: [...manifest.entries].reverse(),
    })

    expect(first.status).toBe('ready')
    expect(reordered.status).toBe('ready')
    if (first.status !== 'ready' || reordered.status !== 'ready') return
    expect(
      first.plan.resources.map((resource) => ({
        id: resource.id,
        operationId: resource.operationId,
        parentId: resource.parentId,
        path: resource.sourcePath,
        type: resource.entryType,
      })),
    ).toEqual(
      reordered.plan.resources.map((resource) => ({
        id: resource.id,
        operationId: resource.operationId,
        parentId: resource.parentId,
        path: resource.sourcePath,
        type: resource.entryType,
      })),
    )
    expect(first.plan.resources.map((resource) => resource.sourcePath)).toEqual([
      'Campaign',
      'Campaign/Notes',
      'Campaign/map.bin',
      'Campaign/Notes/Session.md',
    ])
    expect(
      first.plan.resources.every((resource) => resource.alias.importJobId === manifest.jobId),
    ).toBe(true)
  })

  it('materializes Markdown notes and classified files without changing the stored plan', async () => {
    const entries: Array<PlainTransferInputEntry> = [
      textFile('notes', 'Session.md', '# Arrival'),
      binaryFile('map', 'map.bin', [1, 2, 3]),
    ]
    const manifest = createPlainTransferManifest({
      intent: transferIntent(),
      sources: [
        { id: 'notes', kind: 'file', name: 'Session.md' },
        { id: 'map', kind: 'file', name: 'map.bin' },
      ],
      entries,
    })
    const planned = await planPlainTransferManifest(manifest)
    if (planned.status !== 'ready') throw new TypeError('Expected a valid transfer plan')

    const result = await materializePlainTransferInventory(planned.plan, entries)

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.inventory.resources).toMatchObject([
      {
        id: planned.plan.resources[0]!.id,
        kind: 'file',
        content: { source: { metadata: { byteSize: 3 } } },
      },
      {
        id: planned.plan.resources[1]!.id,
        kind: 'note',
        content: { source: { text: '# Arrival' } },
      },
    ])
  })

  it('rejects bytes that do not match the reserved manifest', async () => {
    const original = textFile('notes', 'Session.md', 'Original')
    const manifest = createPlainTransferManifest({
      intent: transferIntent(),
      sources: [{ id: 'notes', kind: 'file', name: 'Session.md' }],
      entries: [original],
    })

    await expect(
      buildPlainTransferInventory({
        manifest,
        entries: [textFile('notes', 'Session.md', 'Changed content')],
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'source_changed' })
  })

  it('rejects legacy control trees instead of retaining an alternate workspace path', async () => {
    const manifest = transferManifest(
      [{ id: 'archive', kind: 'zip', name: 'Campaign.zip' }],
      [
        directory('archive', '.wizardarchive'),
        fileManifest('archive', '.wizardarchive/manifest.json', 2),
      ],
    )

    await expect(planPlainTransferManifest(manifest)).resolves.toEqual({
      status: 'rejected',
      reason: 'invalid_source',
    })
  })

  it('enforces source, entry, path, and declared-byte bounds before materialization', async () => {
    const tooManySources = Array.from(
      { length: PLAIN_TRANSFER_LIMITS.maxSources + 1 },
      (_, index): PlainTransferSourceDescriptor => ({
        id: `source-${index}`,
        kind: 'file',
        name: `${index}.bin`,
      }),
    )
    await expect(
      planPlainTransferManifest(
        transferManifest(
          tooManySources,
          tooManySources.map((source) => fileManifest(source.id, source.name, 0)),
        ),
      ),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_request' })

    const tooManyEntries = Array.from(
      { length: PLAIN_TRANSFER_LIMITS.maxEntries + 1 },
      (_, index) => fileManifest('upload', `${index}.bin`, 0),
    )
    await expect(
      planPlainTransferManifest(
        transferManifest([{ id: 'upload', kind: 'directory', name: 'Upload' }], tooManyEntries),
      ),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_request' })

    await expect(
      planPlainTransferManifest(
        transferManifest(
          [{ id: 'upload', kind: 'file', name: 'deep.bin' }],
          [fileManifest('upload', `${'a'.repeat(PLAIN_TRANSFER_LIMITS.maxPathUtf8Bytes)}.bin`, 0)],
        ),
      ),
    ).resolves.toEqual({ status: 'rejected', reason: 'path_limit_exceeded' })

    await expect(
      planPlainTransferManifest(
        transferManifest(
          [{ id: 'upload', kind: 'file', name: 'large.bin' }],
          [fileManifest('upload', 'large.bin', PLAIN_TRANSFER_LIMITS.maxTotalBytes + 1)],
        ),
      ),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_request' })
  })

  it('fingerprints canonical manifest intent independently of entry order', async () => {
    const manifest = transferManifest(
      [{ id: 'upload', kind: 'directory', name: 'Campaign' }],
      [fileManifest('upload', 'b.bin', 2), fileManifest('upload', 'a.bin', 1)],
    )
    const first = await planPlainTransferManifest(manifest)
    const reordered = await planPlainTransferManifest({
      ...manifest,
      entries: [...manifest.entries].reverse(),
    })
    if (first.status !== 'ready' || reordered.status !== 'ready') {
      throw new TypeError('Expected valid transfer plans')
    }

    await expect(digestPlainTransferPlan(first.plan)).resolves.toBe(
      await digestPlainTransferPlan(reordered.plan),
    )
  })
})

function transferIntent(): PlainTransferIntent {
  const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
  return {
    campaignId,
    jobId: generateDomainId(DOMAIN_ID_KIND.importJob),
    destinationParentId: null,
    textFileHandling: 'notes',
  }
}

function transferManifest(
  sources: ReadonlyArray<PlainTransferSourceDescriptor>,
  entries: PlainTransferManifest['entries'],
): PlainTransferManifest {
  const intent = transferIntent()
  return {
    version: 'plain-transfer-manifest-v1',
    jobId: intent.jobId,
    destinationCampaignId: intent.campaignId,
    destinationParentId: null,
    textFileHandling: 'notes',
    sources,
    entries,
  }
}

function directory(sourceId: string, path: string) {
  return { sourceId, path, type: 'directory' as const }
}

function fileManifest(sourceId: string, path: string, byteSize: number) {
  return { sourceId, path, type: 'file' as const, byteSize }
}

function textFile(sourceId: string, path: string, text: string) {
  return { sourceId, path, type: 'file' as const, bytes: encoder.encode(text) }
}

function binaryFile(sourceId: string, path: string, bytes: ReadonlyArray<number>) {
  return { sourceId, path, type: 'file' as const, bytes: Uint8Array.from(bytes) }
}
