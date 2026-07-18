import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { StrictMode } from 'react'
import type { ComponentProps } from 'react'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { CanvasEditor as ProductionCanvasEditor } from '../canvas-editor'
import { createCanvasDocumentController } from '../document-controller'
import { createCanvasDocumentDoc, readCanvasDocumentContent } from '../document-contract'
import type { CanvasDocumentContent } from '../document-contract'
import { initialVersion, sha256Digest } from '../../resources/component-version'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'
import { createInMemoryCanvasSession } from '../../resources/in-memory-canvas-session'
import { createCanvasTextDocument } from '../text/model'
import { parseSafeHttpsUrl } from '../../resources/authored-destination-contract'

const RESOURCE_ID = assertDomainId(DOMAIN_ID_KIND.resource, '01890f47-65f2-7cc0-8a3b-444444444444')
const NODE_A = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')
const NODE_B = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-222222222222')
const STROKE = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-333333333333')
function CanvasEditor(props: Omit<ComponentProps<typeof ProductionCanvasEditor>, 'renderEmbed'>) {
  return <ProductionCanvasEditor {...props} renderEmbed={() => null} />
}

async function createSession(content: CanvasDocumentContent = { nodes: [], edges: [] }) {
  const document = createCanvasDocumentDoc(content)
  const version = initialVersion(await sha256Digest(Y.encodeStateAsUpdate(document)))
  return createInMemoryCanvasSession(document, version)
}

