import { describe, expect, it } from 'vite-plus/test'
import * as Y from 'yjs'
import { initialVersion, sha256Digest } from '../component-version'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import { canonicalizeResourceTitle } from '../resource-record'
import type { ResourceNavigation } from '../editor-runtime-contract'
import type { ResourceCatalogSnapshot } from '../resource-catalog-contract'
import type { ResourceRecord } from '../resource-record'
import { RESOURCE_INDEX_SCHEMA } from '../resource-index-contract'
import { createInMemoryEditorRuntime } from '../in-memory-editor-runtime'
import {
  parseSerializedAuthoredDestination,
  serializeAuthoredDestination,
} from '../authored-destination'
import { parseSafeHttpsUrl } from '../authored-destination-contract'
import {
  noteBlocksToYDoc,
  noteYDocToBlocks,
  NOTE_YJS_FRAGMENT,
} from '../../notes/document/headless-yjs'

function emptySnapshot(): ResourceCatalogSnapshot {
  return {
    campaignId: generateDomainId(DOMAIN_ID_KIND.campaign),
    resources: [],
    tombstones: [],
    aliases: [],
  }
}

function navigation(): ResourceNavigation {
  return {
    current: () => null,
    open: () => undefined,
    subscribe: () => () => undefined,
  }
}

