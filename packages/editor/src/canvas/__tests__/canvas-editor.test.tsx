import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import * as Y from 'yjs'
import { CanvasEditor } from '../canvas-editor'
import { createCanvasDocumentDoc } from '../document-contract'
import type { CanvasDocumentContent } from '../document-contract'
import { initialVersion, sha256Digest } from '../../resources/component-version'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'
import { createInMemoryCanvasSession } from '../../resources/in-memory-canvas-session'

const RESOURCE_ID = assertDomainId(DOMAIN_ID_KIND.resource, '01890f47-65f2-7cc0-8a3b-444444444444')
const NODE_A = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')
const NODE_B = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-222222222222')

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
})
