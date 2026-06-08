import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ExternalUrlEmbedContent } from '../external-url-embed-content'
import { FileMediaEmbedContent } from '../file-media-embed-content'
import { AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK } from '../../utils/embed-media'
import type * as TanStackRouter from '@tanstack/react-router'
import type { ReactNode } from 'react'

type ResizeObserverEntryInput = {
  target: Element
  contentRect: DOMRectReadOnly
}

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackRouter>()
  return {
    ...actual,
    ClientOnly: ({ children }: { children: ReactNode }) => <>{children}</>,
  }
})

vi.mock('~/features/editor/components/viewer/file/pdf-file-viewer', () => ({
  PdfFileViewer: ({
    pdfUrl,
    onFirstPageAspectRatio,
    presentation,
    allowInnerScroll,
  }: {
    pdfUrl: string
    onFirstPageAspectRatio?: (aspectRatio: number | null) => void
    presentation?: string
    allowInnerScroll?: boolean
  }) => (
    <button
      type="button"
      data-testid="pdf-viewer"
      data-url={pdfUrl}
      data-presentation={presentation}
      data-allow-inner-scroll={allowInnerScroll === false ? 'false' : 'true'}
      onClick={() => onFirstPageAspectRatio?.(0.75)}
    >
      report pdf ratio
    </button>
  ),
}))

vi.mock('~/features/file-upload/utils/file-url-validation', () => ({
  isValidFileUrl: () => true,
}))