describe('createInMemoryEditorRuntime', () => {
  it('undoes and redoes resource edits while treating permanent deletion as a history barrier', async () => {
    const snapshot = emptySnapshot()
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const core = createInMemoryEditorRuntime({
      scope: {
        campaignId: snapshot.campaignId,
        actorId: generateDomainId(DOMAIN_ID_KIND.campaignMember),
        projection: 'dm',
        schema: RESOURCE_INDEX_SCHEMA,
      },
      snapshot,
      navigation: navigation(),
    })
    await core.runtime.resources.loader.ensureCollection({ parentId: null, lifecycle: 'active' })
    if (
      core.runtime.resources.structure.status !== 'available' ||
      core.runtime.resources.undo.status !== 'available'
    ) {
      throw new Error('Expected editable resource history')
    }
    const structure = core.runtime.resources.structure.value
    const history = core.runtime.resources.undo.value
    await structure.execute({
      campaignId: snapshot.campaignId,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'create',
        resourceId,
        kind: 'folder',
        parentId: null,
        title: canonicalizeResourceTitle('Original'),
        icon: null,
        color: null,
      },
    })
    await structure.execute({
      campaignId: snapshot.campaignId,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'updateMetadata',
        resourceId,
        changes: { title: canonicalizeResourceTitle('Renamed') },
      },
    })

    expect(history.getSnapshot()).toMatchObject({
      status: 'ready',
      undo: { label: 'rename' },
      redo: null,
    })
    await history.undo()
    expect(core.runtime.resources.index.getSnapshot().lookup(resourceId)).toMatchObject({
      state: 'known',
      value: { title: 'Original' },
    })
    await history.redo()
    expect(core.runtime.resources.index.getSnapshot().lookup(resourceId)).toMatchObject({
      state: 'known',
      value: { title: 'Renamed' },
    })

    await structure.execute({
      campaignId: snapshot.campaignId,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: { type: 'trash', resourceIds: [resourceId] },
    })
    await structure.execute({
      campaignId: snapshot.campaignId,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: { type: 'permanentlyDelete', resourceIds: [resourceId] },
    })
    expect(history.getSnapshot()).toEqual({ status: 'ready', undo: null, redo: null })
    core.dispose()
  })

  it('uses the canonical index, loader, and structure command contract', async () => {
    const snapshot = emptySnapshot()
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const core = createInMemoryEditorRuntime({
      scope: {
        campaignId: snapshot.campaignId,
        actorId,
        projection: 'dm',
        schema: RESOURCE_INDEX_SCHEMA,
      },
      snapshot,
      navigation: navigation(),
    })

    await core.runtime.resources.loader.ensureCollection({ parentId: null, lifecycle: 'active' })
    expect(core.runtime.resources.structure.status).toBe('available')
    if (core.runtime.resources.structure.status !== 'available') {
      throw new Error('Expected structure editing to be available')
    }
    const delivery = await core.runtime.resources.structure.value.execute({
      campaignId: snapshot.campaignId,
      operationId,
      command: {
        type: 'create',
        resourceId,
        kind: 'folder',
        parentId: null,
        title: canonicalizeResourceTitle('Duplicate-safe folder'),
        icon: null,
        color: null,
      },
    })

    expect(delivery).toEqual(
      expect.objectContaining({
        status: 'received',
        result: expect.objectContaining({ status: 'completed' }),
      }),
    )
    expect(core.runtime.resources.index.getSnapshot().lookup(resourceId)).toEqual(
      expect.objectContaining({ state: 'known' }),
    )
    core.dispose()
  })

  it('keeps final-ID local note state across same-operation retry', async () => {
    const snapshot = emptySnapshot()
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const core = createInMemoryEditorRuntime({
      scope: {
        campaignId: snapshot.campaignId,
        actorId: generateDomainId(DOMAIN_ID_KIND.campaignMember),
        projection: 'dm',
        schema: RESOURCE_INDEX_SCHEMA,
      },
      snapshot,
      navigation: navigation(),
    })
    const document = noteDocument('Local edit')
    const envelope = {
      campaignId: snapshot.campaignId,
      operationId,
      command: {
        type: 'create' as const,
        resourceId,
        kind: 'note' as const,
        parentId: null,
        title: canonicalizeResourceTitle('Note'),
        icon: null,
        color: null,
      },
    }

    await core.runtime.content.notes.create(envelope, document)
    const ready = core.runtime.content.notes.get(resourceId)
    expect(ready).toEqual(
      expect.objectContaining({
        status: 'ready',
        session: expect.objectContaining({ document }),
      }),
    )
    await core.runtime.content.notes.create(envelope, document)
    expect(core.runtime.content.notes.get(resourceId)).toEqual(ready)
    core.dispose()
  })

  it('creates map resources through the map content owner', async () => {
    const snapshot = emptySnapshot()
    const mapId = generateDomainId(DOMAIN_ID_KIND.resource)
    const core = createInMemoryEditorRuntime({
      scope: {
        campaignId: snapshot.campaignId,
        actorId: generateDomainId(DOMAIN_ID_KIND.campaignMember),
        projection: 'dm',
        schema: RESOURCE_INDEX_SCHEMA,
      },
      snapshot,
      navigation: navigation(),
    })
    await core.runtime.content.maps.create({
      campaignId: snapshot.campaignId,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'create',
        resourceId: mapId,
        kind: 'map',
        parentId: null,
        title: canonicalizeResourceTitle('Map'),
        icon: null,
        color: null,
      },
    })

    expect(core.runtime.content.maps.get(mapId)).toMatchObject({
      status: 'ready',
      session: {
        content: { image: { status: 'unattached' }, layers: [], pins: [] },
        version: { revision: 1 },
      },
    })
    core.dispose()
  })

  it('creates a valid empty canvas and publishes its readonly preview', async () => {
    const snapshot = emptySnapshot()
    const canvasId = generateDomainId(DOMAIN_ID_KIND.resource)
    const core = createInMemoryEditorRuntime({
      scope: {
        campaignId: snapshot.campaignId,
        actorId: generateDomainId(DOMAIN_ID_KIND.campaignMember),
        projection: 'dm',
        schema: RESOURCE_INDEX_SCHEMA,
      },
      snapshot,
      navigation: navigation(),
    })

    await core.runtime.content.canvases.create({
      campaignId: snapshot.campaignId,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'create',
        resourceId: canvasId,
        kind: 'canvas',
        parentId: null,
        title: canonicalizeResourceTitle('Canvas'),
        icon: null,
        color: null,
      },
    })

    expect(core.runtime.content.canvases.get(canvasId)).toMatchObject({
      status: 'ready',
      session: { version: { revision: 1 } },
    })
    expect(core.runtime.content.canvases.previews.get(canvasId)).toMatchObject({
      status: 'ready',
      version: { revision: 1 },
    })
    core.dispose()
  })

  it('uses current catalog targets and preserves opaque bytes for local map mutations', async () => {
    const empty = emptySnapshot()
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const mapId = generateDomainId(DOMAIN_ID_KIND.resource)
    const activeTargetId = generateDomainId(DOMAIN_ID_KIND.resource)
    const trashedTargetId = generateDomainId(DOMAIN_ID_KIND.resource)
    const missingTargetId = generateDomainId(DOMAIN_ID_KIND.resource)
    const version = initialVersion(await sha256Digest(new Uint8Array([1])))
    const resource = (
      id: ResourceRecord['id'],
      kind: ResourceRecord['kind'],
      lifecycle: ResourceRecord['lifecycle'],
    ): ResourceRecord => ({
      id,
      campaignId: empty.campaignId,
      parentId: null,
      kind,
      title: canonicalizeResourceTitle(kind),
      icon: null,
      color: null,
      lifecycle,
      metadataVersion: version,
      created: { at: 1, by: actorId },
      updated: { at: 1, by: actorId },
    })
    const snapshot = {
      ...empty,
      resources: [
        resource(mapId, 'map', { state: 'active' }),
        resource(activeTargetId, 'note', { state: 'active' }),
        resource(trashedTargetId, 'note', {
          state: 'trashed',
          at: 2,
          by: actorId,
        }),
      ],
    }
    const core = createInMemoryEditorRuntime({
      scope: {
        campaignId: snapshot.campaignId,
        actorId,
        projection: 'dm',
        schema: RESOURCE_INDEX_SCHEMA,
      },
      snapshot,
      content: {
        maps: [
          {
            resourceId: mapId,
            content: { image: { status: 'unattached' }, layers: [], pins: [] },
            version,
            images: [],
          },
        ],
      },
      navigation: navigation(),
    })
    await core.runtime.resources.loader.ensureCollection({ parentId: null, lifecycle: 'active' })
    const state = core.runtime.content.maps.get(mapId)
    if (state.status !== 'ready') throw new TypeError('Expected a ready map')
    const createPin = (targetId: ResourceRecord['id']) =>
      state.session.execute({
        type: 'createPins',
        pins: [
          {
            id: generateDomainId(DOMAIN_ID_KIND.mapPin),
            destination: { kind: 'internal', target: { kind: 'resource', resourceId: targetId } },
            layerId: null,
            x: 10,
            y: 20,
          },
        ],
      })

    await expect(createPin(missingTargetId)).resolves.toEqual({
      status: 'rejected',
      reason: 'target_missing',
    })
    await expect(createPin(trashedTargetId)).resolves.toEqual({
      status: 'rejected',
      reason: 'target_missing',
    })
    await expect(createPin(mapId)).resolves.toEqual({
      status: 'rejected',
      reason: 'invalid_command',
    })
    await expect(createPin(activeTargetId)).resolves.toMatchObject({ status: 'completed' })
    await expect(createPin(activeTargetId)).resolves.toEqual({
      status: 'rejected',
      reason: 'invalid_command',
    })
    if (core.runtime.resources.structure.status !== 'available') {
      throw new TypeError('Expected editable structure')
    }
    const trash = await core.runtime.resources.structure.value.execute({
      campaignId: snapshot.campaignId,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: { type: 'trash', resourceIds: [activeTargetId] },
    })
    expect(trash).toMatchObject({ status: 'received', result: { status: 'completed' } })
    await expect(createPin(activeTargetId)).resolves.toEqual({
      status: 'rejected',
      reason: 'target_missing',
    })

    const bytes = Uint8Array.from([0, 1, 2, 3])
    await expect(
      state.session.replaceImage(null, state.session.version, {
        bytes,
        fileName: 'map.png',
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      content: { image: { status: 'attached', byteSize: bytes.byteLength } },
    })
    await expect(state.session.loadImage(null)).resolves.toMatchObject({
      status: 'ready',
      bytes,
      mediaType: 'application/octet-stream',
    })
    const preview = core.runtime.content.maps.previews.get(mapId)
    if (preview.status !== 'ready') throw new TypeError('Expected a ready map preview')
    expect('execute' in preview.preview).toBe(false)
    await expect(preview.preview.loadImage(null)).resolves.toMatchObject({
      status: 'ready',
      bytes,
      mediaType: 'application/octet-stream',
    })
    core.dispose()
  })

  it('creates signature-classified files through the canonical local content owner', async () => {
    const snapshot = emptySnapshot()
    const core = createInMemoryEditorRuntime({
      scope: {
        campaignId: snapshot.campaignId,
        actorId: generateDomainId(DOMAIN_ID_KIND.campaignMember),
        projection: 'dm',
        schema: RESOURCE_INDEX_SCHEMA,
      },
      snapshot,
      navigation: navigation(),
    })
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const jobId = generateDomainId(DOMAIN_ID_KIND.importJob)
    if (core.runtime.transfers.status !== 'available') throw new Error('Expected transfers')
    const delivery = await core.runtime.transfers.value.execute(
      {
        campaignId: snapshot.campaignId,
        jobId,
        destinationParentId: null,
        textFileHandling: 'notes',
      },
      [{ id: 'selected-file', kind: 'file', name: 'image.png' }],
      [{ sourceId: 'selected-file', path: 'image.png', type: 'file', bytes }],
    )

    expect(delivery).toMatchObject({ status: 'settled' })
    if (delivery.status !== 'settled' || delivery.entries[0]?.status !== 'completed') {
      throw new TypeError('Expected completed file transfer')
    }
    const resourceId = delivery.entries[0].resourceId
    expect(core.runtime.content.files.get(resourceId)).toMatchObject({
      status: 'ready',
      content: {
        attachment: 'attached',
        byteSize: bytes.byteLength,
        extension: 'png',
        classification: 'viewable_image',
        detectedFormat: 'png',
        mediaType: 'image/png',
        viewerUnavailableReason: null,
      },
      version: { revision: 1 },
    })
    const exported = await core.runtime.content.files.export(resourceId)
    expect(exported).toMatchObject({
      status: 'ready',
      extension: 'png',
      mediaType: 'image/png',
    })
    expect(exported.status === 'ready' ? Array.from(exported.bytes) : null).toEqual(
      Array.from(bytes),
    )
    const created = core.runtime.content.files.get(resourceId)
    if (created.status !== 'ready') throw new TypeError('Expected ready file content')
    const replacementBytes = new TextEncoder().encode('replacement text')
    await expect(
      core.runtime.content.files.replace(resourceId, created.version, {
        bytes: replacementBytes,
        fileName: 'replacement.txt',
      }),
    ).resolves.toMatchObject({ status: 'completed', version: { revision: 2 } })
    await expect(
      core.runtime.content.files.replace(resourceId, created.version, {
        bytes: replacementBytes,
        fileName: 'replacement.txt',
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'version_conflict' })
    const replacementExport = await core.runtime.content.files.export(resourceId)
    expect(
      replacementExport.status === 'ready' ? Array.from(replacementExport.bytes) : null,
    ).toEqual(Array.from(replacementBytes))
    expect(core.runtime.resources.index.getSnapshot().lookup(resourceId).state).toBe('known')
    core.dispose()
  })

  it('exposes ready content without mixing it into the metadata index', async () => {
    const snapshot = emptySnapshot()
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const document = new Y.Doc()
    const version = initialVersion(await sha256Digest(new Uint8Array([1])))
    const core = createInMemoryEditorRuntime({
      scope: {
        campaignId: snapshot.campaignId,
        actorId: generateDomainId(DOMAIN_ID_KIND.campaignMember),
        projection: 'dm',
        schema: RESOURCE_INDEX_SCHEMA,
      },
      snapshot,
      content: { notes: [{ resourceId, content: document, version }] },
      navigation: navigation(),
    })

    expect(core.runtime.resources.index.getSnapshot().lookup(resourceId)).toEqual({
      state: 'unknown',
    })
    expect(core.runtime.content.notes.get(resourceId)).toMatchObject({
      status: 'ready',
      session: { document, version, awareness: { status: 'unavailable' } },
    })
    core.dispose()
  })

  it('deep copies local content and remaps copied resource references', async () => {
    const snapshot = emptySnapshot()
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const noteId = generateDomainId(DOMAIN_ID_KIND.resource)
    const mapId = generateDomainId(DOMAIN_ID_KIND.resource)
    const pinId = generateDomainId(DOMAIN_ID_KIND.mapPin)
    const version = initialVersion(await sha256Digest(new Uint8Array([2])))
    const mapBytes = new Uint8Array([1, 3, 5, 7])
    const mapImage = {
      status: 'attached' as const,
      byteSize: mapBytes.byteLength,
      digest: await sha256Digest(mapBytes),
      mediaType: 'image/png',
    }
    const noteBlockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const note = noteBlocksToYDoc(
      [
        {
          id: noteBlockId,
          type: 'paragraph',
          content: [{ type: 'text', text: 'Copied note' }],
        },
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'embed',
          props: {
            destination: serializeAuthoredDestination({
              kind: 'internal',
              target: { kind: 'resource', resourceId: mapId },
            }),
          },
        },
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'embed',
          props: {
            destination: serializeAuthoredDestination({
              kind: 'externalUrl',
              url: parseSafeHttpsUrl('https://example.com/reference')!,
            }),
          },
        },
      ],
      NOTE_YJS_FRAGMENT,
    )
    const resources: Array<ResourceRecord> = [
      resource(noteId, 'note', 'Note'),
      resource(mapId, 'map', 'Map'),
    ]
    const core = createInMemoryEditorRuntime({
      scope: {
        campaignId: snapshot.campaignId,
        actorId,
        projection: 'dm',
        schema: RESOURCE_INDEX_SCHEMA,
      },
      snapshot: { ...snapshot, resources },
      content: {
        notes: [{ resourceId: noteId, content: note, version }],
        maps: [
          {
            resourceId: mapId,
            images: [{ layerId: null, bytes: mapBytes }],
            version,
            content: {
              image: mapImage,
              layers: [],
              pins: [
                {
                  id: pinId,
                  destination: {
                    kind: 'internal',
                    target: { kind: 'resource', resourceId: noteId },
                  },
                  layerId: null,
                  x: 1,
                  y: 2,
                  visible: true,
                },
              ],
            },
          },
        ],
      },
      navigation: navigation(),
    })
    if (core.runtime.resources.structure.status !== 'available') {
      throw new Error('Expected structure editing to be available')
    }

    const delivery = await core.runtime.resources.structure.value.execute({
      campaignId: snapshot.campaignId,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: { type: 'deepCopy', sourceRootIds: [noteId, mapId], destinationParentId: null },
    })
    expect(delivery).toMatchObject({
      status: 'received',
      result: { status: 'completed', receipt: { result: { type: 'deepCopied' } } },
    })
    if (
      delivery.status !== 'received' ||
      delivery.result.status !== 'completed' ||
      delivery.result.receipt.result.type !== 'deepCopied'
    ) {
      throw new Error('Expected deep copy completion')
    }
    const copiedIds = new Map(
      delivery.result.receipt.result.roots.map((root) => [
        root.sourceRootId,
        root.destinationRootId,
      ]),
    )
    const copiedNoteId = copiedIds.get(noteId)!
    const copiedMapId = copiedIds.get(mapId)!
    const copiedNote = core.runtime.content.notes.get(copiedNoteId)
    const copiedMap = core.runtime.content.maps.get(copiedMapId)

    expect(copiedNote).toMatchObject({ status: 'ready' })
    if (copiedNote.status !== 'ready') throw new Error('Expected copied note content')
    expect(copiedNote.session.document).not.toBe(note)
    expect(noteText(copiedNote.session.document)).toContain('Copied note')
    const copiedNoteBlocks = noteYDocToBlocks(copiedNote.session.document, NOTE_YJS_FRAGMENT)
    expect(copiedNoteBlocks[0]!.id).not.toBe(noteBlockId)
    const copiedEmbeds = copiedNoteBlocks.filter((block) => block.type === 'embed')
    expect(parseSerializedAuthoredDestination(copiedEmbeds[0]!.props.destination)).toEqual({
      kind: 'internal',
      target: { kind: 'resource', resourceId: copiedMapId },
    })
    expect(parseSerializedAuthoredDestination(copiedEmbeds[1]!.props.destination)).toEqual({
      kind: 'externalUrl',
      url: 'https://example.com/reference',
    })
    expect(copiedMap).toMatchObject({
      status: 'ready',
      session: {
        content: {
          pins: [
            {
              destination: {
                kind: 'internal',
                target: { kind: 'resource', resourceId: copiedNoteId },
              },
            },
          ],
        },
      },
    })
    if (copiedMap.status !== 'ready') throw new Error('Expected copied map content')
    expect(copiedMap.session.content.pins[0]!.id).not.toBe(pinId)
    const copiedMapImage = await copiedMap.session.loadImage(null)
    expect(copiedMapImage).toMatchObject({ status: 'ready', mediaType: 'image/png' })
    expect(copiedMapImage.status === 'ready' ? Array.from(copiedMapImage.bytes) : null).toEqual(
      Array.from(mapBytes),
    )
    core.dispose()

    function resource(
      id: ResourceRecord['id'],
      kind: ResourceRecord['kind'],
      title: string,
    ): ResourceRecord {
      return {
        id,
        campaignId: snapshot.campaignId,
        parentId: null,
        kind,
        title: canonicalizeResourceTitle(title),
        icon: null,
        color: null,
        lifecycle: { state: 'active' },
        metadataVersion: version,
        created: { at: 1, by: actorId },
        updated: { at: 1, by: actorId },
      }
    }
  })
})

function noteDocument(text: string) {
  return noteBlocksToYDoc(
    [
      {
        id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
    NOTE_YJS_FRAGMENT,
  )
}

function noteText(document: Y.Doc) {
  return noteYDocToBlocks(document, NOTE_YJS_FRAGMENT).flatMap((block) =>
    Array.isArray(block.content)
      ? block.content.flatMap((inline) => (inline.type === 'text' ? [inline.text] : []))
      : [],
  )
}
