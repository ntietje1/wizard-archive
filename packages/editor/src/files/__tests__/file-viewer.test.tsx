import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { initialVersion, sha256Digest } from '../../resources/component-version'
import type {
  FileContentSource,
  FileResourceContent,
} from '../../resources/content-session-contract'
import { testDomainId } from '../../test/domain-id'
import { FileViewer } from '../file-viewer'

const { imageViewer } = vi.hoisted(() => ({ imageViewer: vi.fn() }))

vi.mock('../image-file-viewer', () => ({
  ImageFileViewer: (props: Record<string, unknown>) => {
    imageViewer(props)
    return <div data-testid="image-file-viewer" />
  },
}))

vi.mock('../pdf-file-viewer', () => ({
  PdfFileViewer: () => <div data-testid="pdf-file-viewer" />,
}))

vi.mock('../media-file-viewer', () => ({
  MediaFileViewer: ({ kind }: { kind: string }) => <div data-testid={`${kind}-file-viewer`} />,
}))

const createObjectURL = vi.fn(() => 'blob:verified-file')
const revokeObjectURL = vi.fn()

beforeEach(() => {
  class TestURL extends URL {}
  TestURL.createObjectURL = createObjectURL
  TestURL.revokeObjectURL = revokeObjectURL
  vi.stubGlobal('URL', TestURL)
})

afterEach(() => vi.unstubAllGlobals())

