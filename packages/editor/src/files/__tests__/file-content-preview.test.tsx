import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { FileContentPreview } from '../file-content-preview'
import type { FileResourceContent } from '../../resources/content-session-contract'

describe('embedded file content', () => {
  it('opens inert viewport files from the verified content URL', () => {
    render(
      <FileContentPreview
        content={fileContent({ classification: 'inert_file' })}
        fileName="evidence.txt"
        url="blob:verified-file"
      />,
    )

    expect(
      screen.getByRole('link', { name: /open file in new tab.*opens in a new tab/i }),
    ).toHaveAttribute('href', 'blob:verified-file')
  })

  it('keeps inert embeds static', () => {
    render(
      <FileContentPreview
        content={fileContent({ classification: 'inert_file' })}
        fileName="evidence.txt"
        mode="embed"
        url="blob:verified-file"
      />,
    )

    expect(screen.queryByRole('link', { name: /open file in new tab/i })).not.toBeInTheDocument()
  })

  it('renders images as static media and reports their intrinsic ratio', () => {
    const onMediaLayout = vi.fn()
    render(
      <FileContentPreview
        content={fileContent({ classification: 'viewable_image' })}
        fileName="Map.png"
        mode="embed"
        onMediaLayout={onMediaLayout}
        url="blob:image"
      />,
    )
    const image = screen.getByRole('img', { name: 'Map.png' })
    Object.defineProperties(image, {
      naturalWidth: { configurable: true, value: 1200 },
      naturalHeight: { configurable: true, value: 800 },
    })

    fireEvent.load(image)

    expect(onMediaLayout).toHaveBeenCalledWith({
      kind: 'intrinsicAspectRatio',
      aspectRatio: 1.5,
    })
    expect(screen.queryByRole('button', { name: 'Zoom in' })).not.toBeInTheDocument()
  })

  it('reports the native dimensions used by embedded audio and video players', () => {
    const reportAudio = vi.fn()
    const audioView = render(
      <FileContentPreview
        content={fileContent({ classification: 'viewable_audio' })}
        fileName="Theme.mp3"
        mode="embed"
        onMediaLayout={reportAudio}
        url="blob:audio"
      />,
    )
    const audio = audioView.container.querySelector('audio')
    if (!audio) throw new Error('Expected an audio player')
    vi.spyOn(audio, 'getBoundingClientRect').mockReturnValue({
      bottom: 40,
      height: 40,
      left: 0,
      right: 300,
      top: 0,
      width: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    fireEvent.loadedMetadata(audio)
    expect(reportAudio).toHaveBeenCalledWith({ kind: 'fixedHeight', height: 40 })
    audioView.unmount()

    const reportVideo = vi.fn()
    const videoView = render(
      <FileContentPreview
        content={fileContent({ classification: 'viewable_video' })}
        fileName="Intro.mp4"
        mode="embed"
        onMediaLayout={reportVideo}
        url="blob:video"
      />,
    )
    const video = videoView.container.querySelector('video')
    if (!video) throw new Error('Expected a video player')
    Object.defineProperties(video, {
      videoWidth: { configurable: true, value: 1920 },
      videoHeight: { configurable: true, value: 1080 },
    })
    fireEvent.loadedMetadata(video)
    expect(reportVideo).toHaveBeenCalledWith({
      kind: 'intrinsicAspectRatio',
      aspectRatio: 1.777778,
    })
  })
})

function fileContent(overrides: Partial<FileResourceContent>): FileResourceContent {
  return {
    attachment: 'attached',
    byteSize: 1,
    classification: 'inert_file',
    detectedFormat: null,
    extension: null,
    mediaType: 'application/octet-stream',
    viewerUnavailableReason: null,
    ...overrides,
  }
}
