import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { readCanvasRemoteCursors, setCanvasCollaborationCursor } from '../canvas-collaboration'
import { CanvasCollaborationCursors } from '../canvas-collaboration-cursors'

describe('canvas collaboration', () => {
  it('publishes local cursor state and renders only validated remote cursors at screen scale', () => {
    const document = new Y.Doc()
    const awareness = new Awareness(document)
    const collaboration = {
      provider: { awareness },
      user: { name: 'Local', color: '#61afef' },
    }
    awareness.setLocalStateField('user', collaboration.user)
    const remoteDocument = new Y.Doc()
    const remoteAwareness = new Awareness(remoteDocument)
    remoteAwareness.setLocalState({
      cursor: { x: 120, y: 80 },
      user: { name: 'Remote', color: '#e06c75' },
    })

    const view = render(<CanvasCollaborationCursors collaboration={collaboration} zoom={2} />)
    act(() =>
      applyAwarenessUpdate(
        awareness,
        encodeAwarenessUpdate(remoteAwareness, [remoteDocument.clientID]),
        'remote',
      ),
    )

    expect(readCanvasRemoteCursors(collaboration)).toEqual([
      {
        clientId: remoteDocument.clientID,
        point: { x: 120, y: 80 },
        user: { name: 'Remote', color: '#e06c75' },
      },
    ])
    const cursor = screen.getByLabelText('Remote cursor')
    expect(cursor).toHaveStyle({ transform: 'translate(120px, 80px)' })
    expect(screen.getByTestId('canvas-remote-cursor-visual')).toHaveStyle({
      transform: 'scale(0.5)',
    })
    expect(cursor.querySelector('path')).toHaveAttribute('fill', '#e06c75')

    view.rerender(<CanvasCollaborationCursors collaboration={collaboration} zoom={4} />)
    expect(cursor).toHaveStyle({ transform: 'translate(120px, 80px)' })
    expect(screen.getByTestId('canvas-remote-cursor-visual')).toHaveStyle({
      transform: 'scale(0.25)',
    })

    act(() => setCanvasCollaborationCursor(collaboration, { x: 40, y: 60 }))
    expect(awareness.getLocalState()).toMatchObject({ cursor: { x: 40, y: 60 } })
    act(() => setCanvasCollaborationCursor(collaboration, null))
    expect(awareness.getLocalState()).toMatchObject({ cursor: null })

    remoteAwareness.setLocalStateField('cursor', { x: Number.POSITIVE_INFINITY, y: 0 })
    act(() =>
      applyAwarenessUpdate(
        awareness,
        encodeAwarenessUpdate(remoteAwareness, [remoteDocument.clientID]),
        'remote',
      ),
    )
    expect(screen.queryByLabelText('Remote cursor')).not.toBeInTheDocument()

    remoteAwareness.destroy()
    remoteDocument.destroy()
    awareness.destroy()
    document.destroy()
  })
})
