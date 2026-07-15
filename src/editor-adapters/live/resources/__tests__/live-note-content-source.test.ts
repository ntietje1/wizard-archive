import { describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import { initialVersion, sha256Digest } from '@wizard-archive/editor/resources/component-version'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import type {
  CommandEnvelope,
  ResourceStructureCommand,
  ResourceStructureCommandGateway,
} from '@wizard-archive/editor/resources/command-contract'
import type { OperationId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
  noteBlocksToYDoc,
} from '@wizard-archive/editor/notes/document-yjs'
import { createLiveNoteContentSource } from '../live-note-content-source'

type LiveNoteContentSource = ReturnType<typeof createLiveNoteContentSource>

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
    status: 'received' as const,
    result: {
      status: 'completed' as const,
      receipt: {
        campaignId,
        operationId,
        result: { type: 'created' as const, resourceId },
        postconditions: [],
      },
    },
  }
}

function applyOptimisticNote(
  source: LiveNoteContentSource,
  envelope: CommandEnvelope<ResourceStructureCommand>,
) {
  if (envelope.command.type !== 'create' || envelope.command.kind !== 'note') {
    throw new Error('Expected note create')
  }
  source.optimisticApplied({
    ...envelope,
    command: { ...envelope.command, kind: 'note' },
  })
}

async function versionFor(update: ArrayBuffer) {
  return initialVersion(await sha256Digest(new Uint8Array(update)))
}

function arrayBuffer(update: Uint8Array): ArrayBuffer {
  return Uint8Array.from(update).buffer
}

function backend() {
  const listeners = new Map<ResourceId, (snapshot: never) => void>()
  return {
    bind: vi.fn(),
    save: vi.fn(async ({ resourceId, update }) => ({
      status: 'completed' as const,
      resourceId,
      update,
      version: await versionFor(update),
    })),
    watch: vi.fn((resourceId: ResourceId, apply: (snapshot: never) => void) => {
      listeners.set(resourceId, apply)
      return () => listeners.delete(resourceId)
    }),
    emit(resourceId: ResourceId, snapshot: unknown) {
      listeners.get(resourceId)?.(snapshot as never)
    },
  }
}

describe('LiveNoteContentSource', () => {
  it('keeps one local document across indeterminate create retry and authoritative bind', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const delivery = completed(resourceId, operationId)
    let source: LiveNoteContentSource
    let attempt = 0
    const structure = {
      execute: vi.fn(
        (
          envelope: CommandEnvelope<ResourceStructureCommand>,
        ): ReturnType<ResourceStructureCommandGateway['execute']> => {
          applyOptimisticNote(source, envelope)
          attempt += 1
          return Promise.resolve(
            attempt === 1
              ? {
                  status: 'indeterminate' as const,
                  retryable: true as const,
                  reason: 'response_lost' as const,
                }
              : delivery,
          )
        },
      ),
    } satisfies ResourceStructureCommandGateway
    const provider = backend()
    provider.bind.mockImplementation(async ({ update }) => ({
      status: 'completed',
      resourceId,
      version: await versionFor(update),
    }))
    source = createLiveNoteContentSource(campaignId, structure, provider)
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
    Y.applyUpdate(rebound, new Uint8Array(provider.bind.mock.calls[0]![0].update))
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
    let source: LiveNoteContentSource
    const structure = {
      execute: vi.fn((envelope: CommandEnvelope<ResourceStructureCommand>) => {
        applyOptimisticNote(source, envelope)
        return Promise.resolve(
          envelope.operationId === rejectedOperation
            ? {
                status: 'received' as const,
                result: { status: 'rejected' as const, reason: 'invalid_parent' as const },
              }
            : {
                status: 'indeterminate' as const,
                retryable: true as const,
                reason: 'connection_lost' as const,
              },
        )
      }),
    } satisfies ResourceStructureCommandGateway
    const provider = backend()
    source = createLiveNoteContentSource(campaignId, structure, provider)

    await source.create(createEnvelope(retainedId, retainedOperation), new Y.Doc())
    await source.create(createEnvelope(rejectedId, rejectedOperation), new Y.Doc())

    expect(source.get(rejectedId)).toEqual({ status: 'loading' })
    expect(source.get(retainedId)).toEqual(
      expect.objectContaining({ status: 'initializing', operationId: retainedOperation }),
    )
  })

  it('shows remote initialization as loading and preserves the bound local identity', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    let source: LiveNoteContentSource
    const structure = {
      execute: vi.fn((envelope: CommandEnvelope<ResourceStructureCommand>) => {
        applyOptimisticNote(source, envelope)
        return Promise.resolve(completed(resourceId, operationId))
      }),
    } satisfies ResourceStructureCommandGateway
    const provider = backend()
    provider.bind.mockImplementation(async ({ update }) => ({
      status: 'completed',
      resourceId,
      version: await versionFor(update),
    }))
    source = createLiveNoteContentSource(campaignId, structure, provider)

    expect(source.get(resourceId)).toEqual({ status: 'loading' })
    provider.emit(resourceId, { status: 'initializing', operationId })
    expect(source.get(resourceId)).toEqual({ status: 'loading' })

    const local = new Y.Doc()
    await source.create(createEnvelope(resourceId, operationId), local)
    const ready = source.get(resourceId)
    if (ready.status !== 'ready') throw new Error('Expected ready note')
    const update = provider.bind.mock.calls[0]![0].update
    provider.emit(resourceId, { status: 'ready', update, version: ready.session.version })
    expect(source.get(resourceId)).toEqual(ready)
  })

  it('preserves a loaded document for repeated snapshots of the same version', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const provider = backend()
    const source = createLiveNoteContentSource(campaignId, { execute: vi.fn() }, provider)
    const update = arrayBuffer(Y.encodeStateAsUpdate(new Y.Doc()))
    const version = await versionFor(update)

    source.get(resourceId)
    provider.emit(resourceId, { status: 'ready', update, version })
    const first = source.get(resourceId)
    provider.emit(resourceId, { status: 'ready', update, version })

    expect(source.get(resourceId)).toEqual(first)
  })

  it('flushes document-fragment edits through the canonical save backend', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const provider = backend()
    const source = createLiveNoteContentSource(campaignId, { execute: vi.fn() }, provider)
    const initial = arrayBuffer(Y.encodeStateAsUpdate(new Y.Doc()))
    const version = await versionFor(initial)

    source.get(resourceId)
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

  it('waits for the final save before destroying a disposed document', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const provider = backend()
    let finishSave: (() => void) | undefined
    provider.save.mockImplementation(async ({ resourceId: savedResourceId, update }) => {
      await new Promise<void>((resolve) => {
        finishSave = resolve
      })
      return {
        status: 'completed',
        resourceId: savedResourceId,
        update,
        version: await versionFor(update),
      }
    })
    const source = createLiveNoteContentSource(campaignId, { execute: vi.fn() }, provider)
    const initial = arrayBuffer(Y.encodeStateAsUpdate(new Y.Doc()))
    const version = await versionFor(initial)

    source.get(resourceId)
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