describe('ExternalUrlEmbedContent', () => {
  it('renders images inline', () => {
    render(<ExternalUrlEmbedContent url="https://x.test/a.png" name="a.png" />)

    expect(screen.getByRole('img', { name: 'a.png' })).toHaveAttribute(
      'src',
      'https://x.test/a.png',
    )
    expect(screen.getByRole('img', { name: 'a.png' })).toHaveAttribute('draggable', 'false')
    expect(screen.getByRole('img', { name: 'a.png' })).toHaveClass('pointer-events-none')
  })

  it('reports external image intrinsic aspect ratios', () => {
    const onMediaLayout = vi.fn()
    render(
      <ExternalUrlEmbedContent
        url="https://x.test/a.png"
        name="a.png"
        onMediaLayout={onMediaLayout}
      />,
    )

    const image = screen.getByRole('img', { name: 'a.png' })
    Object.defineProperty(image, 'naturalWidth', { value: 1600 })
    Object.defineProperty(image, 'naturalHeight', { value: 900 })
    fireEvent.load(image)

    expect(onMediaLayout).toHaveBeenLastCalledWith({
      kind: 'intrinsicAspectRatio',
      aspectRatio: 1.777778,
    })
  })

  it('renders video and audio urls with custom media controls', () => {
    const { rerender } = render(
      <ExternalUrlEmbedContent url="https://x.test/movie.mp4" name="movie.mp4" />,
    )
    expect(document.querySelector('video')).toHaveAttribute('src', 'https://x.test/movie.mp4')
    expect(document.querySelector('video')).toHaveAttribute('draggable', 'false')
    expect(document.querySelector('video')).not.toHaveAttribute('controls')
    expect(screen.getByRole('button', { name: 'Play movie.mp4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enter fullscreen' })).toBeInTheDocument()

    rerender(<ExternalUrlEmbedContent url="https://x.test/sound.mp3" name="sound.mp3" />)
    expect(document.querySelector('audio')).toHaveAttribute('src', 'https://x.test/sound.mp3')
    expect(document.querySelector('audio')).toHaveAttribute('draggable', 'false')
    expect(document.querySelector('audio')).not.toHaveAttribute('controls')
    expect(screen.getByRole('button', { name: 'Play sound.mp3' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enter fullscreen' })).not.toBeInTheDocument()
  })

  it('only plays videos from the custom play button', async () => {
    const user = userEvent.setup()
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined)
    const onPointerDown = vi.fn()
    render(
      <div onPointerDown={onPointerDown}>
        <ExternalUrlEmbedContent url="https://x.test/movie.mp4" name="movie.mp4" />
      </div>,
    )

    fireEvent.pointerDown(screen.getByTestId('video-embed-player'))
    expect(onPointerDown).toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Play movie.mp4' }))

    expect(play).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Pause movie.mp4' }))

    expect(pause).toHaveBeenCalledTimes(1)
    play.mockRestore()
    pause.mockRestore()
  })

  it('requests fullscreen from the custom video fullscreen button', async () => {
    const user = userEvent.setup()
    const requestFullscreen = vi.fn()
    render(<ExternalUrlEmbedContent url="https://x.test/movie.mp4" name="movie.mp4" />)
    Object.defineProperty(screen.getByTestId('video-embed-player'), 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    })

    await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }))

    expect(requestFullscreen).toHaveBeenCalled()
  })

  it('prevents native image and media-control drags without blocking media surfaces', () => {
    const { rerender } = render(<ExternalUrlEmbedContent url="https://x.test/a.png" name="a.png" />)
    expect(fireEvent.dragStart(screen.getByRole('img', { name: 'a.png' }))).toBe(false)

    rerender(<ExternalUrlEmbedContent url="https://x.test/movie.mp4" name="movie.mp4" />)
    expect(fireEvent.dragStart(document.querySelector('video')!)).toBe(true)
    expect(fireEvent.dragStart(screen.getByRole('button', { name: 'Play movie.mp4' }))).toBe(false)

    rerender(<ExternalUrlEmbedContent url="https://x.test/sound.mp3" name="sound.mp3" />)
    expect(fireEvent.dragStart(screen.getByTestId('audio-embed-player'))).toBe(true)
    expect(fireEvent.dragStart(screen.getByRole('button', { name: 'Play sound.mp3' }))).toBe(false)
  })

  it('reports audio as a fixed-height layout', () => {
    const onMediaLayout = vi.fn()
    render(
      <ExternalUrlEmbedContent
        url="https://x.test/sound.mp3"
        name="sound.mp3"
        onMediaLayout={onMediaLayout}
      />,
    )

    expect(screen.getByTestId('audio-embed-player').style.height).toBe('')
    expect(onMediaLayout).toHaveBeenLastCalledWith({
      kind: 'fixedHeight',
      height: AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK,
    })
  })

  it('updates audio fixed-height layout from the rendered custom control height', () => {
    const onMediaLayout = vi.fn()
    render(
      <ExternalUrlEmbedContent
        url="https://x.test/sound.mp3"
        name="sound.mp3"
        onMediaLayout={onMediaLayout}
      />,
    )

    const audio = document.querySelector('audio')
    expect(audio).not.toBeNull()
    vi.spyOn(screen.getByTestId('audio-embed-player'), 'getBoundingClientRect').mockReturnValue({
      bottom: 37,
      height: 37,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    fireEvent.loadedMetadata(audio!)

    expect(onMediaLayout).toHaveBeenLastCalledWith({
      kind: 'fixedHeight',
      height: 37,
    })
  })

  it('uses custom audio controls without blocking block-surface pointer events', async () => {
    const user = userEvent.setup()
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const onPointerDown = vi.fn()
    render(
      <div onPointerDown={onPointerDown}>
        <ExternalUrlEmbedContent url="https://x.test/sound.mp3" name="sound.mp3" />
      </div>,
    )

    fireEvent.pointerDown(screen.getByTestId('audio-embed-player'))
    expect(onPointerDown).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Play sound.mp3' }))

    expect(play).toHaveBeenCalled()
    expect(screen.getByRole('slider', { name: 'Seek sound.mp3' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Volume sound.mp3' })).toBeInTheDocument()
    play.mockRestore()
  })

  it('keeps the timeline usable and toggles compact volume at narrow widths', async () => {
    const user = userEvent.setup()
    const resizeObserver = installResizeObserverMock()
    const onPointerDown = vi.fn()
    const onClick = vi.fn()
    render(
      <div onPointerDown={onPointerDown} onClick={onClick}>
        <ExternalUrlEmbedContent url="https://x.test/sound.mp3" name="sound.mp3" />
      </div>,
    )

    resizeObserver.resize(screen.getByTestId('custom-media-controls'), 180)

    expect(screen.queryByText('0:00 / 0:00')).not.toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Seek sound.mp3' })).toHaveClass(
      'media-control-timeline',
    )
    expect(screen.queryByRole('slider', { name: 'Volume sound.mp3' })).not.toBeInTheDocument()

    const volumeButton = screen.getByRole('button', { name: 'Adjust volume sound.mp3' })
    await user.hover(volumeButton)
    expect(screen.queryByRole('slider', { name: 'Volume sound.mp3' })).not.toBeInTheDocument()

    await user.click(volumeButton)
    expect(onPointerDown).not.toHaveBeenCalled()
    expect(onClick).not.toHaveBeenCalled()

    const compactVolumeSlider = screen.getByRole('slider', { name: 'Volume sound.mp3' })
    expect(compactVolumeSlider).toBeInTheDocument()
    expect(compactVolumeSlider).toHaveAttribute('aria-orientation', 'vertical')

    await user.click(volumeButton)
    expect(screen.queryByRole('slider', { name: 'Volume sound.mp3' })).not.toBeInTheDocument()

    await user.click(volumeButton)
    expect(screen.getByRole('slider', { name: 'Volume sound.mp3' })).toBeInTheDocument()

    fireEvent.mouseLeave(screen.getByTestId('compact-volume-slider'))
    expect(screen.queryByRole('slider', { name: 'Volume sound.mp3' })).not.toBeInTheDocument()
    resizeObserver.restore()
  })

  it('keeps media time on one line and pins trailing controls to the right', () => {
    render(<ExternalUrlEmbedContent url="https://x.test/movie.mp4" name="movie.mp4" />)

    expect(screen.getByText('0:00 / 0:00')).toHaveClass('whitespace-nowrap')
    const trailingControls = screen.getByTestId('media-control-trailing-controls')
    expect(trailingControls).toHaveClass('ml-auto')
    expect(trailingControls).toContainElement(
      screen.getByRole('button', { name: 'Mute movie.mp4' }),
    )
    expect(trailingControls).toContainElement(
      screen.getByRole('button', { name: 'Enter fullscreen' }),
    )
  })

  it('updates seek slider hover preview position', () => {
    render(<ExternalUrlEmbedContent url="https://x.test/movie.mp4" name="movie.mp4" />)
    const seek = screen.getByRole('slider', { name: 'Seek movie.mp4' })
    vi.spyOn(seek, 'getBoundingClientRect').mockReturnValue({
      bottom: 10,
      height: 10,
      left: 10,
      right: 110,
      top: 0,
      width: 100,
      x: 10,
      y: 0,
      toJSON: () => ({}),
    })

    fireEvent.pointerMove(seek, { clientX: 60 })

    expect(seek).toHaveStyle('--media-slider-hover-percent: 50%')
  })

  it('renders PDFs through the React PDF viewer', async () => {
    render(<ExternalUrlEmbedContent url="https://x.test/doc.pdf" name="doc.pdf" />)

    expect(await screen.findByTestId('pdf-viewer')).toHaveAttribute(
      'data-url',
      'https://x.test/doc.pdf',
    )
    expect(screen.getByTestId('pdf-viewer')).toHaveAttribute('data-presentation', 'embed')
    expect(screen.getByTestId('pdf-viewer')).toHaveAttribute('data-allow-inner-scroll', 'true')
  })

  it('forwards disabled inner scrolling to embedded PDFs', async () => {
    render(
      <ExternalUrlEmbedContent
        url="https://x.test/doc.pdf"
        name="doc.pdf"
        allowInnerScroll={false}
      />,
    )

    expect(await screen.findByTestId('pdf-viewer')).toHaveAttribute(
      'data-allow-inner-scroll',
      'false',
    )
  })

  it('forwards external PDF page aspect ratios', async () => {
    const onMediaLayout = vi.fn()
    render(
      <ExternalUrlEmbedContent
        url="https://x.test/doc.pdf"
        name="doc.pdf"
        onMediaLayout={onMediaLayout}
      />,
    )

    expect(onMediaLayout).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByTestId('pdf-viewer'))

    expect(onMediaLayout).toHaveBeenLastCalledWith({
      kind: 'intrinsicAspectRatio',
      aspectRatio: 0.75,
    })
  })

  it('renders unknown urls as open-link cards', () => {
    render(<ExternalUrlEmbedContent url="https://x.test/download" name="download" />)

    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute(
      'href',
      'https://x.test/download',
    )
  })
})

function installResizeObserverMock() {
  const originalResizeObserver = globalThis.ResizeObserver
  const callbacks = new Map<Element, ResizeObserverCallback>()

  class MockResizeObserver implements ResizeObserver {
    readonly callback: ResizeObserverCallback

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }

    observe = (target: Element) => {
      callbacks.set(target, this.callback)
    }

    unobserve = (target: Element) => {
      callbacks.delete(target)
    }

    disconnect = () => {
      callbacks.clear()
    }
  }

  globalThis.ResizeObserver = MockResizeObserver

  return {
    resize(target: Element, width: number) {
      const callback = callbacks.get(target)
      if (!callback) throw new Error('Expected observed element to have a resize callback')
      const entry: ResizeObserverEntryInput = {
        target,
        contentRect: {
          bottom: 40,
          height: 40,
          left: 0,
          right: width,
          top: 0,
          width,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        },
      }
      act(() => {
        callback([entry as ResizeObserverEntry], {} as ResizeObserver)
      })
    },
    restore() {
      globalThis.ResizeObserver = originalResizeObserver
    },
  }
}

