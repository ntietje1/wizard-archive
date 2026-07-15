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
    assetsFolderId: null,
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
      undo: { label: 'Edit Original' },
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

  it('initializes domain-owned content for local structure creates', async () => {
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
    if (core.runtime.resources.structure.status !== 'available') {
      throw new Error('Expected structure editing to be available')
    }

    await core.runtime.resources.structure.value.execute({
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
        content: { imageAssetId: null, layers: [], pins: [] },
        version: { revision: 1 },
      },
    })
    core.dispose()
  })

  it('creates uploaded files through the file content owner and canonical structure command', async () => {
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
    const bytes = new TextEncoder().encode('plain text')
    const delivery = await core.runtime.content.files.create(
      {
        campaignId: snapshot.campaignId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command: {
          type: 'create',
          resourceId,
          kind: 'file',
          parentId: null,
          title: canonicalizeResourceTitle('notes.txt'),
          icon: null,
          color: null,
        },
      },
      { bytes, fileName: 'notes.txt' },
    )

    expect(delivery).toMatchObject({ status: 'received', result: { status: 'completed' } })
    expect(core.runtime.content.files.get(resourceId)).toMatchObject({
      status: 'ready',
      content: {
        assetId: null,
        byteSize: bytes.byteLength,
        extension: 'txt',
        classification: 'inert_file',
        viewerUnavailableReason: 'unsupported_format',
      },
      version: { revision: 1 },
    })
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
            version,
            content: {
              imageAssetId: null,
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