describe('FileViewer', () => {
  it('loads verified bytes once and revokes its object URL on unmount', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    const source = fileSource(() => ({
      status: 'ready',
      bytes,
      extension: 'png',
      mediaType: 'image/png',
    }))
    const version = initialVersion(await sha256Digest(bytes))
    const view = render(
      <FileViewer
        canEdit
        content={fileContent({
          attachment: 'attached',
          byteSize: bytes.byteLength,
          classification: 'viewable_image',
          detectedFormat: 'png',
          extension: 'png',
          mediaType: 'image/png',
          viewerUnavailableReason: null,
        })}
        resourceId={testDomainId('resource', 'viewer-image')}
        source={source}
        title="Map image.png"
        version={version}
      />,
    )

    expect(await screen.findByTestId('image-file-viewer')).toBeInTheDocument()
    expect(imageViewer).toHaveBeenCalledWith({ alt: 'Map image.png', url: 'blob:verified-file' })
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'download',
      'Map image.png',
    )

    view.unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:verified-file')
  })

  it('does not request bytes for an unattached resource', async () => {
    const exportFile = vi.fn()
    render(
      <FileViewer
        canEdit={false}
        content={fileContent({ attachment: 'unattached' })}
        resourceId={testDomainId('resource', 'viewer-empty')}
        source={fileSource(exportFile)}
        title="Empty"
        version={initialVersion(await sha256Digest(new Uint8Array()))}
      />,
    )

    expect(screen.getByText('No file attached')).toBeInTheDocument()
    expect(exportFile).not.toHaveBeenCalled()
  })

  it('offers a bounded explicit retry after a provider failure', async () => {
    const bytes = new TextEncoder().encode('file')
    const exportFile = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network unavailable'))
      .mockResolvedValueOnce({
        status: 'ready',
        bytes,
        extension: 'txt',
        mediaType: 'text/plain',
      })
    render(
      <FileViewer
        canEdit
        content={fileContent({
          attachment: 'attached',
          byteSize: bytes.byteLength,
          extension: 'txt',
          mediaType: 'text/plain',
          viewerUnavailableReason: 'unsupported_format',
        })}
        resourceId={testDomainId('resource', 'viewer-retry')}
        source={fileSource(exportFile)}
        title="Notes"
        version={initialVersion(await sha256Digest(bytes))}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(exportFile).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('link', { name: 'Download' })).toHaveAttribute(
      'download',
      'Notes.txt',
    )
  })

  it('replaces an attached file through the focused content operation', async () => {
    const bytes = new TextEncoder().encode('original')
    const replacementBytes = new TextEncoder().encode('replacement')
    const version = initialVersion(await sha256Digest(bytes))
    const nextVersion = initialVersion(await sha256Digest(replacementBytes))
    const replace = vi.fn<FileContentSource['replace']>(() =>
      Promise.resolve({
        status: 'completed',
        content: fileContent({ attachment: 'attached', byteSize: replacementBytes.byteLength }),
        version: nextVersion,
      }),
    )
    const file = new File([replacementBytes], 'replacement.txt', { type: 'text/plain' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.resolve(replacementBytes.buffer),
    })
    render(
      <FileViewer
        canEdit
        content={fileContent({ attachment: 'attached', byteSize: bytes.byteLength })}
        resourceId={testDomainId('resource', 'viewer-replace')}
        source={fileSource(
          () => ({ status: 'ready', bytes, extension: 'txt', mediaType: 'text/plain' }),
          replace,
        )}
        title="Evidence"
        version={version}
      />,
    )

    fireEvent.change(await screen.findByLabelText('Choose file replacement'), {
      target: { files: [file] },
    })

    await waitFor(() => expect(replace).toHaveBeenCalledOnce())
    expect(replace).toHaveBeenCalledWith(
      testDomainId('resource', 'viewer-replace'),
      version,
      expect.objectContaining({ fileName: 'replacement.txt' }),
    )
    expect(Array.from(replace.mock.calls[0]![2].bytes)).toEqual(Array.from(replacementBytes))
  })

  it('supports empty-file drops and retries the same candidate after an uncertain response', async () => {
    const bytes = new TextEncoder().encode('replacement')
    const version = initialVersion(await sha256Digest(new Uint8Array()))
    const replace = vi
      .fn<FileContentSource['replace']>()
      .mockResolvedValueOnce({ status: 'retryable', reason: 'response_lost' })
      .mockResolvedValueOnce({
        status: 'completed',
        content: fileContent({ attachment: 'attached', byteSize: bytes.byteLength }),
        version: initialVersion(await sha256Digest(bytes)),
      })
    const file = new File([bytes], 'replacement.txt', { type: 'text/plain' })
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(bytes.buffer) })
    render(
      <FileViewer
        canEdit
        content={fileContent({ attachment: 'unattached' })}
        resourceId={testDomainId('resource', 'viewer-drop')}
        source={fileSource(vi.fn(), replace)}
        title="Empty"
        version={version}
      />,
    )

    fireEvent.drop(screen.getByLabelText('File content'), { dataTransfer: { files: [file] } })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The file replacement could not be confirmed.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(2))
    expect(replace.mock.calls[1]![0]).toBe(replace.mock.calls[0]![0])
    expect(replace.mock.calls[1]![1]).toBe(replace.mock.calls[0]![1])
    expect(replace.mock.calls[1]![2]).toBe(replace.mock.calls[0]![2])
  })

  it('requires a fresh replacement after a version conflict', async () => {
    const firstVersion = initialVersion(await sha256Digest(new Uint8Array([1])))
    const currentVersion = initialVersion(await sha256Digest(new Uint8Array([2])))
    const replace = vi
      .fn<FileContentSource['replace']>()
      .mockResolvedValueOnce({ status: 'rejected', reason: 'version_conflict' })
      .mockResolvedValueOnce({
        status: 'completed',
        content: fileContent({ attachment: 'attached' }),
        version: initialVersion(await sha256Digest(new Uint8Array([3]))),
      })
    const source = fileSource(vi.fn(), replace)
    const staleBytes = new TextEncoder().encode('stale')
    const currentBytes = new TextEncoder().encode('current')
    const staleFile = new File([staleBytes], 'stale.txt', { type: 'text/plain' })
    const currentFile = new File([currentBytes], 'current.txt', { type: 'text/plain' })
    Object.defineProperty(staleFile, 'arrayBuffer', {
      value: () => Promise.resolve(staleBytes.buffer),
    })
    Object.defineProperty(currentFile, 'arrayBuffer', {
      value: () => Promise.resolve(currentBytes.buffer),
    })
    const resourceId = testDomainId('resource', 'replacement-conflict')
    const view = render(
      <FileViewer
        canEdit
        content={fileContent({ attachment: 'unattached' })}
        resourceId={resourceId}
        source={source}
        title="Conflict"
        version={firstVersion}
      />,
    )

    fireEvent.change(screen.getByLabelText('Choose file replacement'), {
      target: { files: [staleFile] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This file changed while the replacement was uploading.',
    )
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(replace).toHaveBeenCalledOnce()

    view.rerender(
      <FileViewer
        canEdit
        content={fileContent({ attachment: 'unattached' })}
        resourceId={resourceId}
        source={source}
        title="Conflict"
        version={currentVersion}
      />,
    )
    fireEvent.change(screen.getByLabelText('Choose file replacement'), {
      target: { files: [currentFile] },
    })

    await waitFor(() => expect(replace).toHaveBeenCalledTimes(2))
    expect(replace.mock.calls[0]![1]).toBe(firstVersion)
    expect(replace.mock.calls[1]![1]).toBe(currentVersion)
    expect(replace.mock.calls[1]![2]).not.toBe(replace.mock.calls[0]![2])
  })

  it('retires a retry when navigation changes its immutable resource target', async () => {
    const bytes = new TextEncoder().encode('replacement')
    const version = initialVersion(await sha256Digest(new Uint8Array()))
    const replace = vi
      .fn<FileContentSource['replace']>()
      .mockResolvedValue({ status: 'retryable', reason: 'response_lost' })
    const source = fileSource(vi.fn(), replace)
    const file = new File([bytes], 'replacement.txt', { type: 'text/plain' })
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(bytes.buffer) })
    const firstResourceId = testDomainId('resource', 'replacement-first')
    const secondResourceId = testDomainId('resource', 'replacement-second')
    const view = render(
      <FileViewer
        canEdit
        content={fileContent({ attachment: 'unattached' })}
        resourceId={firstResourceId}
        source={source}
        title="First"
        version={version}
      />,
    )

    fireEvent.change(screen.getByLabelText('Choose file replacement'), {
      target: { files: [file] },
    })
    expect(await screen.findByRole('alert')).toBeVisible()
    view.rerender(
      <FileViewer
        canEdit
        content={fileContent({ attachment: 'unattached' })}
        resourceId={secondResourceId}
        source={source}
        title="Second"
        version={version}
      />,
    )

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(replace).toHaveBeenCalledOnce()
    expect(replace.mock.calls[0]![0]).toBe(firstResourceId)
  })

  it('ignores a late replacement settlement after navigation changes target', async () => {
    const bytes = new TextEncoder().encode('replacement')
    const version = initialVersion(await sha256Digest(new Uint8Array()))
    let settle!: (result: Awaited<ReturnType<FileContentSource['replace']>>) => void
    const replace = vi.fn<FileContentSource['replace']>(
      () => new Promise((resolve) => (settle = resolve)),
    )
    const source = fileSource(vi.fn(), replace)
    const file = new File([bytes], 'replacement.txt', { type: 'text/plain' })
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(bytes.buffer) })
    const firstResourceId = testDomainId('resource', 'late-first')
    const view = render(
      <FileViewer
        canEdit
        content={fileContent({ attachment: 'unattached' })}
        resourceId={firstResourceId}
        source={source}
        title="First"
        version={version}
      />,
    )

    fireEvent.change(screen.getByLabelText('Choose file replacement'), {
      target: { files: [file] },
    })
    await waitFor(() => expect(replace).toHaveBeenCalledOnce())
    view.rerender(
      <FileViewer
        canEdit
        content={fileContent({ attachment: 'unattached' })}
        resourceId={testDomainId('resource', 'late-second')}
        source={source}
        title="Second"
        version={version}
      />,
    )
    await act(async () => {
      settle({ status: 'retryable', reason: 'response_lost' })
      await Promise.resolve()
    })

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('The file replacement could not be confirmed.')).toBeNull()
    expect(replace.mock.calls[0]![0]).toBe(firstResourceId)
  })

  it('retains opaque replacements independently of file metadata', async () => {
    const bytes = new TextEncoder().encode('binary')
    const version = initialVersion(await sha256Digest(new Uint8Array()))
    const nextVersion = initialVersion(await sha256Digest(bytes))
    const replace = vi.fn<FileContentSource['replace']>(() =>
      Promise.resolve({
        status: 'completed',
        content: fileContent({ attachment: 'attached', byteSize: bytes.byteLength }),
        version: nextVersion,
      }),
    )
    const file = new File(['binary'], 'malware.exe', { type: 'application/octet-stream' })
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(bytes.buffer) })
    render(
      <FileViewer
        canEdit
        content={fileContent({ attachment: 'unattached' })}
        resourceId={testDomainId('resource', 'viewer-invalid')}
        source={fileSource(vi.fn(), replace)}
        title="Empty"
        version={version}
      />,
    )

    fireEvent.change(screen.getByLabelText('Choose file replacement'), {
      target: { files: [file] },
    })
    await waitFor(() => expect(replace).toHaveBeenCalledOnce())
    expect(replace.mock.calls[0]![0]).toBe(testDomainId('resource', 'viewer-invalid'))
    expect(replace.mock.calls[0]![1]).toEqual(version)
    expect(replace.mock.calls[0]![2].fileName).toBe('malware.exe')
    expect(Array.from(replace.mock.calls[0]![2].bytes)).toEqual(Array.from(bytes))
  })
})

function fileSource(
  exportFile: FileContentSource['export'],
  replace: FileContentSource['replace'] = vi.fn(),
): FileContentSource {
  return {
    dispose: vi.fn(),
    export: exportFile,
    get: vi.fn(() => ({ status: 'loading' as const })),
    replace,
    subscribe: vi.fn(() => () => undefined),
  }
}

function fileContent(overrides: Partial<FileResourceContent>): FileResourceContent {
  return {
    attachment: 'attached',
    byteSize: 0,
    classification: 'inert_file',
    detectedFormat: null,
    extension: null,
    mediaType: 'application/octet-stream',
    viewerUnavailableReason: 'unsupported_format',
    ...overrides,
  }
}
