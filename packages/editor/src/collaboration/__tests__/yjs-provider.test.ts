import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vite-plus/test'
import { act, renderHook } from '@testing-library/react'
import * as Y from 'yjs'
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import { YjsProvider } from '../yjs-provider-runtime'
import { createYjsProviderUser } from '../yjs-provider'
import { useYjsCollaborationSession } from '../yjs-session'
import type { YjsCollaborationProvider } from '../yjs-provider'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { AWARENESS_HEARTBEAT_MS } from '../../../../../shared/yjs-sync/awareness'

const DOCUMENT_ID = 'test-doc-id' as SidebarItemId
type YjsProviderConfig = ConstructorParameters<typeof YjsProvider>[2]
type YjsCollaborationSessionInput = Parameters<typeof useYjsCollaborationSession>[0]
type YjsAwarenessData = NonNullable<
  ReturnType<YjsCollaborationSessionInput['useAwareness']>['data']
>
type YjsUpdatesData = NonNullable<ReturnType<YjsCollaborationSessionInput['useUpdates']>['data']>

function toArrayBuffer(encoded: Uint8Array): ArrayBuffer {
  return encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength,
  ) as ArrayBuffer
}

function createMockTransport() {
  return {
    pushUpdate: vi.fn().mockResolvedValue({ status: 'accepted', seq: 0 }),
    pushAwareness: vi.fn().mockResolvedValue({ status: 'active', expiresAt: Date.now() + 30_000 }),
    removeAwareness: vi.fn().mockResolvedValue({ status: 'released' }),
    reportError: vi.fn(),
  }
}

function createRemoteUpdate(seq = 0): { revision: number; update: ArrayBuffer; seq: number } {
  const remoteDoc = new Y.Doc()
  const frag = remoteDoc.getXmlFragment('document')
  frag.insert(0, [new Y.XmlElement('paragraph')])
  const encoded = Y.encodeStateAsUpdate(remoteDoc)
  remoteDoc.destroy()
  return {
    revision: 0,
    update: toArrayBuffer(encoded),
    seq,
  }
}

function createDistinctRemoteUpdate(
  seq: number,
  existingDoc?: Y.Doc,
): { revision: number; update: ArrayBuffer; seq: number } {
  const remoteDoc = new Y.Doc()
  if (existingDoc) {
    Y.applyUpdate(remoteDoc, Y.encodeStateAsUpdate(existingDoc))
  }
  const frag = remoteDoc.getXmlFragment('document')
  frag.insert(frag.length, [new Y.XmlElement('paragraph')])
  const encoded = existingDoc
    ? Y.encodeStateAsUpdate(remoteDoc, Y.encodeStateVector(existingDoc))
    : Y.encodeStateAsUpdate(remoteDoc)
  remoteDoc.destroy()
  return {
    revision: 0,
    update: toArrayBuffer(encoded),
    seq,
  }
}

function encodeAwareness(awareness: Awareness, doc: Y.Doc): ArrayBuffer {
  const encoded = encodeAwarenessUpdate(awareness, [doc.clientID])
  return toArrayBuffer(encoded)
}

function createConfig(overrides?: Partial<YjsProviderConfig>): YjsProviderConfig {
  return {
    ...createMockTransport(),
    requestReset: vi.fn(),
    ...overrides,
  }
}

