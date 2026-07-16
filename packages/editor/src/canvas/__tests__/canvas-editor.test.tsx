import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import * as Y from 'yjs'
import { CanvasEditor } from '../canvas-editor'
import { createCanvasDocumentDoc, readCanvasDocumentContent } from '../document-contract'
import type { CanvasDocumentContent } from '../document-contract'
import { initialVersion, sha256Digest } from '../../resources/component-version'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'
import { createInMemoryCanvasSession } from '../../resources/in-memory-canvas-session'

const RESOURCE_ID = assertDomainId(DOMAIN_ID_KIND.resource, '01890f47-65f2-7cc0-8a3b-444444444444')
const NODE_A = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')
const NODE_B = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-222222222222')
const STROKE = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-333333333333')

async function createSession(content: CanvasDocumentContent = { nodes: [], edges: [] }) {
  const document = createCanvasDocumentDoc(content)
  const version = initialVersion(await sha256Digest(Y.encodeStateAsUpdate(document)))
  return createInMemoryCanvasSession(document, version)
}

describe('CanvasEditor', () => {
  it('creates, edits, deletes, and restores text through canonical controllers', async () => {
    const session = await createSession()
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Story board" />,
    )

    expect(screen.getByRole('button', { name: 'Pointer' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    fireEvent.pointerDown(screen.getByTestId('canvas-surface'), {
      button: 0,
      clientX: 120,
      clientY: 90,
    })

    const editor = screen.getByRole('textbox', { name: 'Canvas text' })
    fireEvent.change(editor, { target: { value: 'Canonical canvas text' } })
    fireEvent.blur(editor)
    expect(screen.getByText('Canonical canvas text')).toBeVisible()

    fireEvent.keyDown(screen.getByTestId('canvas-editor-shell'), { key: 'Delete' })
    expect(screen.queryByText('Canonical canvas text')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('Canonical canvas text')).toBeVisible()
    view.unmount()
    session.dispose()
  })

  it('renders document content without editor tools in viewer mode', async () => {
    const session = await createSession({
      nodes: [
        { id: NODE_A, type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: NODE_B, type: 'embed', position: { x: 300, y: 0 }, data: {} },
      ],
      edges: [{ id: 'edge-a-b', source: NODE_A, target: NODE_B, type: 'straight' }],
    })
    const view = render(
      <CanvasEditor
        canEdit={false}
        resourceId={RESOURCE_ID}
        session={session}
        title="Read only board"
      />,
    )

    expect(screen.getByLabelText('Canvas surface')).toBeVisible()
    expect(screen.getAllByTestId('canvas-node')).toHaveLength(2)
    expect(screen.getByTestId('canvas-edge')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Text' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fit view' })).toBeVisible()
    view.unmount()
    session.dispose()
  })

  it('previews drawing locally and persists one canonical stroke on release', async () => {
    const session = await createSession()
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Drawing board" />,
    )
    const surface = screen.getByTestId('canvas-surface')
    installPointerCapture(surface)
    fireEvent.click(screen.getByRole('button', { name: 'Draw' }))

    fireEvent.pointerDown(surface, { button: 0, clientX: 10, clientY: 20, pointerId: 5 })
    fireEvent.pointerMove(surface, {
      buttons: 1,
      clientX: 50,
      clientY: 60,
      pointerId: 5,
      pressure: 0.75,
    })
    expect(screen.getByTestId('canvas-drawing-preview')).toBeVisible()
    expect(readCanvasDocumentContent(session.document).nodes).toHaveLength(0)

    fireEvent.pointerUp(surface, { clientX: 50, clientY: 60, pointerId: 5 })
    expect(screen.queryByTestId('canvas-drawing-preview')).not.toBeInTheDocument()
    const [stroke] = readCanvasDocumentContent(session.document).nodes
    expect(stroke).toMatchObject({
      type: 'stroke',
      data: {
        points: [
          [10, 20, 0.5],
          [50, 60, 0.75],
        ],
        color: 'var(--foreground)',
        size: 4,
        opacity: 100,
      },
    })
    expect(screen.getByTestId('canvas-stroke-hit-target')).toBeVisible()

    fireEvent.pointerDown(surface, { button: 0, clientX: 80, clientY: 20, pointerId: 6 })
    fireEvent.pointerMove(surface, {
      buttons: 1,
      clientX: 100,
      clientY: 40,
      pointerId: 6,
    })
    fireEvent.pointerCancel(surface, { pointerId: 6 })
    expect(screen.queryByTestId('canvas-drawing-preview')).not.toBeInTheDocument()
    expect(readCanvasDocumentContent(session.document).nodes).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Eraser' }))
    fireEvent.pointerDown(surface, { button: 0, clientX: 30, clientY: 0, pointerId: 7 })
    fireEvent.pointerMove(surface, {
      buttons: 1,
      clientX: 30,
      clientY: 80,
      pointerId: 7,
    })
    expect(screen.getByTestId('canvas-node')).toHaveAttribute('data-erasing', 'true')
    expect(readCanvasDocumentContent(session.document).nodes).toHaveLength(1)
    fireEvent.pointerUp(surface, { clientX: 30, clientY: 80, pointerId: 7 })
    expect(readCanvasDocumentContent(session.document).nodes).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(readCanvasDocumentContent(session.document).nodes).toHaveLength(1)

    view.unmount()
    session.dispose()
  })

  it('previews and commits mixed node-edge marquee selection', async () => {
    const session = await createSession({
      nodes: [
        { id: NODE_A, type: 'text', position: { x: 20, y: 20 }, data: {} },
        { id: NODE_B, type: 'embed', position: { x: 300, y: 20 }, data: {} },
      ],
      edges: [{ id: 'edge-a-b', source: NODE_A, target: NODE_B, type: 'straight' }],
    })
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Selection board" />,
    )
    const surface = screen.getByTestId('canvas-surface')
    installPointerCapture(surface)

    fireEvent.pointerDown(surface, { button: 0, clientX: 0, clientY: 0, pointerId: 7 })
    expect(surface).toHaveFocus()
    fireEvent.pointerMove(surface, { clientX: 600, clientY: 220, pointerId: 7 })

    expect(screen.getByTestId('canvas-marquee')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Selecting 2 nodes and 1 edge')
    expect(
      screen
        .getAllByTestId('canvas-node')
        .every((node) => node.getAttribute('data-selected') === 'true'),
    ).toBe(true)
    expect(screen.getByTestId('canvas-edge')).toHaveAttribute('data-selected', 'true')

    fireEvent.pointerUp(surface, { clientX: 600, clientY: 220, pointerId: 7 })
    expect(screen.queryByTestId('canvas-marquee')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Lasso select' }))
    fireEvent.pointerDown(surface, { button: 0, clientX: 0, clientY: 0, pointerId: 8 })
    fireEvent.pointerMove(surface, { clientX: 220, clientY: 0, pointerId: 8 })
    fireEvent.pointerMove(surface, { clientX: 220, clientY: 120, pointerId: 8 })
    expect(screen.getByTestId('canvas-lasso')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Selecting 1 node and 1 edge')
    fireEvent.pointerUp(surface, { clientX: 220, clientY: 120, pointerId: 8 })
    expect(screen.getAllByTestId('canvas-node')[0]).toHaveAttribute('data-selected', 'true')
    expect(screen.getAllByTestId('canvas-node')[1]).toHaveAttribute('data-selected', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Pointer' }))
    fireEvent.pointerDown(surface, { button: 0, clientX: 700, clientY: 500, pointerId: 9 })
    fireEvent.pointerUp(surface, { clientX: 700, clientY: 500, pointerId: 9 })
    expect(
      screen
        .getAllByTestId('canvas-node')
        .every((node) => node.getAttribute('data-selected') === 'false'),
    ).toBe(true)

    fireEvent.pointerDown(surface, { button: 0, clientX: 10, clientY: 10, pointerId: 10 })
    fireEvent.pointerMove(surface, {
      clientX: 110,
      clientY: 60,
      pointerId: 10,
      shiftKey: true,
    })
    expect(screen.getByTestId('canvas-marquee')).toHaveStyle({ width: '100px', height: '100px' })
    fireEvent.pointerCancel(surface, { pointerId: 10 })
    expect(screen.queryByTestId('canvas-marquee')).not.toBeInTheDocument()

    view.unmount()
    session.dispose()
  })

  it('previews and commits one handle-authored edge through the canonical document path', async () => {
    const session = await createSession({
      nodes: [
        { id: NODE_A, type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: NODE_B, type: 'embed', position: { x: 300, y: 0 }, data: {} },
      ],
      edges: [],
    })
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Edges board" />,
    )
    const surface = screen.getByTestId('canvas-surface')
    installPointerCapture(surface)
    fireEvent.click(screen.getByRole('button', { name: 'Edges' }))

    const sourceHandle = screen.getAllByTestId('canvas-node-handle-right')[0]
    fireEvent.pointerDown(sourceHandle, { button: 0, pointerId: 12 })
    fireEvent.pointerMove(surface, {
      buttons: 1,
      clientX: 300,
      clientY: 80,
      pointerId: 12,
    })
    expect(screen.getByTestId('canvas-connection-preview')).toHaveAttribute(
      'data-snap-target',
      'true',
    )
    expect(readCanvasDocumentContent(session.document).edges).toHaveLength(0)

    fireEvent.pointerUp(surface, { clientX: 300, clientY: 80, pointerId: 12 })
    const [edge] = readCanvasDocumentContent(session.document).edges
    expect(edge).toMatchObject({
      source: NODE_A,
      target: NODE_B,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'bezier',
    })
    expect(screen.queryByTestId('canvas-connection-preview')).not.toBeInTheDocument()
    expect(screen.getByTestId('canvas-edge')).toHaveAttribute('data-selected', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(readCanvasDocumentContent(session.document).edges).toHaveLength(0)
    view.unmount()
    session.dispose()
  })

  it('previews and commits a screen-space multi-node resize as one document change', async () => {
    const session = await createSession({
      nodes: [
        {
          id: NODE_A,
          type: 'text',
          position: { x: 0, y: 0 },
          width: 180,
          height: 80,
          data: {},
        },
        {
          id: NODE_B,
          type: 'embed',
          position: { x: 300, y: 0 },
          width: 180,
          height: 80,
          data: {},
        },
      ],
      edges: [],
    })
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Resize board" />,
    )
    const surface = screen.getByTestId('canvas-surface')
    const nodes = screen.getAllByTestId('canvas-node')
    installPointerCapture(surface)
    nodes.forEach(installPointerCapture)

    fireEvent.pointerDown(nodes[0], { button: 0, clientX: 20, clientY: 20, pointerId: 13 })
    fireEvent.pointerUp(nodes[0], { clientX: 20, clientY: 20, pointerId: 13 })
    fireEvent.pointerDown(nodes[1], {
      button: 0,
      clientX: 320,
      clientY: 20,
      ctrlKey: true,
      pointerId: 14,
    })

    expect(screen.getByTestId('canvas-selection-resize-wrapper')).toHaveStyle({
      width: '480px',
      height: '80px',
    })
    expect(screen.getAllByTestId(/canvas-selection-resize-zone-/)).toHaveLength(8)
    fireEvent.pointerDown(screen.getByTestId('canvas-selection-resize-zone-bottom-right'), {
      button: 0,
      clientX: 480,
      clientY: 80,
      pointerId: 15,
    })
    fireEvent.pointerMove(surface, {
      buttons: 1,
      clientX: 960,
      clientY: 160,
      pointerId: 15,
    })
    expect(screen.getAllByTestId('canvas-node')[0]).toHaveStyle({ width: '360px', height: '160px' })
    expect(readCanvasDocumentContent(session.document).nodes[0]).toMatchObject({
      width: 180,
      height: 80,
    })

    fireEvent.pointerUp(surface, { clientX: 960, clientY: 160, pointerId: 15 })
    expect(readCanvasDocumentContent(session.document).nodes).toMatchObject([
      { position: { x: 0, y: 0 }, width: 360, height: 160 },
      { position: { x: 600, y: 0 }, width: 360, height: 160 },
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(readCanvasDocumentContent(session.document).nodes).toMatchObject([
      { position: { x: 0, y: 0 }, width: 180, height: 80 },
      { position: { x: 300, y: 0 }, width: 180, height: 80 },
    ])
    view.unmount()
    session.dispose()
  })

  it('snaps a drag through transient interaction state and commits once', async () => {
    const session = await createSession({
      nodes: [
        {
          id: NODE_A,
          type: 'text',
          position: { x: 0, y: 0 },
          width: 100,
          height: 50,
          data: {},
        },
        {
          id: NODE_B,
          type: 'text',
          position: { x: 200, y: 200 },
          width: 100,
          height: 50,
          data: {},
        },
      ],
      edges: [],
    })
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Snap board" />,
    )
    const node = screen.getAllByTestId('canvas-node')[0]
    installPointerCapture(screen.getByTestId('canvas-surface'))
    installPointerCapture(node)

    fireEvent.pointerDown(node, { button: 0, clientX: 20, clientY: 20, pointerId: 16 })
    fireEvent.pointerMove(node, {
      buttons: 1,
      clientX: 116,
      clientY: 20,
      ctrlKey: true,
      pointerId: 16,
    })

    expect(node).toHaveStyle({ transform: 'translate(100px, 0px)' })
    expect(screen.getByTestId('canvas-drag-snap-guide')).toHaveAttribute('x1', '200')
    expect(readCanvasDocumentContent(session.document).nodes[0]).toMatchObject({
      position: { x: 0, y: 0 },
    })

    fireEvent.pointerUp(node, { clientX: 118, clientY: 20, ctrlKey: true, pointerId: 16 })
    expect(screen.queryByTestId('canvas-drag-snap-guide')).not.toBeInTheDocument()
    expect(readCanvasDocumentContent(session.document).nodes[0]).toMatchObject({
      position: { x: 100, y: 0 },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(readCanvasDocumentContent(session.document).nodes[0]).toMatchObject({
      position: { x: 0, y: 0 },
    })
    view.unmount()
    session.dispose()
  })

  it('snaps resize handles without persisting pointer-move previews', async () => {
    const session = await createSession({
      nodes: [
        {
          id: NODE_A,
          type: 'text',
          position: { x: 0, y: 0 },
          width: 180,
          height: 80,
          data: {},
        },
        {
          id: NODE_B,
          type: 'text',
          position: { x: 300, y: 200 },
          width: 180,
          height: 80,
          data: {},
        },
      ],
      edges: [],
    })
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Resize snap board" />,
    )
    const surface = screen.getByTestId('canvas-surface')
    const node = screen.getAllByTestId('canvas-node')[0]
    installPointerCapture(surface)
    installPointerCapture(node)
    fireEvent.pointerDown(node, { button: 0, clientX: 20, clientY: 20, pointerId: 17 })
    fireEvent.pointerUp(node, { clientX: 20, clientY: 20, pointerId: 17 })

    fireEvent.pointerDown(screen.getByTestId('canvas-selection-resize-zone-right'), {
      button: 0,
      clientX: 180,
      clientY: 40,
      pointerId: 18,
    })
    fireEvent.pointerMove(surface, {
      buttons: 1,
      clientX: 296,
      clientY: 40,
      ctrlKey: true,
      pointerId: 18,
    })

    expect(node).toHaveStyle({ width: '300px' })
    expect(screen.getByTestId('canvas-drag-snap-guide')).toHaveAttribute('x1', '300')
    expect(readCanvasDocumentContent(session.document).nodes[0]).toMatchObject({ width: 180 })

    fireEvent.pointerUp(surface, {
      clientX: 298,
      clientY: 40,
      ctrlKey: true,
      pointerId: 18,
    })
    expect(screen.queryByTestId('canvas-drag-snap-guide')).not.toBeInTheDocument()
    expect(readCanvasDocumentContent(session.document).nodes[0]).toMatchObject({ width: 300 })
    view.unmount()
    session.dispose()
  })

  it('renders moved stroke coordinates with a screen-space hit target', async () => {
    const session = await createSession({
      nodes: [
        {
          id: STROKE,
          type: 'stroke',
          position: { x: 400, y: 100 },
          width: 100,
          height: 20,
          data: {
            bounds: { x: 120, y: 40, width: 100, height: 20 },
            points: [
              [120, 50, 0.5],
              [220, 50, 0.5],
            ],
            color: '#000000',
            size: 4,
          },
        },
      ],
      edges: [],
    })
    const view = render(
      <CanvasEditor
        canEdit={false}
        resourceId={RESOURCE_ID}
        session={session}
        title="Stroke board"
      />,
    )

    const hitTarget = screen.getByTestId('canvas-stroke-hit-target')
    expect(hitTarget).toHaveAttribute('points', '0,10 100,10')
    expect(hitTarget).toHaveAttribute('stroke-width', '24')
    fireEvent.pointerDown(hitTarget, { button: 0, clientX: 450, clientY: 110, pointerId: 11 })
    expect(screen.getByTestId('canvas-node')).toHaveAttribute('data-selected', 'true')

    view.unmount()
    session.dispose()
  })
})

function installPointerCapture(element: HTMLElement) {
  const captured = new Set<number>()
  Object.defineProperties(element, {
    setPointerCapture: {
      configurable: true,
      value: (pointerId: number) => captured.add(pointerId),
    },
    hasPointerCapture: {
      configurable: true,
      value: (pointerId: number) => captured.has(pointerId),
    },
    releasePointerCapture: {
      configurable: true,
      value: (pointerId: number) => captured.delete(pointerId),
    },
  })
}