describe('CanvasEditor', () => {
  it('selects an exact canonical node target when the canvas opens', async () => {
    const session = await createSession({
      nodes: [
        { id: NODE_A, type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: NODE_B, type: 'text', position: { x: 400, y: 300 }, data: {} },
      ],
      edges: [],
    })
    const view = render(
      <CanvasEditor
        canEdit
        focusedNodeId={NODE_B}
        resourceId={RESOURCE_ID}
        session={session}
        title="Focused board"
      />,
    )

    const nodes = screen.getAllByTestId('canvas-node')
    await waitFor(() => expect(nodes[1]).toHaveAttribute('data-selected', 'true'))
    expect(nodes[0]).toHaveAttribute('data-selected', 'false')
    view.unmount()
    session.dispose()
  })

  it('owns a fresh controller runtime for each committed StrictMode effect lifetime', async () => {
    const session = await createSession({
      nodes: [{ id: NODE_A, type: 'text', position: { x: 0, y: 0 }, data: {} }],
      edges: [],
    })
    const view = render(
      <StrictMode>
        <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Strict board" />
      </StrictMode>,
    )

    expect(
      await screen.findByRole('application', { name: 'Strict board canvas editor' }),
    ).toBeVisible()
    expect(screen.getByTestId('canvas-node')).toBeVisible()
    view.unmount()
    session.dispose()
  })

  it('publishes canvas-space cursor awareness without persisting it in the document', async () => {
    const session = await createSession()
    const before = Y.encodeStateVector(session.document)
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Awareness board" />,
    )
    const surface = screen.getByRole('region', { name: 'Canvas surface' })

    fireEvent.pointerMove(surface, { clientX: 120, clientY: 90, pointerId: 4 })
    expect(session.collaboration.provider.awareness.getLocalState()).toMatchObject({
      cursor: { x: 120, y: 90 },
    })
    expect(Y.encodeStateVector(session.document)).toEqual(before)

    fireEvent.pointerLeave(surface)
    expect(session.collaboration.provider.awareness.getLocalState()).toMatchObject({ cursor: null })

    view.unmount()
    session.dispose()
  })

  it('composes local viewport changes immediately around spring-smoothed remote points', async () => {
    const session = await createSession()
    const remoteDocument = new Y.Doc()
    const remoteAwareness = new Awareness(remoteDocument)
    remoteAwareness.setLocalState({
      cursor: { x: 120, y: 80 },
      user: { name: 'Remote', color: '#e06c75' },
    })
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Shared board" />,
    )

    act(() =>
      applyAwarenessUpdate(
        session.collaboration.provider.awareness,
        encodeAwarenessUpdate(remoteAwareness, [remoteDocument.clientID]),
        'remote',
      ),
    )
    const viewport = screen.getByTestId('canvas-viewport')
    const cursor = screen.getByLabelText('Remote cursor')
    expect(viewport).toContainElement(cursor)
    expect(cursor).toHaveStyle({ transform: 'translate(120px, 80px)' })

    const surface = screen.getByTestId('canvas-surface')
    const bounds = vi
      .spyOn(surface, 'getBoundingClientRect')
      .mockReturnValue(DOMRect.fromRect({ width: 800, height: 600 }))
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
      expect(viewport).toHaveStyle({
        transform: 'translate(-80px, -60px) scale(1.2)',
      })
      expect(cursor).toHaveStyle({ transform: 'translate(120px, 80px)' })
      expect(screen.getByTestId('canvas-remote-cursor-visual')).toHaveStyle({
        transform: `scale(${1 / 1.2})`,
      })
    } finally {
      bounds.mockRestore()
      window.localStorage.clear()
    }

    view.unmount()
    remoteAwareness.destroy()
    remoteDocument.destroy()
    session.dispose()
  })

  it('scales and positions the background grid with the canonical viewport', async () => {
    const session = await createSession()
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Grid board" />,
    )
    const surface = screen.getByTestId('canvas-surface')

    expect(surface).toHaveStyle({
      backgroundPosition: '0px 0px',
      backgroundSize: '36px 36px',
    })
    const nestedScrollRegion = document.createElement('div')
    nestedScrollRegion.className = 'nowheel'
    surface.append(nestedScrollRegion)
    const zoomEvent = createEvent.wheel(nestedScrollRegion, {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      clientX: 0,
      clientY: 0,
      deltaY: -500,
    })
    fireEvent(nestedScrollRegion, zoomEvent)
    expect(zoomEvent.defaultPrevented).toBe(true)
    expect(surface.style.backgroundSize).toBe('72px 72px')
    fireEvent.wheel(surface, { ctrlKey: true, clientX: 0, clientY: 0, deltaY: 500 })
    view.unmount()
    session.dispose()
  })

  it('places resolved internal and external drops at the canvas pointer location', async () => {
    const session = await createSession()
    const externalUrl = parseSafeHttpsUrl('https://example.com/reference')!
    const resolve = vi.fn(() =>
      Promise.resolve({
        kind: 'destinations' as const,
        destinations: [
          {
            kind: 'internal' as const,
            target: { kind: 'resource' as const, resourceId: RESOURCE_ID },
          },
          { kind: 'externalUrl' as const, url: externalUrl },
        ],
      }),
    )
    const view = render(
      <ProductionCanvasEditor
        canEdit
        drop={{
          canResolve: () => true,
          resolveFiles: () => Promise.resolve({ kind: 'destinations' as const, destinations: [] }),
          resolve,
        }}
        renderEmbed={() => null}
        resourceId={RESOURCE_ID}
        session={session}
        title="Drop board"
      />,
    )
    const surface = screen.getByTestId('canvas-surface')
    const dataTransfer = {
      dropEffect: 'none',
      types: ['application/example'],
    } as unknown as DataTransfer

    fireEvent.dragEnter(surface, { dataTransfer })
    expect(surface).toHaveAttribute('data-drop-target', 'true')
    expect(dataTransfer.dropEffect).toBe('copy')
    const dropEvent = createEvent.drop(surface, { dataTransfer })
    Object.defineProperties(dropEvent, {
      clientX: { value: 120 },
      clientY: { value: 90 },
    })
    fireEvent(surface, dropEvent)
    const repeatedDropEvent = createEvent.drop(surface, { dataTransfer })
    Object.defineProperties(repeatedDropEvent, {
      clientX: { value: 120 },
      clientY: { value: 90 },
    })
    fireEvent(surface, repeatedDropEvent)

    await waitFor(() => {
      expect(readCanvasDocumentContent(session.document).nodes).toHaveLength(2)
    })
    expect(resolve).toHaveBeenCalledOnce()
    expect(readCanvasDocumentContent(session.document).nodes).toMatchObject([
      {
        type: 'embed',
        position: { x: 120, y: 90 },
        width: 320,
        height: 240,
        data: {
          destination: {
            kind: 'internal',
            target: { kind: 'resource', resourceId: RESOURCE_ID },
          },
        },
      },
      {
        type: 'embed',
        position: { x: 140, y: 110 },
        data: { destination: { kind: 'externalUrl', url: externalUrl } },
      },
    ])
    expect(surface).not.toHaveAttribute('data-drop-target')
    expect(
      screen
        .getAllByTestId('canvas-node')
        .every((node) => node.getAttribute('data-selected') === 'true'),
    ).toBe(true)

    view.unmount()
    session.dispose()
  })

  it('creates, edits, deletes, and restores text through canonical controllers', async () => {
    const session = await createSession()
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Story board" />,
    )

    expect(screen.getByRole('button', { name: 'Pointer' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    const surface = screen.getByTestId('canvas-surface')
    installPointerCapture(surface)
    fireEvent.pointerDown(surface, {
      button: 0,
      clientX: 120,
      clientY: 90,
      pointerId: 1,
    })
    expect(readCanvasDocumentContent(session.document).nodes).toHaveLength(0)
    fireEvent.pointerUp(surface, { clientX: 120, clientY: 90, pointerId: 1 })

    const editor = screen.getByRole('textbox', { name: 'Canvas text' })
    const externalController = createCanvasDocumentController(session.document)
    const createdNode = readCanvasDocumentContent(session.document).nodes[0]!
    expect(createdNode).toMatchObject({
      position: { x: -40, y: -30 },
      width: 320,
      height: 240,
    })
    externalController.apply({
      type: 'update',
      nodes: [
        {
          id: createdNode.id,
          type: 'text',
          data: { content: createCanvasTextDocument('Canonical canvas text') },
        },
      ],
      edges: [],
    })
    externalController.dispose()
    expect(await screen.findByText('Canonical canvas text')).toBeVisible()
    expect(screen.getByRole('toolbar', { name: 'Canvas formatting toolbar' })).toBeVisible()
    expect(
      screen.queryByRole('toolbar', { name: 'Canvas conditional toolbar' }),
    ).not.toBeInTheDocument()
    fireEvent.keyDown(editor, { key: 'Escape' })
    expect(screen.getByText('Canonical canvas text')).toBeVisible()
    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()

    fireEvent.keyDown(screen.getByTestId('canvas-editor-shell'), { key: 'Delete' })
    expect(screen.queryByText('Canonical canvas text')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('Canonical canvas text')).toBeVisible()
    view.unmount()
    session.dispose()
  })

  it('previews and commits a drag-sized text node', async () => {
    const session = await createSession()
    const view = render(
      <CanvasEditor
        canEdit
        resourceId={RESOURCE_ID}
        session={session}
        title="Text placement board"
      />,
    )
    const surface = screen.getByTestId('canvas-surface')
    installPointerCapture(surface)
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    fireEvent.pointerDown(surface, {
      button: 0,
      clientX: 100,
      clientY: 200,
      pointerId: 2,
    })
    fireEvent.pointerMove(surface, {
      buttons: 1,
      clientX: 180,
      clientY: 260,
      pointerId: 2,
    })

    expect(screen.getByTestId('canvas-text-placement')).toHaveStyle({
      left: '100px',
      top: '200px',
      width: '80px',
      height: '60px',
    })
    expect(readCanvasDocumentContent(session.document).nodes).toHaveLength(0)

    fireEvent.pointerUp(surface, { clientX: 180, clientY: 260, pointerId: 2 })
    expect(screen.queryByTestId('canvas-text-placement')).not.toBeInTheDocument()
    expect(readCanvasDocumentContent(session.document).nodes[0]).toMatchObject({
      position: { x: 100, y: 200 },
      width: 80,
      height: 60,
    })
    expect(screen.getByRole('textbox', { name: 'Canvas text' })).toBeVisible()
    view.unmount()
    session.dispose()
  })

  it('preserves the reference toolbar order and viewport controls', async () => {
    const session = await createSession()
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Toolbar board" />,
    )

    const mainToolbar = screen.getByRole('toolbar', { name: 'Canvas main toolbar' })
    expect(
      within(mainToolbar)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Pointer', 'Panning', 'Lasso select', 'Draw', 'Eraser', 'Text', 'Edges'])
    expect(
      within(mainToolbar)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['1', '2', '3', '4', '5', '6', '7'])

    const viewportToolbar = screen.getByRole('toolbar', { name: 'Canvas viewport controls' })
    expect(
      within(viewportToolbar)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Zoom in', 'Zoom out', 'Fit zoom', 'Undo', 'Redo'])

    const surface = screen.getByTestId('canvas-surface')
    const bounds = vi
      .spyOn(surface, 'getBoundingClientRect')
      .mockReturnValue(DOMRect.fromRect({ width: 800, height: 600 }))
    try {
      fireEvent.click(within(viewportToolbar).getByRole('button', { name: 'Zoom in' }))
      expect(screen.getByTestId('canvas-viewport')).toHaveStyle({
        transform: 'translate(-80px, -60px) scale(1.2)',
      })
    } finally {
      bounds.mockRestore()
      window.localStorage.clear()
    }

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
    expect(screen.getByTestId('canvas-edge-layer')).toHaveStyle({ zIndex: '0' })
    expect(screen.queryByRole('button', { name: 'Text' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fit zoom' })).toBeVisible()
    view.unmount()
    session.dispose()
  })

  it('restores select-all, tool, copy, cut, paste, and duplicate shortcuts', async () => {
    const session = await createSession({
      nodes: [
        { id: NODE_A, type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: NODE_B, type: 'embed', position: { x: 300, y: 0 }, data: {} },
      ],
      edges: [{ id: 'edge-a-b', source: NODE_A, target: NODE_B, type: 'straight' }],
    })
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Clipboard board" />,
    )
    const shell = screen.getByTestId('canvas-editor-shell')

    fireEvent.keyDown(shell, { key: '4' })
    expect(screen.getByRole('button', { name: 'Draw' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(shell, { key: '7' })
    expect(screen.getByRole('button', { name: 'Edges' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('canvas-edge')).toHaveClass('pointer-events-none')
    fireEvent.keyDown(shell, { key: '6' })
    expect(screen.getByRole('button', { name: 'Text' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(shell, { key: '1' })
    expect(screen.getByRole('button', { name: 'Pointer' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('canvas-edge')).toHaveClass('pointer-events-auto')

    fireEvent.keyDown(shell, { key: 'a', ctrlKey: true })
    fireEvent.keyDown(shell, { key: 'c', ctrlKey: true })
    fireEvent.keyDown(shell, { key: 'v', ctrlKey: true })
    expect(readCanvasDocumentContent(session.document)).toMatchObject({
      nodes: [{ id: NODE_A }, { id: NODE_B }, {}, {}],
      edges: [{ id: 'edge-a-b' }, {}],
    })

    fireEvent.keyDown(shell, { key: 'x', ctrlKey: true })
    expect(readCanvasDocumentContent(session.document)).toMatchObject({
      nodes: [{ id: NODE_A }, { id: NODE_B }],
      edges: [{ id: 'edge-a-b' }],
    })
    fireEvent.keyDown(shell, { key: 'v', ctrlKey: true })
    expect(readCanvasDocumentContent(session.document).nodes).toHaveLength(4)

    fireEvent.keyDown(shell, { key: 'd', ctrlKey: true })
    const duplicated = readCanvasDocumentContent(session.document)
    expect(duplicated.nodes).toHaveLength(6)
    expect(duplicated.edges).toHaveLength(3)
    expect(new Set(duplicated.nodes.map((node) => node.id)).size).toBe(6)

    fireEvent.keyDown(shell, { key: 'z', ctrlKey: true, repeat: true })
    expect(readCanvasDocumentContent(session.document).nodes).toHaveLength(6)
    fireEvent.keyDown(shell, { key: 'z', ctrlKey: true })
    expect(readCanvasDocumentContent(session.document).nodes).toHaveLength(4)
    fireEvent.keyDown(shell, { key: 'y', ctrlKey: true })
    expect(readCanvasDocumentContent(session.document).nodes).toHaveLength(6)

    const firstNode = screen.getAllByTestId('canvas-node')[0]!
    installPointerCapture(screen.getByTestId('canvas-surface'))
    installPointerCapture(firstNode)
    fireEvent.pointerDown(firstNode, {
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 40,
    })
    fireEvent.pointerUp(firstNode, { clientX: 20, clientY: 20, pointerId: 40 })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Stroke size input' }), {
      key: 'Backspace',
    })
    expect(readCanvasDocumentContent(session.document).nodes).toHaveLength(6)
    view.unmount()
    session.dispose()
  })

  it('narrows a multi-selection on click and activates text on the same double-click', async () => {
    const session = await createSession({
      nodes: [
        { id: NODE_A, type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: NODE_B, type: 'text', position: { x: 240, y: 0 }, data: {} },
      ],
      edges: [],
    })
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Activation board" />,
    )
    const nodes = screen.getAllByTestId('canvas-node')
    installPointerCapture(screen.getByTestId('canvas-surface'))
    nodes.forEach(installPointerCapture)

    const dragStart = createEvent.pointerDown(nodes[0], {
      bubbles: true,
      cancelable: true,
      button: 0,
      pointerId: 31,
    })
    fireEvent(nodes[0], dragStart)
    expect(dragStart.defaultPrevented).toBe(true)
    fireEvent.pointerUp(nodes[0], { pointerId: 31 })
    fireEvent.pointerDown(nodes[1], { button: 0, ctrlKey: true, pointerId: 32 })
    expect(nodes[0]).toHaveAttribute('data-selected', 'true')
    expect(nodes[1]).toHaveAttribute('data-selected', 'true')
    expect(nodes[0].querySelector('.canvas-text-editor')).not.toHaveClass('nowheel')

    fireEvent.pointerDown(nodes[0], { button: 0, pointerId: 33 })
    fireEvent.pointerUp(nodes[0], { pointerId: 33 })
    expect(nodes[0]).toHaveAttribute('data-selected', 'true')
    expect(nodes[1]).toHaveAttribute('data-selected', 'false')
    expect(nodes[0].querySelector('.canvas-text-editor')).toHaveClass('nowheel')

    fireEvent.doubleClick(nodes[1])
    expect(screen.getAllByRole('textbox', { name: 'Canvas text' })[1]).toHaveAttribute(
      'contenteditable',
      'true',
    )
    expect(nodes[0]).toHaveAttribute('data-selected', 'false')
    expect(nodes[1]).toHaveAttribute('data-selected', 'true')

    view.unmount()
    session.dispose()
  })

  it('captures canvas undo before a selected read-only text child can consume it', async () => {
    const session = await createSession({
      nodes: [{ id: NODE_A, type: 'text', position: { x: 0, y: 0 }, data: {} }],
      edges: [],
    })
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="History board" />,
    )
    const node = screen.getByTestId('canvas-node')
    installPointerCapture(screen.getByTestId('canvas-surface'))
    installPointerCapture(node)

    fireEvent.pointerDown(node, {
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 10,
      pointerId: 36,
    })
    fireEvent.pointerMove(node, {
      buttons: 1,
      clientX: 50,
      clientY: 30,
      pointerId: 36,
    })
    fireEvent.pointerUp(node, { clientX: 50, clientY: 30, pointerId: 36 })
    expect(readCanvasDocumentContent(session.document).nodes[0]).toMatchObject({
      position: { x: 40, y: 20 },
    })
    expect(node).toHaveAttribute('data-selected', 'true')

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Canvas text' }), {
      key: 'z',
      ctrlKey: true,
    })
    expect(readCanvasDocumentContent(session.document).nodes[0]).toMatchObject({
      position: { x: 0, y: 0 },
    })

    view.unmount()
    session.dispose()
  })

  it('activates an embedded note with the same double-click and exclusive-scroll rules', async () => {
    const session = await createSession({
      nodes: [{ id: NODE_A, type: 'embed', position: { x: 0, y: 0 }, data: {} }],
      edges: [],
    })
    const view = render(
      <ProductionCanvasEditor
        canEdit
        renderEmbed={({ editing }) => (
          <div
            className="size-full overflow-auto"
            data-canvas-editable-embed={!editing}
            data-editing={editing}
            data-testid="embedded-note"
          />
        )}
        resourceId={RESOURCE_ID}
        session={session}
        title="Embedded note board"
      />,
    )
    const node = screen.getByTestId('canvas-node')
    const embeddedNote = screen.getByTestId('embedded-note')
    installPointerCapture(screen.getByTestId('canvas-surface'))
    installPointerCapture(node)

    fireEvent.pointerDown(embeddedNote, { button: 0, pointerId: 37 })
    fireEvent.pointerUp(embeddedNote, { pointerId: 37 })
    fireEvent.pointerDown(embeddedNote, { button: 0, pointerId: 38 })
    fireEvent.pointerUp(embeddedNote, { pointerId: 38 })
    fireEvent.doubleClick(embeddedNote)

    expect(node).toHaveAttribute('data-selected', 'true')
    expect(embeddedNote).toHaveAttribute('data-editing', 'true')
    expect(embeddedNote.closest('.nowheel')).not.toBeNull()

    view.unmount()
    session.dispose()
  })

  it('restores pane, node, edge, arrange, reorder, and clipboard context actions', async () => {
    const session = await createSession({
      nodes: [
        { id: NODE_A, type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: NODE_B, type: 'embed', position: { x: 300, y: 0 }, data: {} },
      ],
      edges: [{ id: 'edge-a-b', source: NODE_A, target: NODE_B, type: 'straight' }],
    })
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Menu board" />,
    )
    const surface = screen.getByTestId('canvas-surface')
    installPointerCapture(surface)

    fireEvent.contextMenu(screen.getAllByTestId('canvas-node')[0]!, {
      clientX: 100,
      clientY: 100,
    })
    expect(screen.getByRole('menu', { name: 'Canvas actions' })).toBeVisible()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    expect(readCanvasDocumentContent(session.document).nodes).toHaveLength(3)

    fireEvent.contextMenu(surface, { clientX: 500, clientY: 500 })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Select All' }))
    const selectedNode = screen.getAllByTestId('canvas-node')[0]!
    installPointerCapture(selectedNode)
    fireEvent.pointerDown(selectedNode, { button: 2, pointerId: 41 })
    fireEvent.pointerUp(selectedNode, { button: 2, pointerId: 41 })
    fireEvent.contextMenu(selectedNode, {
      clientX: 100,
      clientY: 100,
    })
    expect(screen.getByRole('menuitem', { name: 'Arrange' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Align left' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Reorder' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Send to back' })).toBeVisible()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' }))

    fireEvent.contextMenu(surface, { clientX: 500, clientY: 500 })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Paste' }))
    expect(readCanvasDocumentContent(session.document)).toMatchObject({
      nodes: [{}, {}, {}, {}, {}, {}],
      edges: [{ id: 'edge-a-b' }, {}],
    })

    fireEvent.contextMenu(screen.getAllByTestId('canvas-edge')[0]!, {
      clientX: 200,
      clientY: 200,
    })
    expect(screen.queryByRole('menuitem', { name: 'Copy' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(readCanvasDocumentContent(session.document).edges).toHaveLength(1)
    view.unmount()
    session.dispose()
  })

  it('opens the exact authored destination from an embedded node menu', async () => {
    const destination = {
      kind: 'internal' as const,
      target: { kind: 'canvasNode' as const, resourceId: RESOURCE_ID, nodeId: NODE_A },
    }
    const session = await createSession({
      nodes: [
        {
          id: NODE_B,
          type: 'embed',
          position: { x: 0, y: 0 },
          data: { destination },
        },
      ],
      edges: [],
    })
    const openDestination = vi.fn()
    const view = render(
      <CanvasEditor
        canEdit
        openDestination={openDestination}
        resourceId={RESOURCE_ID}
        session={session}
        title="Target menu board"
      />,
    )

    fireEvent.contextMenu(screen.getByTestId('canvas-node'), { clientX: 100, clientY: 100 })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open target' }))
    expect(openDestination).toHaveBeenCalledExactlyOnceWith(destination)
    view.unmount()
    session.dispose()
  })

  it('cancels retained mutations and blocks undo when editing changes to viewing', async () => {
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
          type: 'embed',
          position: { x: 300, y: 0 },
          width: 100,
          height: 50,
          data: {},
        },
        {
          id: STROKE,
          type: 'stroke',
          position: { x: 0, y: 100 },
          width: 100,
          height: 20,
          data: {
            bounds: { x: 0, y: 100, width: 100, height: 20 },
            points: [
              [0, 110, 0.5],
              [100, 110, 0.5],
            ],
            color: '#000000',
            size: 4,
          },
        },
      ],
      edges: [{ id: 'edge-a-b', source: NODE_A, target: NODE_B, type: 'straight' }],
    })
    const renderEditor = (canEdit: boolean) => (
      <CanvasEditor
        canEdit={canEdit}
        resourceId={RESOURCE_ID}
        session={session}
        title="Mode boundary board"
      />
    )
    const view = render(renderEditor(true))
    const surface = screen.getByTestId('canvas-surface')
    installPointerCapture(surface)
    screen.getAllByTestId('canvas-node').forEach(installPointerCapture)
    const initial = readCanvasDocumentContent(session.document)

    fireEvent.click(screen.getByRole('button', { name: 'Draw' }))
    fireEvent.pointerDown(surface, { button: 0, clientX: 10, clientY: 200, pointerId: 31 })
    fireEvent.pointerMove(surface, {
      buttons: 1,
      clientX: 80,
      clientY: 220,
      pointerId: 31,
    })
    expect(screen.getByTestId('canvas-drawing-preview')).toBeVisible()
    view.rerender(renderEditor(false))
    expect(screen.queryByTestId('canvas-drawing-preview')).not.toBeInTheDocument()
    fireEvent.pointerUp(surface, { clientX: 80, clientY: 220, pointerId: 31 })
    expect(readCanvasDocumentContent(session.document)).toEqual(initial)

    view.rerender(renderEditor(true))
    fireEvent.click(screen.getByRole('button', { name: 'Eraser' }))
    fireEvent.pointerDown(surface, { button: 0, clientX: 30, clientY: 80, pointerId: 32 })
    fireEvent.pointerMove(surface, {
      buttons: 1,
      clientX: 30,
      clientY: 140,
      pointerId: 32,
    })
    expect(screen.getAllByTestId('canvas-node')[2]).toHaveAttribute('data-erasing', 'true')
    view.rerender(renderEditor(false))
    fireEvent.pointerUp(surface, { clientX: 30, clientY: 140, pointerId: 32 })
    expect(readCanvasDocumentContent(session.document)).toEqual(initial)

    view.rerender(renderEditor(true))
    fireEvent.click(screen.getByRole('button', { name: 'Edges' }))
    fireEvent.pointerDown(screen.getAllByTestId('canvas-node-handle-right')[0], {
      button: 0,
      pointerId: 33,
    })
    fireEvent.pointerMove(surface, {
      buttons: 1,
      clientX: 300,
      clientY: 25,
      pointerId: 33,
    })
    expect(screen.getByTestId('canvas-connection-preview')).toBeVisible()
    view.rerender(renderEditor(false))
    fireEvent.pointerUp(surface, { clientX: 300, clientY: 25, pointerId: 33 })
    expect(readCanvasDocumentContent(session.document)).toEqual(initial)

    view.rerender(renderEditor(true))
    const firstNode = screen.getAllByTestId('canvas-node')[0]
    fireEvent.pointerDown(firstNode, { button: 0, clientX: 10, clientY: 10, pointerId: 34 })
    fireEvent.pointerMove(firstNode, {
      buttons: 1,
      clientX: 80,
      clientY: 80,
      pointerId: 34,
    })
    view.rerender(renderEditor(false))
    fireEvent.pointerUp(firstNode, { clientX: 80, clientY: 80, pointerId: 34 })
    expect(readCanvasDocumentContent(session.document)).toEqual(initial)

    view.rerender(renderEditor(true))
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    fireEvent.pointerDown(surface, { button: 0, clientX: 500, clientY: 300, pointerId: 35 })
    fireEvent.pointerUp(surface, { clientX: 500, clientY: 300, pointerId: 35 })
    const externalController = createCanvasDocumentController(session.document)
    const editingNode = readCanvasDocumentContent(session.document).nodes.at(-1)!
    externalController.apply({
      type: 'update',
      nodes: [
        {
          id: editingNode.id,
          type: 'text',
          data: { content: createCanvasTextDocument('Must persist') },
        },
      ],
      edges: [],
    })
    externalController.dispose()
    await screen.findByText('Must persist')
    view.rerender(renderEditor(false))
    const beforeUndo = readCanvasDocumentContent(session.document)
    expect(beforeUndo.nodes).toHaveLength(initial.nodes.length + 1)
    const created = beforeUndo.nodes.at(-1)
    expect(created?.type).toBe('text')
    if (created?.type !== 'text') throw new Error('Expected the created text node')
    expect(created.data.content?.[0]?.content).toEqual([{ type: 'text', text: 'Must persist' }])
    fireEvent.keyDown(screen.getByTestId('canvas-editor-shell'), { key: 'z', ctrlKey: true })
    expect(readCanvasDocumentContent(session.document)).toEqual(beforeUndo)

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
    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Select Red color' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Stroke size' }), {
      target: { value: '8' },
    })

    fireEvent.pointerDown(surface, { button: 0, clientX: 10, clientY: 20, pointerId: 5 })
    const drawingMove = createEvent.pointerMove(surface, {
      buttons: 1,
      clientX: 50,
      clientY: 60,
      pointerId: 5,
      pressure: 0.75,
    })
    Object.defineProperty(drawingMove, 'getCoalescedEvents', {
      value: () => [
        { clientX: 20, clientY: 30, pressure: 0.6 },
        { clientX: 35, clientY: 45, pressure: 0.7 },
      ],
    })
    fireEvent(surface, drawingMove)
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
          [20, 30, 0.6],
          [35, 45, 0.7],
          [50, 60, 0.75],
        ],
        color: 'var(--t-red)',
        size: 8,
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
        {
          id: NODE_A,
          type: 'text',
          position: { x: 20, y: 20 },
          width: 180,
          height: 80,
          data: {},
        },
        {
          id: NODE_B,
          type: 'embed',
          position: { x: 300, y: 20 },
          width: 240,
          height: 160,
          data: {},
        },
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

    expect(screen.getByTestId('canvas-marquee')).toHaveStyle({
      left: '0px',
      top: '0px',
      width: '600px',
      height: '220px',
    })
    expect(screen.getByRole('status')).toHaveTextContent('Selecting 2 nodes and 1 edge')
    expect(screen.getByTestId('canvas-pending-selection-preview-wrapper')).toHaveStyle({
      height: '160px',
      transform: 'translate(20px, 20px)',
      width: '520px',
    })
    expect(screen.getAllByTestId('canvas-node-selection-indicator')).toHaveLength(2)
    expect(screen.queryByTestId('canvas-selection-resize-wrapper')).not.toBeInTheDocument()
    expect(
      screen
        .getAllByTestId('canvas-node')
        .every((node) => node.getAttribute('data-selected') === 'true'),
    ).toBe(true)
    expect(screen.getByTestId('canvas-edge')).toHaveAttribute('data-selected', 'true')
    expect(screen.getByTestId('canvas-edge-primary-path')).toHaveAttribute(
      'data-canvas-authored-stroke-width',
      '1.5',
    )
    expect(screen.getByTestId('canvas-edge-primary-path')).toHaveAttribute(
      'stroke',
      'var(--foreground)',
    )
    expect(screen.getByTestId('canvas-edge-primary-path')).toHaveAttribute('stroke-opacity', '0.45')
    expect(screen.getByTestId('canvas-edge-interaction')).toHaveAttribute('stroke-width', '20')
    expect(screen.getByTestId('canvas-edge-selection-highlight')).toHaveAttribute(
      'data-canvas-highlight-stroke-width',
      '1',
    )

    fireEvent.pointerUp(surface, { clientX: 600, clientY: 220, pointerId: 7 })
    expect(screen.queryByTestId('canvas-marquee')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByTestId('canvas-edge-primary-path')).toHaveAttribute('stroke-opacity', '1')

    fireEvent.click(screen.getByRole('button', { name: 'Lasso select' }))
    fireEvent.pointerDown(surface, { button: 0, clientX: 0, clientY: 0, pointerId: 8 })
    fireEvent.pointerMove(surface, { clientX: 220, clientY: 0, pointerId: 8 })
    fireEvent.pointerMove(surface, { clientX: 220, clientY: 120, pointerId: 8 })
    expect(screen.getByTestId('canvas-lasso')).toBeVisible()
    expect(await screen.findByRole('status')).toHaveTextContent('Selecting 1 node and 1 edge')
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
          width: 240,
          height: 160,
          data: {},
        },
      ],
      edges: [],
    })
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Edges board" />,
    )
    const surface = screen.getByTestId('canvas-surface')
    installPointerCapture(surface)
    expect(screen.queryByTestId('canvas-node-handle-right')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edges' }))
    fireEvent.click(screen.getByRole('button', { name: 'Change edge type to Step' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select Red color' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Stroke size' }), {
      target: { value: '6' },
    })

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
    expect(screen.getByTestId('canvas-connection-preview')).toHaveAttribute(
      'data-edge-type',
      'step',
    )
    expect(screen.getByTestId('canvas-connection-preview')).toHaveAttribute(
      'data-canvas-authored-stroke-width',
      '6',
    )
    expect(screen.getByTestId('canvas-connection-preview')).toHaveAttribute(
      'stroke',
      'var(--t-red)',
    )
    expect(screen.getByTestId('canvas-connection-preview')).toHaveAttribute('stroke-width', '6')
    expect(readCanvasDocumentContent(session.document).edges).toHaveLength(0)

    fireEvent.pointerUp(surface, { clientX: 300, clientY: 80, pointerId: 12 })
    const [edge] = readCanvasDocumentContent(session.document).edges
    expect(edge).toMatchObject({
      source: NODE_A,
      target: NODE_B,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'step',
      style: {
        stroke: 'var(--t-red)',
        strokeWidth: 6,
        opacity: 1,
      },
    })
    expect(screen.queryByTestId('canvas-connection-preview')).not.toBeInTheDocument()
    expect(screen.getByTestId('canvas-edge')).toHaveAttribute('data-selected', 'false')

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
          position: { x: 20, y: 30 },
          width: 180,
          height: 80,
          data: {},
        },
        {
          id: NODE_B,
          type: 'embed',
          position: { x: 320, y: 30 },
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

    fireEvent.pointerDown(nodes[0], { button: 0, clientX: 40, clientY: 50, pointerId: 13 })
    fireEvent.pointerUp(nodes[0], { clientX: 40, clientY: 50, pointerId: 13 })
    fireEvent.pointerDown(nodes[1], {
      button: 0,
      clientX: 340,
      clientY: 50,
      ctrlKey: true,
      pointerId: 14,
    })

    expect(screen.getByTestId('canvas-selection-resize-wrapper')).toHaveStyle({
      transform: 'translate(20px, 30px)',
      width: '480px',
      height: '80px',
    })
    expect(screen.getByTestId('canvas-selection-resize-outline')).toHaveStyle({
      borderWidth: '1.5px',
      inset: '-3px',
    })
    expect(screen.getByTestId('canvas-selection-resize-zone-top-left')).toHaveStyle({
      height: '18px',
      left: '-9px',
      top: '-9px',
      width: '18px',
    })
    expect(screen.getByTestId('canvas-selection-resize-zone-top')).toHaveStyle({
      height: '18px',
      left: '9px',
      right: '9px',
      top: '-9px',
    })
    expect(screen.getAllByTestId('canvas-node-selection-indicator')).toHaveLength(2)
    expect(screen.getAllByTestId(/canvas-selection-resize-zone-/)).toHaveLength(8)
    fireEvent.pointerDown(screen.getByTestId('canvas-selection-resize-zone-bottom-right'), {
      button: 0,
      clientX: 500,
      clientY: 110,
      pointerId: 15,
    })
    fireEvent.pointerMove(surface, {
      buttons: 1,
      clientX: 980,
      clientY: 190,
      pointerId: 15,
    })
    expect(screen.getAllByTestId('canvas-node')[0]).toHaveStyle({ width: '360px', height: '160px' })
    expect(readCanvasDocumentContent(session.document).nodes[0]).toMatchObject({
      width: 180,
      height: 80,
    })

    fireEvent.pointerUp(surface, { clientX: 980, clientY: 190, pointerId: 15 })
    expect(readCanvasDocumentContent(session.document).nodes).toMatchObject([
      { position: { x: 20, y: 30 }, width: 360, height: 160 },
      { position: { x: 620, y: 30 }, width: 360, height: 160 },
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(readCanvasDocumentContent(session.document).nodes).toMatchObject([
      { position: { x: 20, y: 30 }, width: 180, height: 80 },
      { position: { x: 320, y: 30 }, width: 180, height: 80 },
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

  it('arranges and reorders mixed selections through one canonical document change', async () => {
    const session = await createSession({
      nodes: [
        {
          id: NODE_A,
          type: 'text',
          position: { x: 100, y: 0 },
          width: 100,
          height: 50,
          zIndex: 1,
          data: {},
        },
        {
          id: NODE_B,
          type: 'text',
          position: { x: 0, y: 100 },
          width: 100,
          height: 50,
          zIndex: 3,
          data: {},
        },
      ],
      edges: [{ id: 'arrange-edge', source: NODE_A, target: NODE_B, type: 'straight', zIndex: 2 }],
    })
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Arrange board" />,
    )
    const surface = screen.getByTestId('canvas-surface')
    const nodes = screen.getAllByTestId('canvas-node')
    installPointerCapture(surface)
    nodes.forEach(installPointerCapture)
    fireEvent.pointerDown(nodes[0], { button: 0, clientX: 120, clientY: 20, pointerId: 19 })
    fireEvent.pointerUp(nodes[0], { clientX: 120, clientY: 20, pointerId: 19 })
    fireEvent.pointerDown(nodes[1], {
      button: 0,
      clientX: 20,
      clientY: 120,
      ctrlKey: true,
      pointerId: 20,
    })

    fireEvent.contextMenu(nodes[0]!, {
      clientX: 120,
      clientY: 20,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Align left' }))
    expect(readCanvasDocumentContent(session.document).nodes).toMatchObject([
      { position: { x: 0, y: 0 } },
      { position: { x: 0, y: 100 } },
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(readCanvasDocumentContent(session.document).nodes[0]).toMatchObject({
      position: { x: 100, y: 0 },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Bring to front' }))
    expect(screen.getByTestId('canvas-edge-layer')).toHaveStyle({ zIndex: '2' })
    expect(nodes[0]).toHaveStyle({ zIndex: '4' })
    expect(readCanvasDocumentContent(session.document)).toMatchObject({
      nodes: [{ zIndex: 4 }, { zIndex: 5 }],
      edges: [{ zIndex: 2 }],
    })
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(readCanvasDocumentContent(session.document)).toMatchObject({
      nodes: [{ zIndex: 1 }, { zIndex: 3 }],
      edges: [{ zIndex: 2 }],
    })
    view.unmount()
    session.dispose()
  })

  it('shows explicit mixed properties and fans out one canonical update', async () => {
    const session = await createSession({
      nodes: [
        {
          id: NODE_A,
          type: 'text',
          position: { x: 0, y: 0 },
          width: 100,
          height: 50,
          data: { borderWidth: 3 },
        },
        {
          id: NODE_B,
          type: 'text',
          position: { x: 200, y: 0 },
          width: 100,
          height: 50,
          data: { borderWidth: 7 },
        },
      ],
      edges: [],
    })
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Property board" />,
    )
    const surface = screen.getByTestId('canvas-surface')
    const nodes = screen.getAllByTestId('canvas-node')
    installPointerCapture(surface)
    nodes.forEach(installPointerCapture)
    fireEvent.pointerDown(nodes[0], { button: 0, clientX: 20, clientY: 20, pointerId: 21 })
    fireEvent.pointerUp(nodes[0], { clientX: 20, clientY: 20, pointerId: 21 })
    fireEvent.pointerDown(nodes[1], {
      button: 0,
      clientX: 220,
      clientY: 20,
      ctrlKey: true,
      pointerId: 22,
    })

    const borderWidth = screen.getByRole('textbox', { name: 'Stroke size input' })
    expect(borderWidth).toHaveAttribute('placeholder', '--')
    fireEvent.change(borderWidth, { target: { value: '5' } })
    fireEvent.blur(borderWidth)
    expect(readCanvasDocumentContent(session.document).nodes).toMatchObject([
      { data: { borderWidth: 5 } },
      { data: { borderWidth: 5 } },
    ])
    expect(nodes[0].firstElementChild).toHaveStyle({ borderWidth: '5px' })
    expect(nodes[1].firstElementChild).toHaveStyle({ borderWidth: '5px' })

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Fill' })).getByRole('button', {
        name: 'Select Blue color',
      }),
    )
    expect(readCanvasDocumentContent(session.document).nodes).toMatchObject([
      { data: { backgroundColor: 'var(--bg-blue)', borderWidth: 5 } },
      { data: { backgroundColor: 'var(--bg-blue)', borderWidth: 5 } },
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(readCanvasDocumentContent(session.document).nodes).toMatchObject([
      { data: { borderWidth: 5 } },
      { data: { borderWidth: 5 } },
    ])
    view.unmount()
    session.dispose()
  })

  it('does not divide reorder controls from an empty property group', async () => {
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
          position: { x: 200, y: 0 },
          width: 100,
          height: 50,
          data: {},
        },
      ],
      edges: [{ id: 'mixed-edge', source: NODE_A, target: NODE_B, type: 'straight' }],
    })
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Mixed board" />,
    )
    installPointerCapture(screen.getByTestId('canvas-surface'))
    const node = screen.getAllByTestId('canvas-node')[0]!
    installPointerCapture(node)
    fireEvent.pointerDown(node, { button: 0, clientX: 20, clientY: 20, pointerId: 41 })
    fireEvent.pointerUp(node, { clientX: 20, clientY: 20, pointerId: 41 })
    fireEvent.pointerDown(screen.getByTestId('canvas-edge-interaction'), { ctrlKey: true })

    const toolbar = screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })
    expect(within(toolbar).getByText('Reorder')).toBeVisible()
    expect(within(toolbar).queryByRole('separator')).not.toBeInTheDocument()
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
    expect(hitTarget).toHaveAttribute('points', '120,50 220,50')
    expect(hitTarget).toHaveAttribute('stroke-width', '24')
    expect(hitTarget.closest('svg')).toHaveAttribute('viewBox', '120 40 100 20')
    expect(hitTarget.closest('svg')).toHaveAttribute('preserveAspectRatio', 'none')
    fireEvent.pointerDown(hitTarget, { button: 0, clientX: 450, clientY: 110, pointerId: 11 })
    expect(screen.getByTestId('canvas-node')).toHaveAttribute('data-selected', 'true')

    view.unmount()
    session.dispose()
  })

  it('keeps strokes out of edge authoring and raises edited nodes above document content', async () => {
    const session = await createSession({
      nodes: [
        {
          id: NODE_A,
          type: 'text',
          position: { x: 0, y: 0 },
          width: 180,
          height: 80,
          zIndex: 1,
          data: {},
        },
        {
          id: STROKE,
          type: 'stroke',
          position: { x: 0, y: 100 },
          width: 100,
          height: 20,
          zIndex: 20,
          data: {
            bounds: { x: 0, y: 100, width: 100, height: 20 },
            points: [
              [0, 110, 0.5],
              [100, 110, 0.5],
            ],
            color: '#000000',
            size: 4,
          },
        },
      ],
      edges: [],
    })
    const view = render(
      <CanvasEditor canEdit resourceId={RESOURCE_ID} session={session} title="Layer board" />,
    )
    const nodes = screen.getAllByTestId('canvas-node')
    const textNode = nodes.find((node) => node.dataset.nodeId === NODE_A)!

    fireEvent.click(screen.getByRole('button', { name: 'Edges' }))
    expect(screen.getAllByTestId(/^canvas-node-handle-/)).toHaveLength(4)

    fireEvent.click(screen.getByRole('button', { name: 'Pointer' }))
    fireEvent.doubleClick(textNode)
    expect(textNode).toHaveStyle({ zIndex: '21' })

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