describe('FileMediaEmbedContent', () => {
  it('uses internal preview metadata for files', () => {
    render(
      <FileMediaEmbedContent
        downloadUrl="https://x.test/image.png"
        contentType="image/png"
        previewUrl={null}
        name="image.png"
      />,
    )

    expect(screen.getByRole('img', { name: 'image.png' })).toHaveAttribute(
      'src',
      'https://x.test/image.png',
    )
  })

  it('reports file video intrinsic aspect ratios from media metadata', () => {
    const onMediaLayout = vi.fn()
    render(
      <FileMediaEmbedContent
        downloadUrl="https://x.test/movie.mp4"
        contentType="video/mp4"
        previewUrl={null}
        name="movie.mp4"
        onMediaLayout={onMediaLayout}
      />,
    )

    const video = document.querySelector('video')
    expect(video).not.toBeNull()
    Object.defineProperty(video, 'videoWidth', { value: 1920 })
    Object.defineProperty(video, 'videoHeight', { value: 1080 })
    fireEvent.loadedMetadata(video!)

    expect(onMediaLayout).toHaveBeenLastCalledWith({
      kind: 'intrinsicAspectRatio',
      aspectRatio: 1.777778,
    })
  })

  it('falls back to a file preview when no download URL is available', () => {
    render(
      <FileMediaEmbedContent
        downloadUrl={null}
        contentType="application/pdf"
        previewUrl={null}
        name="missing.pdf"
      />,
    )

    expect(screen.getByText('File preview unavailable')).toBeInTheDocument()
  })

  it('uses the existing unknown-file link fallback even when the URL has a media extension', () => {
    render(
      <FileMediaEmbedContent
        downloadUrl="https://example.convex.cloud/api/storage/not-authoritative"
        contentType="application/octet-stream"
        previewUrl={null}
        name="download"
      />,
    )

    expect(screen.getByRole('link', { name: /open file in new tab/i })).toHaveAttribute(
      'href',
      'https://example.convex.cloud/api/storage/not-authoritative',
    )
    expect(screen.queryByRole('img', { name: 'download' })).not.toBeInTheDocument()
  })
})
