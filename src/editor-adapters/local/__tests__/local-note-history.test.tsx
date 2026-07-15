import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it } from 'vite-plus/test'
import { LocalWorkspaceRuntimeHost } from '../local-workspace-runtime-host'
import { SAMPLE_LOCAL_RESOURCE_IDS } from '../sample-local-workspace'

describe('local note history', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Value' }))
    await screen.findByRole('button', { name: 'Value: 0' })

    fireEvent.keyDown(textbox, { key: 'z', ctrlKey: true })
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Value: 0' })).not.toBeInTheDocument(),
    )

    fireEvent.keyDown(textbox, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(await screen.findByRole('button', { name: 'Value: 0' })).toBeInTheDocument()
  })
})
