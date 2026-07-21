import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  it('loads verified bytes without rendering a duplicate file action bar', async () => {
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
    expect(screen.queryByRole('link', { name: 'Download' })).not.toBeInTheDocument()
    expect(screen.queryByText('Map image.png')).not.toBeInTheDocument()

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
    expect(await screen.findByRole('region', { name: 'File preview' })).toBeVisible()
  })
})

function fileSource(
  exportFile: FileContentSource['export'],
  replace: FileContentSource['replace'] = vi.fn(),
): FileContentSource {
  return {
    create: () => Promise.reject(new Error('Not used')),
    createAsset: () => Promise.resolve({ status: 'rejected', reason: 'unsupported' }),
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
