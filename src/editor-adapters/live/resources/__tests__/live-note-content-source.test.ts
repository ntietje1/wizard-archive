import { describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
} from '@wizard-archive/editor/resources/domain-id'
import { initialVersion, sha256Digest } from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import { advanceNoteContentVersion } from '@wizard-archive/editor/resources/content-version'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import type { OperationId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
  noteBlocksToYDoc,
} from '@wizard-archive/editor/notes/document-yjs'
import { createLiveNoteContentSource } from '../live-note-content-source'

type LiveNoteContentBackend = Parameters<typeof createLiveNoteContentSource>[1]

const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)

function createEnvelope(resourceId: ResourceId, operationId: OperationId) {
  return {
    campaignId,
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
}

function completed(resourceId: ResourceId, operationId: OperationId) {
  return {
    status: 'completed' as const,
    receipt: {
      campaignId,
      operationId,
      result: { type: 'created' as const, resourceId },
      postconditions: [],
    },
  }
}

function historyRecording() {
  return { abandon: vi.fn(), completed: vi.fn() }
}

async function versionFor(update: ArrayBuffer) {
  return initialVersion(await sha256Digest(new Uint8Array(update)))
}

function arrayBuffer(update: Uint8Array): ArrayBuffer {
  return Uint8Array.from(update).buffer
}

function backend() {
  const listeners = new Map<ResourceId, (snapshot: never) => void>()
  const updates = new Map<ResourceId, Array<Uint8Array>>()
  const versions = new Map<ResourceId, VersionStamp>()
  const save: LiveNoteContentBackend['save'] = async ({ resourceId, update }) => {
    const id = assertDomainId(DOMAIN_ID_KIND.resource, resourceId)
    const merged = Y.mergeUpdates([...(updates.get(id) ?? []), new Uint8Array(update)])
    const canonicalUpdate = arrayBuffer(merged)
    const currentVersion = versions.get(id) ?? (await versionFor(canonicalUpdate))
    const version = await advanceNoteContentVersion(currentVersion, merged)
    updates.set(id, [merged])
    versions.set(id, version)
    return { status: 'completed', resourceId: id, update: canonicalUpdate, version }
  }
  const create: LiveNoteContentBackend['create'] = ({ operationId, command }) => {
    if (command.type !== 'create') throw new Error('Expected create command')
    return Promise.resolve(
      completed(
        assertDomainId(DOMAIN_ID_KIND.resource, command.resourceId),
        assertDomainId(DOMAIN_ID_KIND.operation, operationId),
      ),
    )
  }
  return {
    create: vi.fn(create),
    refresh: vi.fn(() => Promise.resolve()),
    save: vi.fn(save),
    watch: vi.fn((resourceId: ResourceId, apply: (snapshot: never) => void) => {
      listeners.set(resourceId, apply)
      return () => listeners.delete(resourceId)
    }),
    emit(resourceId: ResourceId, snapshot: unknown) {
      const candidate = snapshot as {
        status?: string
        update?: ArrayBuffer
        version?: VersionStamp
      }
      if (candidate.status === 'ready' && candidate.update && candidate.version) {
        updates.set(resourceId, [new Uint8Array(candidate.update)])
        versions.set(resourceId, candidate.version)
      }
      listeners.get(resourceId)?.(snapshot as never)
    },
  }
}

describe('LiveNoteContentSource', () => {
  it('keeps one local document across an indeterminate atomic create retry', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    let attempt = 0
    const provider = backend()
    provider.create.mockImplementation(() => {
      attempt += 1
      return attempt === 1
        ? Promise.reject(new Error('response lost'))
        : Promise.resolve(completed(resourceId, operationId))
    })
    const recording = historyRecording()
    const source = createLiveNoteContentSource(campaignId, provider, () => recording)
    const local = noteBlocksToYDoc(
      [
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'paragraph',
          content: [{ type: 'text', text: 'before retry' }],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )

    await source.create(createEnvelope(resourceId, operationId), local)
    expect(source.get(resourceId)).toEqual({ status: 'initializing', operationId, local })
    const text = noteTextType(local)
    text.insert(text.length, ' and after')

    await source.create(createEnvelope(resourceId, operationId), local)
    expect(source.get(resourceId)).toEqual(
      expect.objectContaining({
        status: 'ready',
        session: expect.objectContaining({ document: local }),
      }),
    )
    const rebound = new Y.Doc()
    Y.applyUpdate(rebound, new Uint8Array(provider.create.mock.calls[1]![0].update))
    expect(
      decodeNoteYjsUpdatesToBlocks(
        [{ update: Y.encodeStateAsUpdate(rebound) }],
        NOTE_YJS_FRAGMENT,
      ).flatMap((block) =>
        Array.isArray(block.content)
          ? block.content.flatMap((inline) => (inline.type === 'text' ? [inline.text] : []))
          : [],
      ),
    ).toContain('before retry and after')
    rebound.destroy()
  })

  it('removes only the rejected create local state', async () => {
    const rejectedId = generateDomainId(DOMAIN_ID_KIND.resource)
    const retainedId = generateDomainId(DOMAIN_ID_KIND.resource)
    const rejectedOperation = generateDomainId(DOMAIN_ID_KIND.operation)
    const retainedOperation = generateDomainId(DOMAIN_ID_KIND.operation)
    const provider = backend()
    provider.create.mockImplementation(({ operationId }) => {
      if (operationId === rejectedOperation) {
        return Promise.resolve({ status: 'rejected' as const, reason: 'invalid_parent' as const })
      }
      return Promise.reject(new Error('connection lost'))
    })
    const source = createLiveNoteContentSource(campaignId, provider, historyRecording)

    await source.create(createEnvelope(retainedId, retainedOperation), new Y.Doc())
    await source.create(createEnvelope(rejectedId, rejectedOperation), new Y.Doc())

    expect(source.get(rejectedId)).toEqual({ status: 'loading' })
    expect(source.get(retainedId)).toEqual(
      expect.objectContaining({ status: 'initializing', operationId: retainedOperation }),
    )
  })

  it('preserves the local identity when its authoritative snapshot arrives', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const provider = backend()
    const source = createLiveNoteContentSource(campaignId, provider, historyRecording)

    expect(source.get(resourceId)).toEqual({ status: 'loading' })

    const local = new Y.Doc()
    await source.create(createEnvelope(resourceId, operationId), local)
    const ready = source.get(resourceId)
    if (ready.status !== 'ready') throw new Error('Expected ready note')
    const update = provider.create.mock.calls[0]![0].update
    provider.emit(resourceId, { status: 'ready', update, version: ready.session.version })
    expect(source.get(resourceId)).toEqual(ready)
  })

  it('preserves a loaded document for repeated snapshots of the same version', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const provider = backend()
    const source = createLiveNoteContentSource(campaignId, provider, historyRecording)
    const update = arrayBuffer(Y.encodeStateAsUpdate(new Y.Doc()))
    const version = await versionFor(update)

    source.subscribe(resourceId, () => {})
    provider.emit(resourceId, { status: 'ready', update, version })
    const first = source.get(resourceId)
    provider.emit(resourceId, { status: 'ready', update, version })

    expect(source.get(resourceId)).toEqual(first)
  })

  it('flushes document-fragment edits through the canonical save backend', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const provider = backend()
    const source = createLiveNoteContentSource(campaignId, provider, historyRecording)
    const initial = arrayBuffer(Y.encodeStateAsUpdate(new Y.Doc()))
    const version = await versionFor(initial)

    source.subscribe(resourceId, () => {})
    provider.emit(resourceId, { status: 'ready', update: initial, version })
    const ready = source.get(resourceId)
    if (ready.status !== 'ready') throw new Error('Expected ready note')
    const edit = noteBlocksToYDoc(
      [
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'paragraph',
          content: [{ type: 'text', text: 'Persisted edit' }],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )
    Y.applyUpdate(ready.session.document, Y.encodeStateAsUpdate(edit))
    edit.destroy()

    await expect(ready.session.flush()).resolves.toMatchObject({ status: 'completed' })
    expect(provider.save).toHaveBeenCalledOnce()
    expect(
      decodeNoteYjsUpdatesToBlocks(
        [{ update: provider.save.mock.calls[0]![0].update }],
        NOTE_YJS_FRAGMENT,
      ),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'paragraph' })]))
  })

  it('keeps draining edits that arrive during an in-flight save before disposal', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const provider = backend()
    const persist = provider.save.getMockImplementation()!
    let releaseFirstSave: (() => void) | undefined
    let saveAttempt = 0
    provider.save.mockImplementation(async (args) => {
      saveAttempt += 1
      if (saveAttempt === 1) {
        await new Promise<void>((resolve) => {
          releaseFirstSave = resolve
        })
      }
      return await persist(args)
    })
    const source = createLiveNoteContentSource(campaignId, provider, historyRecording)
    const initial = arrayBuffer(Y.encodeStateAsUpdate(new Y.Doc()))
    const version = await versionFor(initial)
    source.subscribe(resourceId, () => {})
    provider.emit(resourceId, { status: 'ready', update: initial, version })
    const ready = source.get(resourceId)
    if (ready.status !== 'ready') throw new Error('Expected ready note')
    let destroyed = false
    ready.session.document.on('destroy', () => {
      destroyed = true
    })

    ready.session.document.getMap('drain').set('first', true)
    const drain = ready.session.flush()
    await vi.waitFor(() => expect(provider.save).toHaveBeenCalledOnce())
    ready.session.document.getMap('drain').set('second', true)
    source.dispose()

    expect(destroyed).toBe(false)
    releaseFirstSave?.()
    await expect(drain).resolves.toMatchObject({ status: 'completed' })
    await vi.waitFor(() => expect(provider.save).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(destroyed).toBe(true))
    const persisted = new Y.Doc()
    Y.applyUpdate(persisted, new Uint8Array(initial))
    for (const [args] of provider.save.mock.calls) {
      Y.applyUpdate(persisted, new Uint8Array(args.update))
    }
    expect(persisted.getMap('drain').toJSON()).toEqual({ first: true, second: true })
    persisted.destroy()
  })

  it('stops after a terminal rejection and publishes the truthful session state', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const provider = backend()
    provider.save.mockResolvedValue({ status: 'rejected', reason: 'content_corrupt' })
    const source = createLiveNoteContentSource(campaignId, provider, historyRecording)
    const initial = arrayBuffer(Y.encodeStateAsUpdate(new Y.Doc()))
    const version = await versionFor(initial)
    source.subscribe(resourceId, () => {})
    provider.emit(resourceId, { status: 'ready', update: initial, version })
    const ready = source.get(resourceId)
    if (ready.status !== 'ready') throw new Error('Expected ready note')

    ready.session.document.getMap('terminal').set('value', true)
    await expect(ready.session.flush()).resolves.toEqual({
      status: 'rejected',
      reason: 'content_corrupt',
    })

    expect(provider.save).toHaveBeenCalledOnce()
    expect(source.get(resourceId)).toEqual({
      status: 'integrity_error',
      issue: 'content_corrupt',
    })
  })

  it('backs off after a transient failure and recovers within the same drain', async () => {
    vi.useFakeTimers()
    try {
      const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
      const provider = backend()
      const persist = provider.save.getMockImplementation()!
      provider.save.mockRejectedValueOnce(new Error('offline')).mockImplementation(persist)
      const source = createLiveNoteContentSource(campaignId, provider, historyRecording)
      const initial = arrayBuffer(Y.encodeStateAsUpdate(new Y.Doc()))
      const version = await versionFor(initial)
      source.subscribe(resourceId, () => {})
      provider.emit(resourceId, { status: 'ready', update: initial, version })
      const ready = source.get(resourceId)
      if (ready.status !== 'ready') throw new Error('Expected ready note')

      ready.session.document.getMap('retry').set('value', true)
      const drain = ready.session.flush()
      await vi.advanceTimersByTimeAsync(0)
      expect(provider.save).toHaveBeenCalledOnce()
      await vi.advanceTimersByTimeAsync(250)

      await expect(drain).resolves.toMatchObject({ status: 'completed' })
      expect(provider.save).toHaveBeenCalledTimes(2)
      source.dispose()
      await vi.runAllTimersAsync()
    } finally {
      vi.useRealTimers()
    }
  })

  it('merges rapid updates into one incremental save for a large document', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const provider = backend()
    const source = createLiveNoteContentSource(campaignId, provider, historyRecording)
    const blocks = Array.from({ length: 200 }, (_, index) => ({
      id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
      type: 'paragraph' as const,
      content: [{ type: 'text' as const, text: `Paragraph ${index} ${'x'.repeat(100)}` }],
    }))
    const initialDocument = noteBlocksToYDoc(blocks, NOTE_YJS_FRAGMENT)
    const initial = arrayBuffer(Y.encodeStateAsUpdate(initialDocument))
    const version = await versionFor(initial)
    source.subscribe(resourceId, () => {})
    provider.emit(resourceId, { status: 'ready', update: initial, version })
    const ready = source.get(resourceId)
    if (ready.status !== 'ready') throw new Error('Expected ready note')
    const text = noteTextType(ready.session.document)
    for (const character of ' rapid convergence') text.insert(text.length, character)

    await expect(ready.session.flush()).resolves.toMatchObject({ status: 'completed' })

    expect(provider.save).toHaveBeenCalledOnce()
    const delta = provider.save.mock.calls[0]![0].update
    expect(delta.byteLength).toBeLessThan(Y.encodeStateAsUpdate(ready.session.document).byteLength)
    const persisted = new Y.Doc()
    Y.applyUpdate(persisted, new Uint8Array(initial))
    Y.applyUpdate(persisted, new Uint8Array(delta))
    expect(noteTextType(persisted).toString()).toContain('rapid convergence')
    persisted.destroy()
    initialDocument.destroy()
    source.dispose()
  })

  it('does not regress a newer subscribed version when an older save response arrives', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const provider = backend()
    const persist = provider.save.getMockImplementation()!
    let releaseSave: (() => void) | undefined
    provider.save.mockImplementationOnce(async (args) => {
      const result = await persist(args)
      await new Promise<void>((resolve) => {
        releaseSave = resolve
      })
      return result
    })
    const source = createLiveNoteContentSource(campaignId, provider, historyRecording)
    const initial = arrayBuffer(Y.encodeStateAsUpdate(new Y.Doc()))
    const version = await versionFor(initial)
    source.subscribe(resourceId, () => {})
    provider.emit(resourceId, { status: 'ready', update: initial, version })
    const ready = source.get(resourceId)
    if (ready.status !== 'ready') throw new Error('Expected ready note')
    ready.session.document.getMap('version').set('local', true)
    const drain = ready.session.flush()
    await vi.waitFor(() => expect(provider.save).toHaveBeenCalledOnce())
    const subscribedDocument = new Y.Doc()
    Y.applyUpdate(subscribedDocument, new Uint8Array(initial))
    subscribedDocument.getMap('version').set('remote', true)
    const subscribedUpdate = arrayBuffer(Y.encodeStateAsUpdate(subscribedDocument))
    const subscribedVersion = await advanceNoteContentVersion(
      await advanceNoteContentVersion(version, new Uint8Array(subscribedUpdate)),
      new Uint8Array([1]),
    )
    provider.emit(resourceId, {
      status: 'ready',
      update: subscribedUpdate,
      version: subscribedVersion,
    })
    releaseSave?.()

    await expect(drain).resolves.toEqual({ status: 'completed', version: subscribedVersion })
    expect(ready.session.version).toEqual(subscribedVersion)
    subscribedDocument.destroy()
    source.dispose()
  })

  it('waits for the final save before destroying a disposed document', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const provider = backend()
    const persist = provider.save.getMockImplementation()!
    let finishSave: (() => void) | undefined
    provider.save.mockImplementation(async (args) => {
      await new Promise<void>((resolve) => {
        finishSave = resolve
      })
      return await persist(args)
    })
    const source = createLiveNoteContentSource(campaignId, provider, historyRecording)
    const initial = arrayBuffer(Y.encodeStateAsUpdate(new Y.Doc()))
    const version = await versionFor(initial)

    source.subscribe(resourceId, () => {})
    provider.emit(resourceId, { status: 'ready', update: initial, version })
    const ready = source.get(resourceId)
    if (ready.status !== 'ready') throw new Error('Expected ready note')
    let destroyed = false
    ready.session.document.on('destroy', () => {
      destroyed = true
    })
    ready.session.document.getMap('pending-edit').set('value', true)

    source.dispose()

    expect(provider.save).toHaveBeenCalledOnce()
    expect(destroyed).toBe(false)
    finishSave?.()
    await vi.waitFor(() => expect(destroyed).toBe(true))
  })
})

function noteTextType(document: Y.Doc): Y.XmlText {
  const group = document.getXmlFragment(NOTE_YJS_FRAGMENT).get(0)
  const container = group instanceof Y.XmlElement ? group.get(0) : null
  const paragraph = container instanceof Y.XmlElement ? container.get(0) : null
  const text = paragraph instanceof Y.XmlElement ? paragraph.get(0) : null
  if (!(text instanceof Y.XmlText)) throw new Error('Expected canonical note text')
  return text
}
