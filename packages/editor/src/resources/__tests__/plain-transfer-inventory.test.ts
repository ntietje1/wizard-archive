import { describe, expect, it } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import {
  PLAIN_TRANSFER_LIMITS,
  buildPlainTransferInventory,
  digestPlainTransferSources,
} from '../plain-transfer-inventory'
import type { PlainTransferSourceEntry } from '../plain-transfer-inventory'
import { MAX_RESOURCE_SOURCE_BYTES } from '../resource-source-classifier'
import { TRANSFER_JOB_REQUEST_VERSION } from '../transfer-job-contract'
import type { PlainTransferJobRequest, TransferSourceDescriptor } from '../transfer-job-contract'

const encoder = new TextEncoder()

describe('plain transfer inventory', () => {
  it('builds final identities, hierarchy, aliases, and revision-one metadata before mutation', async () => {
    const sources = [directorySource('upload', 'Campaign')]
    const entries: Array<PlainTransferSourceEntry> = [
      directory('upload', 'Notes'),
      markdown('upload', 'Notes/Session.md', '# Arrival'),
      file('upload', 'map.bin', [1, 2, 3]),
    ]
    const request = await plainRequest('plain_workspace', sources, entries)

    const result = await buildPlainTransferInventory({ request, entries })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    const notes = result.inventory.resources.find((resource) => resource.sourcePath === 'Notes')
    const session = result.inventory.resources.find(
      (resource) => resource.sourcePath === 'Notes/Session.md',
    )
    const binary = result.inventory.resources.find((resource) => resource.sourcePath === 'map.bin')
    expect(result.inventory).toMatchObject({
      version: 'plain-transfer-inventory-v3',
      sourceDigest: request.sourceDigest,
    })
    expect(notes).toMatchObject({ kind: 'folder', parentId: null, sourcePath: 'Notes' })
    expect(session).toMatchObject({
      kind: 'note',
      parentId: notes!.id,
      sourcePath: 'Notes/Session.md',
      content: { kind: 'note', source: { text: '# Arrival' } },
      metadataVersion: { scheme: 'authoritative-revision-v1', revision: 1 },
      alias: {
        campaignId: request.destinationCampaignId,
        importJobId: request.jobId,
        rawPath: 'Notes/Session.md',
        normalizedPath: 'Notes/Session.md',
        sourceRootId: 'upload',
      },
    })
    expect(binary).toMatchObject({
      kind: 'file',
      parentId: null,
      sourcePath: 'map.bin',
      content: {
        kind: 'file',
        source: { metadata: { classification: 'inert_file', byteSize: 3 } },
      },
    })
    expect(new Set(result.inventory.resources.map((resource) => resource.id)).size).toBe(3)
    const resourcesById = new Map(
      result.inventory.resources.map((resource) => [resource.id, resource]),
    )
    for (const resource of result.inventory.resources) {
      if (resource.parentId !== null)
        expect(resourcesById.get(resource.parentId)?.kind).toBe('folder')
    }
  })

  it('rebuilds and reloads the same immutable identity plan', async () => {
    const sources = [directorySource('upload', 'Campaign')]
    const entries: Array<PlainTransferSourceEntry> = [
      markdown('upload', 'Notes/Session.md', '# Arrival'),
      file('upload', 'map.bin', [1, 2, 3]),
    ]
    const request = await plainRequest('plain_workspace', sources, entries)

    const first = await buildPlainTransferInventory({ request, entries })
    const resumed = await buildPlainTransferInventory({
      request: structuredClone(request),
      entries: structuredClone(entries).reverse(),
    })

    expect(serializeInventory(resumed)).toBe(serializeInventory(first))
    if (first.status !== 'ready') return
    expect(serializeInventory(reloadInventory(first.inventory))).toBe(
      serializeInventory(first.inventory),
    )
  })

  it('strips a sole ZIP wrapper only for a new plain workspace', async () => {
    const sources = [zipSource('zip', 'campaign.zip')]
    const entries: Array<PlainTransferSourceEntry> = [
      directory('zip', 'Wrapper'),
      directory('zip', 'Wrapper/Notes'),
      markdown('zip', 'Wrapper/Notes/Entry.md', 'Entry'),
    ]

    const workspace = await buildPlainTransferInventory({
      request: await plainRequest('plain_workspace', sources, entries),
      entries,
    })
    const existing = await buildPlainTransferInventory({
      request: await plainRequest('plain_resources', sources, entries),
      entries,
    })

    expect(paths(workspace)).toEqual(['Notes', 'Notes/Entry.md'])
    expect(paths(existing)).toEqual([
      'campaign',
      'campaign/Wrapper',
      'campaign/Wrapper/Notes',
      'campaign/Wrapper/Notes/Entry.md',
    ])
  })

  it('keeps same-title source containers independent', async () => {
    const sources = [directorySource('left', 'Notes'), directorySource('right', 'Notes')]
    const entries = [markdown('left', 'Entry.md', 'Left'), markdown('right', 'Entry.md', 'Right')]
    const result = await buildPlainTransferInventory({
      request: await plainRequest('plain_resources', sources, entries),
      entries,
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    const roots = result.inventory.resources.filter((resource) => resource.parentId === null)
    expect(roots.map((resource) => resource.title)).toEqual(['Notes', 'Notes'])
    expect(new Set(roots.map((resource) => resource.id)).size).toBe(2)
    expect(
      result.inventory.resources
        .filter((resource) => resource.kind === 'note')
        .map((resource) => resource.parentId),
    ).toEqual(roots.map((resource) => resource.id))
  })

  it('requires an explicit choice when plain input contains a Wizard Archive manifest', async () => {
    const sources = [zipSource('zip', 'campaign.zip')]
    const entries = [
      file('zip', '.wizardarchive/manifest.json', [123, 125]),
      markdown('zip', 'Entry.md', 'Entry'),
    ]

    const rejected = await buildPlainTransferInventory({
      request: await plainRequest('plain_resources', sources, entries, 'reject'),
      entries,
    })
    const continued = await buildPlainTransferInventory({
      request: await plainRequest('plain_resources', sources, entries, 'continue_plain'),
      entries,
    })

    expect(rejected).toEqual({
      status: 'rejected',
      reason: 'manifest_requires_explicit_choice',
    })
    expect(paths(continued)).toEqual(['campaign', 'campaign/Entry.md'])
  })

  it('classifies a sole-wrapper manifest before placement and excludes all control metadata', async () => {
    const sources = [zipSource('zip', 'campaign.zip')]
    const entries = [
      directory('zip', 'Wrapper'),
      directory('zip', 'Wrapper/.wizardarchive'),
      file('zip', 'Wrapper/.wizardarchive/manifest.json', [123, 125]),
      file('zip', 'Wrapper/.wizardarchive/private.bin', [1, 2, 3]),
      directory('zip', 'Wrapper/Notes'),
      markdown('zip', 'Wrapper/Notes/Entry.md', 'Entry'),
    ]

    await expect(
      buildPlainTransferInventory({
        request: await plainRequest('plain_workspace', sources, entries, 'reject'),
        entries,
      }),
    ).resolves.toEqual({
      status: 'rejected',
      reason: 'manifest_requires_explicit_choice',
    })

    const request = await plainRequest('plain_workspace', sources, entries, 'continue_plain')
    const first = await buildPlainTransferInventory({ request, entries })
    const resumed = await buildPlainTransferInventory({ request, entries: [...entries].reverse() })
    const placed = await buildPlainTransferInventory({
      request: await plainRequest('plain_resources', sources, entries, 'continue_plain'),
      entries,
    })
    expect(paths(first)).toEqual(['Notes', 'Notes/Entry.md'])
    expect(serializeInventory(resumed)).toBe(serializeInventory(first))
    expect(paths(placed)).toEqual([
      'campaign',
      'campaign/Wrapper',
      'campaign/Wrapper/Notes',
      'campaign/Wrapper/Notes/Entry.md',
    ])
  })

  it('rejects duplicate, malformed, and ambiguously placed manifests without fallback', async () => {
    const duplicateSources = [zipSource('left', 'left.zip'), zipSource('right', 'right.zip')]
    const duplicateEntries = [
      file('left', '.wizardarchive/manifest.json', [123, 125]),
      file('right', '.wizardarchive/manifest.json', [123, 125]),
    ]
    await expect(
      buildPlainTransferInventory({
        request: await plainRequest(
          'plain_resources',
          duplicateSources,
          duplicateEntries,
          'continue_plain',
        ),
        entries: duplicateEntries,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_source' })

    const sources = [zipSource('zip', 'campaign.zip')]
    const malformed = [file('zip', '.wizardarchive/manifest.json', [123])]
    await expect(
      buildPlainTransferInventory({
        request: await plainRequest('plain_resources', sources, malformed, 'continue_plain'),
        entries: malformed,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_source' })

    const ambiguous = [
      directory('zip', 'Wrapper'),
      file('zip', 'Wrapper/.wizardarchive/manifest.json', [123, 125]),
      markdown('zip', 'Sibling.md', 'Sibling'),
    ]
    await expect(
      buildPlainTransferInventory({
        request: await plainRequest('plain_resources', sources, ambiguous, 'continue_plain'),
        entries: ambiguous,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_source' })
  })

  it('rejects changed, duplicate, traversing, oversized-depth, and oversized-count sources', async () => {
    const sources = [directorySource('upload', 'Campaign')]
    const entry = markdown('upload', 'Entry.md', 'Original')
    const request = await plainRequest('plain_workspace', sources, [entry])

    await expect(
      buildPlainTransferInventory({
        request,
        entries: [markdown('upload', 'Entry.md', 'Changed')],
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'source_changed' })
    await expect(
      buildPlainTransferInventory({ request, entries: [entry, entry] }),
    ).resolves.toEqual({ status: 'rejected', reason: 'duplicate_source_path' })
    await expect(
      buildPlainTransferInventory({ request, entries: [markdown('upload', '../Entry.md', 'x')] }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_source' })

    const deep = markdown(
      'upload',
      `${Array.from({ length: PLAIN_TRANSFER_LIMITS.maxPathDepth + 1 }, () => 'd').join('/')}.md`,
      'x',
    )
    await expect(buildPlainTransferInventory({ request, entries: [deep] })).resolves.toEqual({
      status: 'rejected',
      reason: 'path_limit_exceeded',
    })

    const many = Array.from({ length: PLAIN_TRANSFER_LIMITS.maxEntries + 1 }, (_, index) =>
      directory('upload', `folder-${index}`),
    )
    const manyRequest = await plainRequest('plain_workspace', sources, many)
    await expect(
      buildPlainTransferInventory({ request: manyRequest, entries: many }),
    ).resolves.toEqual({ status: 'rejected', reason: 'entry_limit_exceeded' })
  })

  it('rejects oversized entries and file ancestors before allocating an identity plan', async () => {
    const sources = [directorySource('upload', 'Campaign')]
    const oversized = file('upload', 'oversized.bin', new Uint8Array(MAX_RESOURCE_SOURCE_BYTES + 1))
    const oversizedRequest = await plainRequest('plain_workspace', sources, [oversized])

    await expect(
      buildPlainTransferInventory({ request: oversizedRequest, entries: [oversized] }),
    ).resolves.toEqual({
      status: 'rejected',
      reason: 'entry_too_large',
      sourceId: 'upload',
      sourcePath: 'oversized.bin',
    })

    const invalidHierarchy = [
      file('upload', 'parent.bin', [1]),
      markdown('upload', 'parent.bin/child.md', 'child'),
    ]
    await expect(
      buildPlainTransferInventory({
        request: await plainRequest('plain_workspace', sources, invalidHierarchy),
        entries: invalidHierarchy,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_source' })
  })

  it('produces an order-independent immutable source digest', async () => {
    const sources = [directorySource('upload', 'Campaign')]
    const left = markdown('upload', 'A.md', 'A')
    const right = file('upload', 'B.bin', [2])

    await expect(digestPlainTransferSources(sources, [left, right])).resolves.toBe(
      await digestPlainTransferSources(sources, [right, left]),
    )
  })

  it('requires exactly one source for plain workspace mode', async () => {
    const sources = [directorySource('left', 'Left'), directorySource('right', 'Right')]
    const entries = [markdown('left', 'A.md', 'A'), markdown('right', 'B.md', 'B')]

    await expect(
      buildPlainTransferInventory({
        request: await plainRequest('plain_workspace', sources, entries),
        entries,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'workspace_source_required' })
  })
})

function paths(result: Awaited<ReturnType<typeof buildPlainTransferInventory>>) {
  return result.status === 'ready'
    ? result.inventory.resources.map((resource) => resource.sourcePath)
    : result
}

async function plainRequest(
  mode: PlainTransferJobRequest['mode'],
  sources: ReadonlyArray<TransferSourceDescriptor>,
  entries: ReadonlyArray<PlainTransferSourceEntry>,
  manifestHandling: PlainTransferJobRequest['manifestHandling'] = 'reject',
): Promise<PlainTransferJobRequest> {
  const sourceDigest = await digestPlainTransferSources(sources, entries)
  const base = {
    version: TRANSFER_JOB_REQUEST_VERSION,
    jobId: generateDomainId(DOMAIN_ID_KIND.importJob),
    operationId: generateDomainId(DOMAIN_ID_KIND.operation),
    actorId: generateDomainId(DOMAIN_ID_KIND.campaignMember),
    destinationCampaignId: generateDomainId(DOMAIN_ID_KIND.campaign),
    sourceDigest,
    sources,
    manifestHandling,
  }
  return mode === 'plain_workspace'
    ? { ...base, mode, destinationParentId: null }
    : { ...base, mode, destinationParentId: null }
}

function directorySource(id: string, name: string): TransferSourceDescriptor {
  return { id, kind: 'directory', name }
}

function zipSource(id: string, name: string): TransferSourceDescriptor {
  return { id, kind: 'zip', name }
}

function directory(sourceId: string, path: string): PlainTransferSourceEntry {
  return { sourceId, path, type: 'directory' }
}

function markdown(sourceId: string, path: string, text: string): PlainTransferSourceEntry {
  return {
    sourceId,
    path,
    type: 'file',
    bytes: encoder.encode(text),
  }
}

function file(
  sourceId: string,
  path: string,
  bytes: ReadonlyArray<number> | Uint8Array,
): PlainTransferSourceEntry {
  return {
    sourceId,
    path,
    type: 'file',
    bytes: bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes),
  }
}

function reloadInventory<T>(value: T): T {
  return JSON.parse(serializeInventory(value), (_key, entry) =>
    typeof entry === 'object' &&
    entry !== null &&
    '$plainTransferBytes' in entry &&
    Array.isArray(entry.$plainTransferBytes)
      ? Uint8Array.from(entry.$plainTransferBytes)
      : entry,
  ) as T
}

function serializeInventory(value: unknown): string {
  return JSON.stringify(value, (_key, entry) =>
    Object.prototype.toString.call(entry) === '[object Uint8Array]'
      ? { $plainTransferBytes: Array.from(entry as Uint8Array) }
      : entry,
  )
}
