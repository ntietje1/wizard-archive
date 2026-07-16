import { describe, expect, it, vi } from 'vite-plus/test'
import { createCanvasDocumentDoc, readCanvasDocumentContent } from '../../canvas/document-contract'
import { createCanvasDocumentController } from '../../canvas/document-controller'
import type { CanvasDocumentChange } from '../../canvas/document-controller'
import { initialVersion, sha256Digest } from '../component-version'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import { createInMemoryCanvasSession } from '../in-memory-canvas-session'
import { createCanvasTextDocument } from '../../canvas/text/model'
import { CANVAS_WORKLOAD_LIMITS } from '../../canvas/workload'
import {
  decodeWizardCanvasDocument,
  encodeWizardCanvasDocument,
} from '../../canvas/native-document'
import * as Y from 'yjs'

describe('createInMemoryCanvasSession', () => {
  it('advances canonical edits and rejects invalid document state', async () => {
    const document = createCanvasDocumentDoc({ nodes: [], edges: [] })
    const initial = initialVersion(await sha256Digest(Y.encodeStateAsUpdate(document)))
    const changed = vi.fn()
    const session = createInMemoryCanvasSession(document, initial, changed)
    const nodeId = generateDomainId(DOMAIN_ID_KIND.canvasNode)
    const controller = createCanvasDocumentController(document)
    controller.apply({
      type: 'insert',
      nodes: [{ id: nodeId, type: 'text', position: { x: 1, y: 2 }, data: {} }],
      edges: [],
    })
    controller.dispose()

    await expect(session.flush()).resolves.toMatchObject({
      status: 'completed',
      version: { revision: 2 },
    })
    expect(changed).toHaveBeenCalledWith(session)

    document.getMap('nodes').set('not-a-canvas-node-id', {
      id: 'not-a-canvas-node-id',
      type: 'text',
      position: { x: 3, y: 4 },
      data: {},
    })
    await expect(session.flush()).resolves.toEqual({
      status: 'rejected',
      reason: 'content_corrupt',
    })
    session.dispose()
  })

  it('uses the canonical topology rule before committing an in-memory flush', async () => {
    const sourceId = generateDomainId(DOMAIN_ID_KIND.canvasNode)
    const targetId = generateDomainId(DOMAIN_ID_KIND.canvasNode)
    const document = createCanvasDocumentDoc({
      nodes: [
        { id: sourceId, type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: targetId, type: 'text', position: { x: 10, y: 0 }, data: {} },
      ],
      edges: [{ id: 'edge', source: sourceId, target: targetId, type: 'straight' }],
    })
    const initial = initialVersion(await sha256Digest(Y.encodeStateAsUpdate(document)))
    const session = createInMemoryCanvasSession(document, initial)
    const controller = createCanvasDocumentController(document)
    controller.apply({ type: 'remove', nodeIds: [sourceId], edgeIds: [] })
    controller.dispose()

    await expect(session.flush()).resolves.toMatchObject({ status: 'completed' })
    expect(readCanvasDocumentContent(document)).toEqual({
      nodes: [{ id: targetId, type: 'text', position: { x: 10, y: 0 }, data: {} }],
      edges: [],
    })
    session.dispose()
  })

  it('preserves independently merged canvas fields before an in-memory flush', async () => {
    const nodeId = generateDomainId(DOMAIN_ID_KIND.canvasNode)
    const document = createCanvasDocumentDoc({
      nodes: [
        {
          id: nodeId,
          type: 'text',
          position: { x: 0, y: 0 },
          width: 100,
          data: { backgroundColor: '#ffffff' },
        },
      ],
      edges: [],
    })
    const baseUpdate = Y.encodeStateAsUpdate(document)
    const operation = (change: CanvasDocumentChange) => {
      const branch = new Y.Doc()
      Y.applyUpdate(branch, baseUpdate)
      const vector = Y.encodeStateVector(branch)
      const controller = createCanvasDocumentController(branch)
      controller.apply(change)
      controller.dispose()
      const update = Y.encodeStateAsUpdate(branch, vector)
      branch.destroy()
      return update
    }
    const geometry = operation({
      type: 'update',
      nodes: [{ id: nodeId, type: 'text', position: { x: 10, y: 20 }, width: 240 }],
      edges: [],
    })
    const style = operation({
      type: 'update',
      nodes: [{ id: nodeId, type: 'text', data: { backgroundColor: '#ff0000' } }],
      edges: [],
    })
    const initial = initialVersion(await sha256Digest(baseUpdate))
    const session = createInMemoryCanvasSession(document, initial)
    Y.applyUpdate(document, geometry)
    Y.applyUpdate(document, style)

    await expect(session.flush()).resolves.toMatchObject({ status: 'completed' })
    expect(readCanvasDocumentContent(document).nodes[0]).toMatchObject({
      position: { x: 10, y: 20 },
      width: 240,
      data: { backgroundColor: '#ff0000' },
    })
    session.dispose()
  })

  it('round-trips and flushes a near-limit canonical document', async () => {
    const document = createCanvasDocumentDoc({
      nodes: Array.from({ length: 28 }, (_, index) => ({
        id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
        type: 'text' as const,
        position: { x: index, y: 0 },
        data: {
          content: createCanvasTextDocument(
            'x'.repeat(CANVAS_WORKLOAD_LIMITS.textCharactersPerNode),
          ),
        },
      })),
      edges: [],
    })
    const encoded = encodeWizardCanvasDocument(document)
    document.destroy()
    const decoded = decodeWizardCanvasDocument(encoded)
    expect(decoded).not.toBeNull()
    if (!decoded) throw new Error('Expected near-limit canvas document')
    const initial = initialVersion(await sha256Digest(Y.encodeStateAsUpdate(decoded)))
    const session = createInMemoryCanvasSession(decoded, initial)
    const controller = createCanvasDocumentController(decoded)
    const first = controller.read().nodes[0]!
    controller.apply({
      type: 'update',
      nodes: [{ id: first.id, type: first.type, position: { x: -1, y: -1 } }],
      edges: [],
    })
    controller.dispose()

    await expect(session.flush()).resolves.toMatchObject({ status: 'completed' })
    session.dispose()
  })

  it('truthfully rejects an oversized encoded document', async () => {
    const document = createCanvasDocumentDoc({ nodes: [], edges: [] })
    const initial = initialVersion(await sha256Digest(Y.encodeStateAsUpdate(document)))
    const session = createInMemoryCanvasSession(document, initial)
    document.getMap('overflow').set('data', 'x'.repeat(CANVAS_WORKLOAD_LIMITS.encodedBytes * 2))

    await expect(session.flush()).resolves.toEqual({
      status: 'rejected',
      reason: 'content_limit_exceeded',
    })
    session.dispose()
  })
})
