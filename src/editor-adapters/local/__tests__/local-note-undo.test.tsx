import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it } from 'vite-plus/test'
import { LocalWorkspaceRuntimeHost } from '../local-workspace-runtime-host'
import { SAMPLE_LOCAL_RESOURCE_IDS } from '../sample-local-workspace'

describe('local note undo', () => {
  it('undoes and redoes canonical note commands through the packaged runtime', async () => {
    render(
      <StrictMode>
        <LocalWorkspaceRuntimeHost
          ariaLabel="Local workspace"
          initialResourceId={SAMPLE_LOCAL_RESOURCE_IDS.marketNote}
          showResourcePanel={false}
          workspaceName="Local"
        />
      </StrictMode>,
    )

    const textbox = await screen.findByRole('textbox', {
      name: 'The Lantern Market note editor',
    })
    const initialBlockCount = textbox.querySelectorAll('[data-node-type="blockContainer"]').length
    fireEvent.click(textbox)
    fireEvent.keyDown(textbox, { key: 'Enter' })
    await waitFor(() =>
      expect(textbox.querySelectorAll('[data-node-type="blockContainer"]')).toHaveLength(
        initialBlockCount + 1,
      ),
    )

    fireEvent.keyDown(textbox, { key: 'z', ctrlKey: true })
    await waitFor(() =>
      expect(textbox.querySelectorAll('[data-node-type="blockContainer"]')).toHaveLength(
        initialBlockCount,
      ),
    )

    fireEvent.keyDown(textbox, { key: 'z', ctrlKey: true, shiftKey: true })
    await waitFor(() =>
      expect(textbox.querySelectorAll('[data-node-type="blockContainer"]')).toHaveLength(
        initialBlockCount + 1,
      ),
    )
  })
})
