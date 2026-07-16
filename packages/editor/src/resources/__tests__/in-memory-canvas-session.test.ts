import { describe, expect, it, vi } from 'vite-plus/test'
import { createCanvasDocumentDoc, readCanvasDocumentContent } from '../../canvas/document-contract'
import { CanvasDocumentController } from '../../canvas/document-controller'
import { initialVersion, sha256Digest } from '../component-version'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import { createInMemoryCanvasSession } from '../in-memory-canvas-session'
import * as Y from 'yjs'

describe('createInMemoryCanvasSession', () => {
  it('advances canonical edits and rejects invalid document state', async () => {
    const document = createCanvasDocumentDoc({ nodes: [], edges: [] })
    const initial = initialVersion(await sha256Digest(Y.encodeStateAsUpdate(document)))
    const changed = vi.fn()
    const session = createInMemoryCanvasSession(document, initial, changed)
    const nodeId = generateDomainId(DOMAIN_ID_KIND.canvasNode)
    const controller = new CanvasDocumentController(document)
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
    const controller = new CanvasDocumentController(document)
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
    const operation = (change: Parameters<CanvasDocumentController['apply']>[0]) => {
      const branch = new Y.Doc()
      Y.applyUpdate(branch, baseUpdate)
      const vector = Y.encodeStateVector(branch)
      const controller = new CanvasDocumentController(branch)
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
})