function expectHexColor(value: string) {
  expect(value).toMatch(/^#[0-9a-f]{6}$/i)
}

function createSessionTransport(
  overrides?: Partial<YjsCollaborationSessionInput['transport']>,
): YjsCollaborationSessionInput['transport'] {
  return {
    ...createMockTransport(),
    ...overrides,
  }
}

function createSourceHooks({
  awareness = [],
  updates = [],
}: {
  awareness?: YjsAwarenessData
  updates?: YjsUpdatesData
} = {}) {
  return {
    useAwareness: vi.fn(() => ({ data: awareness })),
    useUpdates: vi.fn(() => ({ data: updates })),
  }
}

function readAwarenessState(state: ArrayBuffer, clientId: number) {
  const remoteDoc = new Y.Doc()
  const remoteAwareness = new Awareness(remoteDoc)
  applyAwarenessUpdate(remoteAwareness, new Uint8Array(state), 'test')
  const decoded = remoteAwareness.getStates().get(clientId)
  remoteAwareness.destroy()
  remoteDoc.destroy()
  return decoded
}

describe('YjsProvider', () => {
  let doc: Y.Doc
  let config: YjsProviderConfig
  let provider: YjsProvider

  beforeEach(() => {
    vi.useFakeTimers()
    doc = new Y.Doc()
    config = createConfig()
    provider = new YjsProvider(doc, DOCUMENT_ID, config)
  })

  afterEach(() => {
    provider.destroy()
    doc.destroy()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  describe('construction & lifecycle', () => {
    it('creates stable collaboration users from source identity', () => {
      const user = createYjsProviderUser({ userId: 'player-1', name: 'Mara' })
      const repeated = createYjsProviderUser({ userId: 'player-1', name: 'Mara' })
      const anonymous = createYjsProviderUser({ userId: undefined, name: '' })

      expect(user.name).toBe('Mara')
      expect(user.color).toBe(repeated.color)
      expectHexColor(user.color)
      expect(anonymous.name).toBe('Anonymous')
      expectHexColor(anonymous.color)
    })

    it('creates awareness from doc', () => {
      expect(provider.awareness).toBeInstanceOf(Awareness)
    })

    it('destroy calls removeAwareness with correct args', async () => {
      provider.destroy()
      await vi.advanceTimersByTimeAsync(0)
      expect(config.removeAwareness).toHaveBeenCalledWith({
        documentId: DOCUMENT_ID,
        clientId: doc.clientID,
        sessionId: expect.any(String),
      })
    })

    it('destroy is idempotent', async () => {
      provider.destroy()
      provider.destroy()
      await vi.advanceTimersByTimeAsync(0)
      expect(config.removeAwareness).toHaveBeenCalledTimes(1)
    })

    it('ignores applyRemoteUpdates after destroy', () => {
      const fragBefore = Y.encodeStateAsUpdate(doc)
      provider.destroy()
      const update = createRemoteUpdate()
      provider.applyRemoteUpdates([update])
      const fragAfter = Y.encodeStateAsUpdate(doc)
      expect(fragAfter).toEqual(fragBefore)
    })

    it('returns a non-loading empty session when source identity is absent', async () => {
      const transport = createSessionTransport()
      const sourceHooks = createSourceHooks()

      const { result } = renderHook(() =>
        useYjsCollaborationSession({
          canEdit: true,
          documentId: DOCUMENT_ID,
          sourceId: null,
          transport,
          user: { name: 'Mara', color: '#123456' },
          ...sourceHooks,
        }),
      )

      await act(async () => {})
      expect(result.current.doc).toBeNull()
      expect(result.current.provider).toBeNull()
      expect(result.current.instanceId).toBe(0)
      expect(result.current.isLoading).toBe(false)
    })

    it('does not expose a provider from another source for the same document', async () => {
      const transport = createSessionTransport()
      const sourceHooks = createSourceHooks()
      const observedProviders: Array<{
        provider: YjsCollaborationProvider | null
        sourceId: string
      }> = []

      const { result, rerender } = renderHook(
        ({ sourceId }: { sourceId: string }) => {
          const session = useYjsCollaborationSession({
            canEdit: true,
            documentId: DOCUMENT_ID,
            sourceId,
            transport,
            user: { name: 'Mara', color: '#123456' },
            ...sourceHooks,
          })
          observedProviders.push({ provider: session.provider, sourceId })
          return session
        },
        { initialProps: { sourceId: 'campaign-1' } },
      )

      await act(async () => {})
      expect(result.current.provider).toBeInstanceOf(YjsProvider)
      const firstProvider = result.current.provider

      rerender({ sourceId: 'campaign-2' })
      await act(async () => {})
      expect(result.current.provider).toBeInstanceOf(YjsProvider)

      expect(
        observedProviders
          .filter((entry) => entry.sourceId === 'campaign-2')
          .map((entry) => entry.provider),
      ).not.toContain(firstProvider)
    })
  })

  describe('remote update application', () => {
    it('applies updates with seq greater than lastAppliedSeq', () => {
      const update = createRemoteUpdate(0)
      provider.applyRemoteUpdates([update])
      const frag = doc.getXmlFragment('document')
      expect(frag.length).toBe(1)
    })

    it('skips already-applied seqs', () => {
      const update1 = createDistinctRemoteUpdate(0)
      provider.applyRemoteUpdates([update1])

      const update2 = createDistinctRemoteUpdate(0, doc)
      provider.applyRemoteUpdates([update2])

      const frag = doc.getXmlFragment('document')
      expect(frag.length).toBe(1)
    })

    it('does not advance the remote cursor from local push acknowledgements', async () => {
      ;(config.pushUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 'accepted',
        seq: 10,
      })
      provider.setWritable(true)
      doc.getXmlFragment('local').insert(0, [new Y.XmlElement('paragraph')])
      await vi.advanceTimersByTimeAsync(50)

      provider.applyRemoteUpdates([createRemoteUpdate(1)])

      expect(provider.lastAppliedSeq).toBe(1)
      expect(doc.getXmlFragment('document').length).toBe(1)
    })

    it('sets synced to true and emits sync event on first apply', () => {
      const syncHandler = vi.fn()
      provider.on('sync', syncHandler)

      const update = createRemoteUpdate(0)
      provider.applyRemoteUpdates([update])

      expect(syncHandler).toHaveBeenCalledWith(true)
    })

    it('defers the sync event until the final remote update page', () => {
      const syncHandler = vi.fn()
      provider.on('sync', syncHandler)

      const update = createRemoteUpdate(0)
      provider.applyRemoteUpdates([update], { sync: false })

      expect(syncHandler).not.toHaveBeenCalled()

      provider.applyRemoteUpdates([], { sync: true })

      expect(syncHandler).toHaveBeenCalledWith(true)
    })

    it('emits sync event for an empty first remote load', () => {
      const syncHandler = vi.fn()
      provider.on('sync', syncHandler)

      provider.applyRemoteUpdates([])

      expect(syncHandler).toHaveBeenCalledWith(true)
    })

    it('only emits sync event once', () => {
      const syncHandler = vi.fn()
      provider.on('sync', syncHandler)

      const update1 = createRemoteUpdate(0)
      provider.applyRemoteUpdates([update1])

      const update2 = createDistinctRemoteUpdate(1, doc)
      provider.applyRemoteUpdates([update2])

      expect(syncHandler).toHaveBeenCalledTimes(1)
    })

    it('requests a session reset before applying a new document revision', () => {
      provider.applyRemoteUpdates([createRemoteUpdate(0)])
      const nextRevision = createDistinctRemoteUpdate(1, doc)
      nextRevision.revision = 1

      provider.applyRemoteUpdates([nextRevision])

      expect(config.requestReset).toHaveBeenCalledTimes(1)
      expect(doc.getXmlFragment('document').length).toBe(1)
    })

    it('marks the provider while applying remote updates', () => {
      const remoteUpdateFlags: Array<boolean> = []
      doc.on('update', (_update, origin) => {
        if (origin === provider) {
          remoteUpdateFlags.push(provider.isApplyingRemoteUpdate())
        }
      })

      const update = createRemoteUpdate(0)
      provider.applyRemoteUpdates([update])

      expect(remoteUpdateFlags).toEqual([true])
      expect(provider.isApplyingRemoteUpdate()).toBe(false)
    })
  })

  describe('remote awareness', () => {
    it('applies remote awareness states for other clients', () => {
      const otherDoc = new Y.Doc()
      const otherAwareness = new Awareness(otherDoc)
      otherAwareness.setLocalState({ cursor: { x: 1, y: 2 } })

      provider.applyRemoteAwareness([
        {
          clientId: otherDoc.clientID,
          state: encodeAwareness(otherAwareness, otherDoc),
          updatedAt: Date.now(),
        },
      ])

      const states = provider.awareness.getStates()
      expect(states.get(otherDoc.clientID)).toEqual({ cursor: { x: 1, y: 2 } })

      otherAwareness.destroy()
      otherDoc.destroy()
    })

    it('removes departed clients', () => {
      const otherDoc1 = new Y.Doc()
      const otherAwareness1 = new Awareness(otherDoc1)
      otherAwareness1.setLocalState({ name: 'client1' })

      const otherDoc2 = new Y.Doc()
      const otherAwareness2 = new Awareness(otherDoc2)
      otherAwareness2.setLocalState({ name: 'client2' })

      const state1 = encodeAwareness(otherAwareness1, otherDoc1)
      const state2 = encodeAwareness(otherAwareness2, otherDoc2)

      provider.applyRemoteAwareness([
        { clientId: otherDoc1.clientID, state: state1, updatedAt: Date.now() },
        { clientId: otherDoc2.clientID, state: state2, updatedAt: Date.now() },
      ])

      expect(provider.awareness.getStates().has(otherDoc2.clientID)).toBe(true)

      provider.applyRemoteAwareness([
        { clientId: otherDoc1.clientID, state: state1, updatedAt: Date.now() },
      ])

      expect([...provider.awareness.getStates().keys()]).toEqual([doc.clientID, otherDoc1.clientID])

      otherAwareness1.destroy()
      otherDoc1.destroy()
      otherAwareness2.destroy()
      otherDoc2.destroy()
    })
  })

  describe('local update debouncing', () => {
    beforeEach(() => {
      provider.setWritable(true)
    })

    it('debounces local doc updates before pushing', () => {
      doc.getXmlFragment('document').insert(0, [new Y.XmlElement('p')])

      vi.advanceTimersByTime(50)
      expect(config.pushUpdate).toHaveBeenCalledTimes(1)
    })

    it('merges multiple rapid updates into one push', () => {
      doc.getXmlFragment('document').insert(0, [new Y.XmlElement('p')])
      doc.getXmlFragment('document').insert(1, [new Y.XmlElement('p')])
      doc.getXmlFragment('document').insert(2, [new Y.XmlElement('p')])

      vi.advanceTimersByTime(50)
      expect(config.pushUpdate).toHaveBeenCalledTimes(1)
    })

    it('max-wait timer forces flush at 200ms', () => {
      doc.getXmlFragment('document').insert(0, [new Y.XmlElement('p')])
      vi.advanceTimersByTime(40)

      doc.getXmlFragment('document').insert(1, [new Y.XmlElement('p')])
      vi.advanceTimersByTime(40)

      doc.getXmlFragment('document').insert(2, [new Y.XmlElement('p')])
      vi.advanceTimersByTime(40)

      doc.getXmlFragment('document').insert(3, [new Y.XmlElement('p')])
      vi.advanceTimersByTime(40)

      doc.getXmlFragment('document').insert(4, [new Y.XmlElement('p')])
      vi.advanceTimersByTime(40)

      expect(config.pushUpdate).toHaveBeenCalledTimes(1)
    })

    it('queues updates while push is in-flight', async () => {
      let resolveFirst!: (value: { seq: number }) => void
      const firstPromise = new Promise<{ seq: number }>((resolve) => {
        resolveFirst = resolve
      })

      ;(config.pushUpdate as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(firstPromise)
        .mockResolvedValue({ seq: 2 })

      doc.getXmlFragment('document').insert(0, [new Y.XmlElement('p')])
      vi.advanceTimersByTime(50)
      expect(config.pushUpdate).toHaveBeenCalledTimes(1)

      doc.getXmlFragment('document').insert(1, [new Y.XmlElement('p')])

      resolveFirst({ seq: 1 })
      await vi.advanceTimersByTimeAsync(50)

      expect(config.pushUpdate).toHaveBeenCalledTimes(2)
    })

    it('flushes pending updates when writable set to false', () => {
      doc.getXmlFragment('document').insert(0, [new Y.XmlElement('p')])

      provider.setWritable(false)
      expect(config.pushUpdate).toHaveBeenCalledTimes(1)
    })

    it('flushPendingUpdates sends pending doc updates immediately', async () => {
      doc.getXmlFragment('document').insert(0, [new Y.XmlElement('p')])

      await expect(provider.flushPendingUpdates()).resolves.toBe(true)

      expect(config.pushUpdate).toHaveBeenCalledTimes(1)
    })

    it('flushPendingUpdates waits for an in-flight push and drains queued updates', async () => {
      let resolveFirstPush!: (value: { seq: number }) => void
      const firstPush = new Promise<{ seq: number }>((resolve) => {
        resolveFirstPush = resolve
      })
      ;(config.pushUpdate as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(firstPush)
        .mockResolvedValue({ seq: 2 })

      doc.getXmlFragment('document').insert(0, [new Y.XmlElement('p')])
      vi.advanceTimersByTime(50)
      expect(config.pushUpdate).toHaveBeenCalledTimes(1)

      doc.getXmlFragment('document').insert(1, [new Y.XmlElement('p')])
      const flushPromise = provider.flushPendingUpdates()
      await Promise.resolve()

      resolveFirstPush({ seq: 1 })
      await expect(flushPromise).resolves.toBe(true)

      expect(config.pushUpdate).toHaveBeenCalledTimes(2)
    })

    it('keeps updates retryable when a destroy-time flush fails', async () => {
      ;(config.pushUpdate as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValue({ seq: 1 })

      doc.getXmlFragment('document').insert(0, [new Y.XmlElement('p')])

      provider.destroy()
      await vi.advanceTimersByTimeAsync(0)

      await expect(provider.flushPendingUpdates()).resolves.toBe(true)
      expect(config.pushUpdate).toHaveBeenCalledTimes(2)
    })

    it('backs off exponentially across consecutive push failures', async () => {
      ;(config.pushUpdate as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('offline-1'))
        .mockRejectedValueOnce(new Error('offline-2'))
        .mockResolvedValue({ status: 'accepted', seq: 1 })
      doc.getXmlFragment('document').insert(0, [new Y.XmlElement('p')])

      await vi.advanceTimersByTimeAsync(50)
      expect(config.pushUpdate).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(99)
      expect(config.pushUpdate).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(config.pushUpdate).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(199)
      expect(config.pushUpdate).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(1)
      expect(config.pushUpdate).toHaveBeenCalledTimes(3)
    })
  })

  describe('awareness push', () => {
    it('uses a UUID fallback when randomUUID is unavailable', () => {
      vi.stubGlobal('crypto', {
        getRandomValues: (bytes: Uint8Array) => {
          bytes.fill(7)
          return bytes
        },
      })
      const fallbackDoc = new Y.Doc()
      const fallbackConfig = createConfig()
      const fallbackProvider = new YjsProvider(fallbackDoc, DOCUMENT_ID, fallbackConfig)

      fallbackProvider.updateUser(createYjsProviderUser({ userId: 'player-1', name: 'Mara' }))

      const args = (fallbackConfig.pushAwareness as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
      expect(args.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      )

      fallbackProvider.destroy({ discardPendingUpdates: true })
      fallbackDoc.destroy()
    })
    it('throttles local awareness changes by flushing immediately then gating', () => {
      provider.awareness.setLocalState({ cursor: { x: 10, y: 20 } })

      expect(config.pushAwareness).toHaveBeenCalledTimes(1)
      expect(config.pushAwareness).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: DOCUMENT_ID,
          clientId: doc.clientID,
        }),
      )
    })

    it('coalesces rapid awareness changes into one push', () => {
      provider.awareness.setLocalState({ cursor: { x: 1, y: 1 } })
      provider.awareness.setLocalState({ cursor: { x: 2, y: 2 } })
      provider.awareness.setLocalState({ cursor: { x: 3, y: 3 } })

      vi.advanceTimersByTime(100)

      expect(config.pushAwareness).toHaveBeenCalledTimes(1)
    })

    it('renews an idle awareness session with the same private session id', async () => {
      provider.awareness.setLocalState({ cursor: { x: 1, y: 1 } })
      await vi.advanceTimersByTimeAsync(0)
      const firstCall = (config.pushAwareness as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]

      await vi.advanceTimersByTimeAsync(AWARENESS_HEARTBEAT_MS)

      expect(config.pushAwareness).toHaveBeenCalledTimes(2)
      const secondCall = (config.pushAwareness as ReturnType<typeof vi.fn>).mock.calls[1]?.[0]
      expect(secondCall.sessionId).toBe(firstCall.sessionId)
      expect(secondCall.sessionId).toMatch(/^[0-9a-f-]{36}$/)
      expect(readAwarenessState(secondCall.state, doc.clientID)).toEqual({
        cursor: { x: 1, y: 1 },
      })
    })

    it('flushes pending awareness on destroy', () => {
      provider.awareness.setLocalState({ cursor: { x: 10, y: 20 } })
      provider.destroy()

      expect(config.pushAwareness).toHaveBeenCalledTimes(1)
    })

    it('flushes queued awareness state on destroy after an in-flight push', async () => {
      let resolveFirstAwareness!: (value: null) => void
      const firstAwareness = new Promise<null>((resolve) => {
        resolveFirstAwareness = resolve
      })
      ;(config.pushAwareness as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(firstAwareness)
        .mockResolvedValue(null)

      provider.awareness.setLocalState({ cursor: { x: 1, y: 1 } })
      provider.awareness.setLocalState({ cursor: { x: 2, y: 2 } })
      provider.destroy()

      resolveFirstAwareness(null)
      await vi.advanceTimersByTimeAsync(0)

      expect(config.pushAwareness).toHaveBeenCalledTimes(2)
      const secondCall = (config.pushAwareness as ReturnType<typeof vi.fn>).mock.calls[1]?.[0]
      expect(readAwarenessState(secondCall.state, doc.clientID)).toEqual({
        cursor: { x: 2, y: 2 },
      })
    })
  })

  describe('edge cases', () => {
    it('reports provider teardown failures', async () => {
      const error = new Error('flush failed')
      vi.spyOn(provider, 'flushUpdates').mockRejectedValue(error)

      provider.destroy()
      await vi.advanceTimersByTimeAsync(0)

      expect(config.reportError).toHaveBeenCalledWith(
        expect.stringContaining('Yjs provider teardown failed'),
        error,
      )
    })
    it('flush on destroy sends pending updates when writable', async () => {
      provider.setWritable(true)
      doc.getXmlFragment('document').insert(0, [new Y.XmlElement('p')])

      provider.destroy()
      await vi.advanceTimersByTimeAsync(0)
      expect(config.pushUpdate).toHaveBeenCalledTimes(1)
    })
  })
})

describe('Yjs collaboration ownership boundaries', () => {
  it('keeps adapter-facing helpers on the provider contract', () => {
    expectTypeOf<YjsProvider>().toMatchTypeOf<
      Pick<
        YjsCollaborationProvider,
        'flushPendingUpdates' | 'isApplyingRemoteUpdate' | 'updateUser'
      >
    >()
  })
})
