import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { FileContentViewer } from '../content-viewer'

const {
  audioFileViewerMock,
  imageFileViewerMock,
  otherFileViewerMock,
  pdfFileViewerMock,
  videoFileViewerMock,
} = vi.hoisted(() => ({
  audioFileViewerMock: vi.fn(),
  imageFileViewerMock: vi.fn(),
  otherFileViewerMock: vi.fn(),
  pdfFileViewerMock: vi.fn(),
  videoFileViewerMock: vi.fn(),
}))

vi.mock('../audio-file-viewer', () => ({
  AudioFileViewer: (props: Record<string, unknown>) => {
    audioFileViewerMock(props)
    return <div data-testid="audio-file-viewer" />
  },
}))

vi.mock('../image-file-viewer', () => ({
  ImageFileViewer: (props: Record<string, unknown>) => {
    imageFileViewerMock(props)
    return <div data-testid="image-file-viewer" />
  },
}))

vi.mock('../other-file-viewer', () => ({
  OtherFileViewer: (props: Record<string, unknown>) => {
    otherFileViewerMock(props)
    return <div data-testid="other-file-viewer" />
  },
}))

vi.mock('../pdf-file-viewer', () => ({
  PdfFileViewer: (props: Record<string, unknown>) => {
    pdfFileViewerMock(props)
    return <div data-testid="pdf-file-viewer" />
  },
}))

vi.mock('../video-file-viewer', () => ({
  VideoFileViewer: (props: Record<string, unknown>) => {
    videoFileViewerMock(props)
    return <div data-testid="video-file-viewer" />
  },
}))

describe('FileContentViewer', () => {
  it('renders the image viewer for image files', () => {
    render(
      <FileContentViewer
        downloadUrl="blob:image"
        contentType="image/png"
        name="Handout"
        allowObjectUrl
      />,
    )

    expect(screen.getByTestId('image-file-viewer')).toBeInTheDocument()
    expect(imageFileViewerMock).toHaveBeenCalledWith({
      imageUrl: 'blob:image',
      alt: 'Handout',
      allowDataUrl: false,
      allowObjectUrl: true,
    })
  })

  it('routes media and unknown files to the production file viewers', () => {
    const { rerender } = render(
      <FileContentViewer downloadUrl="blob:file" contentType="application/pdf" name="Rules.pdf" />,
    )

    expect(screen.getByTestId('pdf-file-viewer')).toBeInTheDocument()
    expect(pdfFileViewerMock).toHaveBeenCalledWith({
      pdfUrl: 'blob:file',
      allowDataUrl: false,
      allowObjectUrl: false,
    })

    rerender(<FileContentViewer downloadUrl="blob:file" contentType="video/mp4" name="Clip" />)
    expect(screen.getByTestId('video-file-viewer')).toBeInTheDocument()

    rerender(<FileContentViewer downloadUrl="blob:file" contentType="audio/mpeg" name="Cue" />)
    expect(screen.getByTestId('audio-file-viewer')).toBeInTheDocument()

    rerender(<FileContentViewer downloadUrl="blob:file" contentType="text/plain" name="Note.txt" />)
    expect(screen.getByTestId('other-file-viewer')).toBeInTheDocument()
    expect(otherFileViewerMock).toHaveBeenLastCalledWith({
      fileUrl: 'blob:file',
      fileName: 'Note.txt',
      allowDataUrl: false,
      allowObjectUrl: false,
    })
  })

  it('uses filename-based routing when MIME metadata is missing or generic', () => {
    const { rerender } = render(
      <FileContentViewer
        downloadUrl="blob:file"
        contentType="application/octet-stream"
        name="Rules.pdf"
      />,
    )

    expect(screen.getByTestId('pdf-file-viewer')).toBeInTheDocument()
    expect(pdfFileViewerMock).toHaveBeenLastCalledWith({
      pdfUrl: 'blob:file',
      allowDataUrl: false,
      allowObjectUrl: false,
    })

    rerender(<FileContentViewer downloadUrl="blob:file" contentType={null} name="Theme.ogg" />)

    expect(screen.getByTestId('audio-file-viewer')).toBeInTheDocument()
  })

  it('passes trusted data URL authorization to the selected viewer', () => {
    render(
      <FileContentViewer
        downloadUrl="data:text/plain,hello"
        contentType="text/plain"
        name="Note.txt"
        allowDataUrl
      />,
    )

    expect(screen.getByTestId('other-file-viewer')).toBeInTheDocument()
    expect(otherFileViewerMock).toHaveBeenLastCalledWith({
      fileUrl: 'data:text/plain,hello',
      fileName: 'Note.txt',
      allowDataUrl: true,
      allowObjectUrl: false,
    })
  })
})
