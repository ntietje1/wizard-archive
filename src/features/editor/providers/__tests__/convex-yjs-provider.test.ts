import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import { ConvexYjsProvider } from '../convex-yjs-provider'
import type { ConvexYjsProviderConfig } from '../convex-yjs-provider'
import type { Id } from 'convex/_generated/dataModel'

const DOCUMENT_ID = 'test-doc-id' as Id<'notes'>

function createRemoteUpdate(seq = 0): { update: ArrayBuffer; seq: number } {
  const remoteDoc = new Y.Doc()
  const frag = remoteDoc.getXmlFragment('document')
  frag.insert(0, [new Y.XmlElement('paragraph')])
  const encoded = Y.encodeStateAsUpdate(remoteDoc)
  remoteDoc.destroy()
  return {
    update: encoded.buffer.slice(
      encoded.byteOffset,
      encoded.byteOffset + encoded.byteLength,
    ) as ArrayBuffer,
    seq,
  }
}

function createDistinctRemoteUpdate(
  seq: number,
  existingDoc?: Y.Doc,
): { update: ArrayBuffer; seq: number } {
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
    update: encoded.buffer.slice(
      encoded.byteOffset,
      encoded.byteOffset + encoded.byteLength,
    ) as ArrayBuffer,
    seq,
  }
}

function encodeAwareness(awareness: Awareness, doc: Y.Doc): ArrayBuffer {
  const encoded = encodeAwarenessUpdate(awareness, [doc.clientID])
  return encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength,
  ) as ArrayBuffer
}

function createConfig(
  overrides?: Partial<ConvexYjsProviderConfig>,
): ConvexYjsProviderConfig {
  return {
    pushUpdate: vi.fn().mockResolvedValue({ seq: 0 }),
    pushAwareness: vi.fn().mockResolvedValue(null),
    removeAwareness: vi.fn().mockResolvedValue(null),
    ...overrides,
  }
}

describe('ConvexYjsProvider', () => {
  let doc: Y.Doc
  let config: ConvexYjsProviderConfig
  let provider: ConvexYjsProvider

  beforeEach(() => {
    vi.useFakeTimers()
    doc = new Y.Doc()
    config = createConfig()
    provider = new ConvexYjsProvider(doc, DOCUMENT_ID, config)
  })

  afterEach(() => {
    provider.destroy()
    doc.destroy()
    vi.useRealTimers()
  })

  describe('construction & lifecycle', () => {
    it('creates awareness from doc', () => {
      expect(provider.awareness).toBeInstanceOf(Awareness)
    })

    it('starts with synced false', () => {
      expect(provider.synced).toBe(false)
    })

    it('destroy calls removeAwareness with correct args', async () => {
      provider.destroy()
      await vi.advanceTimersByTimeAsync(0)
      expect(config.removeAwareness).toHaveBeenCalledWith({
        documentId: DOCUMENT_ID,
        clientId: doc.clientID,
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
      const { update, seq } = createRemoteUpdate()
      provider.applyRemoteUpdates([{ update, seq }])
      const fragAfter = Y.encodeStateAsUpdate(doc)
      expect(fragAfter).toEqual(fragBefore)
    })
  })

  describe('remote update application', () => {
    it('applies updates with seq greater than lastAppliedSeq', () => {
      const { update, seq } = createRemoteUpdate(0)
      provider.applyRemoteUpdates([{ update, seq }])
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

    it('sets synced to true and emits sync event on first apply', () => {
      const syncHandler = vi.fn()
      provider.on('sync', syncHandler)

      const { update, seq } = createRemoteUpdate(0)
      provider.applyRemoteUpdates([{ update, seq }])

      expect(provider.synced).toBe(true)
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

    it('skips own clientId in remote awareness', () => {
      const state = encodeAwareness(provider.awareness, doc)
      expect(() => {
        provider.applyRemoteAwareness([
          { clientId: doc.clientID, state, updatedAt: Date.now() },
        ])
      }).not.toThrow()
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

      expect(provider.awareness.getStates().has(otherDoc2.clientID)).toBe(false)

      otherAwareness1.destroy()
      otherDoc1.destroy()
      otherAwareness2.destroy()
      otherDoc2.destroy()
    })
  })

  describe('local update debouncing', () => {
    beforeEach(() => {
      provider.writable = true
    })

    it('debounces local doc updates before pushing', () => {
      doc.getXmlFragment('document').insert(0, [new Y.XmlElement('p')])

      vi.advanceTimersByTime(49)
      expect(config.pushUpdate).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1)
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

      expect(config.pushUpdate).not.toHaveBeenCalled()

      doc.getXmlFragment('document').insert(4, [new Y.XmlElement('p')])
      vi.advanceTimersByTime(40)

      expect(config.pushUpdate).toHaveBeenCalledTimes(1)
    })

    it('does not push remote-origin updates', () => {
      const { update, seq } = createRemoteUpdate(0)
      provider.applyRemoteUpdates([{ update, seq }])

      vi.advanceTimersByTime(500)
      expect(config.pushUpdate).not.toHaveBeenCalled()
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

    it('does not push when writable is false', () => {
      provider.writable = false

      doc.getXmlFragment('document').insert(0, [new Y.XmlElement('p')])
      vi.advanceTimersByTime(200)

      expect(config.pushUpdate).not.toHaveBeenCalled()
    })

    it('flushes pending updates when writable set to false', () => {
      doc.getXmlFragment('document').insert(0, [new Y.XmlElement('p')])
      expect(config.pushUpdate).not.toHaveBeenCalled()

      provider.writable = false
      expect(config.pushUpdate).toHaveBeenCalledTimes(1)
    })
  })

  describe('awareness push', () => {
    it('debounces local awareness changes before pushing', () => {
      provider.awareness.setLocalState({ cursor: { x: 10, y: 20 } })

      expect(config.pushAwareness).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)

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

    it('does not push awareness changes for other clients', () => {
      const otherDoc = new Y.Doc()
      const otherAwareness = new Awareness(otherDoc)
      otherAwareness.setLocalState({ name: 'other' })

      const state = encodeAwareness(otherAwareness, otherDoc)

      provider.applyRemoteAwareness([
        { clientId: otherDoc.clientID, state, updatedAt: Date.now() },
      ])

      vi.advanceTimersByTime(200)

      expect(config.pushAwareness).not.toHaveBeenCalled()

      otherAwareness.destroy()
      otherDoc.destroy()
    })

    it('flushes pending awareness on destroy', () => {
      provider.awareness.setLocalState({ cursor: { x: 10, y: 20 } })
      provider.destroy()

      expect(config.pushAwareness).toHaveBeenCalledTimes(1)
    })
  })

  describe('edge cases', () => {
    it('flush on destroy sends pending updates when writable', async () => {
      provider.writable = true
      doc.getXmlFragment('document').insert(0, [new Y.XmlElement('p')])

      expect(config.pushUpdate).not.toHaveBeenCalled()
      provider.destroy()
      await vi.advanceTimersByTimeAsync(0)
      expect(config.pushUpdate).toHaveBeenCalledTimes(1)
    })

    it('does not flush on destroy when not writable', async () => {
      provider.writable = true
      doc.getXmlFragment('document').insert(0, [new Y.XmlElement('p')])
      provider.writable = false
      ;(config.pushUpdate as ReturnType<typeof vi.fn>).mockClear()

      provider.destroy()
      await vi.advanceTimersByTimeAsync(0)
      expect(config.pushUpdate).not.toHaveBeenCalled()
    })
  })
})
