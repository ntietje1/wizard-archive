import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { SidebarItemId } from 'shared/common/ids'
import type { EmbedTarget } from 'shared/embeds/embedTargets'
import {
  EditableEmbedLinkDraftForm,
  EditableEmbedUploadStatus,
} from '../../components/editable-target-controls'
import { useEditableEmbedTargetControls } from '../use-editable-target-controls'
import type { EmbedTargetUploadFileResult } from '../../target-operations'

describe('useEditableEmbedTargetControls', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('closes and resets the external link draft when canceled', async () => {
    const user = userEvent.setup()
    render(<EditableTargetControlsHarness />)

    await user.click(screen.getByRole('button', { name: 'open link draft' }))
    await user.type(
      screen.getByRole('textbox', { name: 'External file URL' }),
      'ftp://x.test/a.pdf',
    )
    await user.click(screen.getByRole('button', { name: 'Link' }))

    expect(screen.getByText('Use an HTTPS file URL')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('textbox', { name: 'External file URL' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'open link draft' }))

    expect(screen.getByRole('textbox', { name: 'External file URL' })).toHaveValue('')
    expect(screen.queryByText('Use an HTTPS file URL')).not.toBeInTheDocument()
  })

  it('keeps the external link draft open with an inline error when submission fails', async () => {
    const user = userEvent.setup()
    const setTarget = vi.fn(() => Promise.reject(new Error('offline')))
    render(<EditableTargetControlsHarness setTarget={setTarget} />)

    await user.click(screen.getByRole('button', { name: 'open link draft' }))
    await user.type(
      screen.getByRole('textbox', { name: 'External file URL' }),
      'https://example.com/file.pdf',
    )
    await user.click(screen.getByRole('button', { name: 'Link' }))

    expect(await screen.findByText('Could not link file. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'External file URL' })).toHaveValue(
      'https://example.com/file.pdf',
    )
    expect(setTarget).toHaveBeenCalledWith({
      kind: 'externalUrl',
      url: 'https://example.com/file.pdf',
      name: 'file.pdf',
    })
  })

  it('closes and resets the external link draft after successful submission', async () => {
    const user = userEvent.setup()
    const setTarget = vi.fn(() => Promise.resolve())
    render(<EditableTargetControlsHarness setTarget={setTarget} />)

    await user.click(screen.getByRole('button', { name: 'open link draft' }))
    await user.type(
      screen.getByRole('textbox', { name: 'External file URL' }),
      'https://example.com/file.pdf',
    )
    await user.click(screen.getByRole('button', { name: 'Link' }))

    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'External file URL' })).not.toBeInTheDocument(),
    )
    expect(setTarget).toHaveBeenCalledWith({
      kind: 'externalUrl',
      url: 'https://example.com/file.pdf',
      name: 'file.pdf',
    })

    await user.click(screen.getByRole('button', { name: 'open link draft' }))

    expect(screen.getByRole('textbox', { name: 'External file URL' })).toHaveValue('')
  })

  it('uploads a selected file and replaces the embed target', async () => {
    const user = userEvent.setup()
    const setTarget = vi.fn(() => Promise.resolve())
    const uploadFile = vi.fn(() =>
      Promise.resolve({ status: 'completed' as const, itemId: sidebarItemId('file-1') }),
    )
    render(<EditableTargetControlsHarness setTarget={setTarget} uploadFile={uploadFile} />)

    await user.upload(
      screen.getByLabelText('Upload embed file'),
      new File(['image'], 'portrait.png', { type: 'image/png' }),
    )

    await waitFor(() =>
      expect(setTarget).toHaveBeenCalledWith({
        kind: 'resource',
        resourceId: sidebarItemId('file-1'),
      }),
    )
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it('reports incomplete upload results without replacing the embed target', async () => {
    const user = userEvent.setup()
    const setTarget = vi.fn(() => Promise.resolve())
    const uploadFile = vi.fn(() =>
      Promise.resolve({ status: 'skipped' as const, reason: 'failed' as const }),
    )
    render(<EditableTargetControlsHarness setTarget={setTarget} uploadFile={uploadFile} />)

    await user.upload(
      screen.getByLabelText('Upload embed file'),
      new File(['image'], 'portrait.png', { type: 'image/png' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not upload file. Please try again.',
    )
    expect(console.error).toHaveBeenCalledWith('Could not upload file. Please try again.', {
      status: 'skipped',
      reason: 'failed',
    })
    expect(setTarget).not.toHaveBeenCalled()
  })

  it('ignores file picker requests while an upload is in progress', async () => {
    const user = userEvent.setup()
    const click = vi.spyOn(HTMLInputElement.prototype, 'click')
    const uploadFile = vi.fn(
      () =>
        new Promise<EmbedTargetUploadFileResult>(() => {
          // Keep the hook in the uploading state.
        }),
    )
    render(<EditableTargetControlsHarness uploadFile={uploadFile} />)

    await user.upload(
      screen.getByLabelText('Upload embed file'),
      new File(['image'], 'portrait.png', { type: 'image/png' }),
    )

    expect(await screen.findByRole('status')).toHaveTextContent('Uploading')
    await user.click(screen.getByRole('button', { name: 'open file picker' }))

    expect(click).not.toHaveBeenCalled()
  })
})

function EditableTargetControlsHarness({
  setTarget = vi.fn(() => Promise.resolve()),
  uploadFile,
}: {
  setTarget?: (target: EmbedTarget) => Promise<void>
  uploadFile?: (file: File) => Promise<EmbedTargetUploadFileResult>
}) {
  const controls = useEditableEmbedTargetControls({
    setTarget,
    uploadFile,
    uploadSurface: 'note',
    embedId: 'test-embed',
  })

  return (
    <>
      <input
        ref={controls.fileInputRef}
        aria-label="Upload embed file"
        type="file"
        onChange={controls.handleFileInputChange}
      />
      <button type="button" onClick={controls.openFilePicker}>
        open file picker
      </button>
      <button type="button" onClick={controls.openLinkDraft}>
        open link draft
      </button>
      <EditableEmbedUploadStatus className="" controls={controls} />
      <EditableEmbedLinkDraftForm className="" controls={controls} errorClassName="" />
    </>
  )
}

function sidebarItemId(value: string): SidebarItemId {
  return value as SidebarItemId
}
