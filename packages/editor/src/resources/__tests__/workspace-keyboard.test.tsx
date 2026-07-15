import { fireEvent, render, screen } from '@testing-library/react'
import type { KeyboardEvent } from 'react'
import { describe, expect, it } from 'vite-plus/test'
import type { WorkspaceKeyboardCommand } from '../workspace-keyboard'
import { workspaceKeyboardCommand } from '../workspace-keyboard'

describe('workspace keyboard commands', () => {
  it('maps resource operation shortcuts without intercepting text entry', () => {
    const commands: Array<WorkspaceKeyboardCommand> = []
    const record = (event: KeyboardEvent<HTMLElement>) => {
      const command = workspaceKeyboardCommand(event)
      if (command) commands.push(command)
    }
    render(
      <div onKeyDown={record}>
        <button type="button">Resource</button>
        <input aria-label="Title" />
      </div>,
    )

    const resource = screen.getByRole('button', { name: 'Resource' })
    fireEvent.keyDown(resource, { key: 'c', ctrlKey: true })
    fireEvent.keyDown(resource, { key: 'x', metaKey: true })
    fireEvent.keyDown(resource, { key: 'v', ctrlKey: true })
    fireEvent.keyDown(resource, { key: 'd', ctrlKey: true })
    fireEvent.keyDown(resource, { key: 'z', ctrlKey: true })
    fireEvent.keyDown(resource, { key: 'z', ctrlKey: true, shiftKey: true })
    fireEvent.keyDown(resource, { key: 'Delete' })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Title' }), {
      key: 'z',
      ctrlKey: true,
    })

    expect(commands).toEqual(['copy', 'cut', 'paste', 'duplicate', 'undo', 'redo', 'trash'])
  })
})
